-- Every business row is private to its assigned BD owner and approved admins.
-- Unassigned rows are admin-only. Keep the existing approval and device gates.
create or replace function private.crm_owner_access(owner_label text)
returns boolean language sql stable security invoker set search_path='' as $$
 select private.crm_access_approved() and exists (
  select 1 from public.bd_team_members m where m.id=(select auth.uid()) and m.active and m.access_status='approved'
   and (m.access_role='primary_admin'
    or lower(btrim(coalesce(owner_label,''))) in (lower(btrim(m.display_name)),lower(btrim(m.email)))
    or (lower(btrim(m.display_name))='nuzhat k' and lower(btrim(coalesce(owner_label,'')))='nuzhat'))
 );
$$;
revoke all on function private.crm_owner_access(text) from public,anon;
grant execute on function private.crm_owner_access(text) to authenticated;

create or replace function private.crm_lead_access(lead_owner_name text)
returns boolean language sql stable security invoker set search_path='' as $$
 select private.crm_owner_access(lead_owner_name);
$$;

create or replace function private.crm_current_owner()
returns text language sql stable security invoker set search_path='' as $$
 select display_name from public.bd_team_members where id=(select auth.uid()) and active and access_status='approved' and access_role='bd_member' and private.crm_access_approved();
$$;
revoke all on function private.crm_current_owner() from public,anon;
grant execute on function private.crm_current_owner() to authenticated;

alter table public.trainers add column owner_name text;
alter table public.training_batches add column owner_name text;
-- Existing resources are not silently assigned to anyone.
-- A batch linked to a request inherits that request's known owner.
update public.training_batches b set owner_name=r.owner_name from public.training_requests r where r.id=b.request_id and r.owner_name is not null;

do $$ declare t text; begin
 foreach t in array array['accounts','contacts','deals','activities','cag_targets','leads','trainers','training_requests','training_batches'] loop
  execute format('alter table public.%I alter column owner_name set default private.crm_current_owner()',t);
 end loop;
end $$;
alter table public.call_logs alter column rep_name set default private.crm_current_owner();
alter table public.poa_entries alter column team_member set default private.crm_current_owner();
alter table public.kra_targets alter column team_member set default private.crm_current_owner();

-- Remove broad policies rather than leaving an alternative permissive route.
do $$ declare p record; t text; c text; begin
 for p in select tablename,policyname from pg_policies where schemaname='public' and tablename=any(array['accounts','contacts','deals','activities','cag_targets','call_logs','poa_entries','kra_targets','cag_monthly_summary','trainers','training_requests','training_batches','client_contracts','client_contract_history','ceipal_sync_state']) loop
  execute format('drop policy %I on public.%I',p.policyname,p.tablename);
 end loop;
 foreach t in array array['accounts','contacts','deals','activities','cag_targets','call_logs','poa_entries','kra_targets','cag_monthly_summary','trainers','training_requests','training_batches'] loop
  c:=case when t='call_logs' then 'rep_name' when t in ('poa_entries','kra_targets','cag_monthly_summary') then 'team_member' else 'owner_name' end;
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon',t);
  execute format('create policy "Owner or admin only" on public.%I for all to authenticated using ((select private.crm_owner_access(%I))) with check ((select private.crm_owner_access(%I)))',t,c,c);
 end loop;
end $$;

-- References may point only to records the caller is permitted to access.
-- RLS on the referenced tables applies to these EXISTS checks as well.
create policy "Client contact links must be accessible" on public.contacts as restrictive for all to authenticated using (true) with check (
 account_id is null or exists(select 1 from public.accounts a where a.id=contacts.account_id)
);
create policy "Proposal links must be accessible" on public.deals as restrictive for all to authenticated using (true) with check (
 (account_id is null or exists(select 1 from public.accounts a where a.id=deals.account_id)) and
 (contact_id is null or exists(select 1 from public.contacts c where c.id=deals.contact_id))
);
create policy "Training request links must be accessible" on public.training_requests as restrictive for all to authenticated using (true) with check (
 (account_id is null or exists(select 1 from public.accounts a where a.id=training_requests.account_id)) and
 (trainer_id is null or exists(select 1 from public.trainers t where t.id=training_requests.trainer_id))
);
create policy "Training batch links must be accessible" on public.training_batches as restrictive for all to authenticated using (true) with check (
 (request_id is null or exists(select 1 from public.training_requests r where r.id=training_batches.request_id)) and
 (trainer_id is null or exists(select 1 from public.trainers t where t.id=training_batches.trainer_id))
);
create policy "Activity links must be accessible" on public.activities as restrictive for all to authenticated using (true) with check (
 related_to_id is null or (select private.crm_access_admin()) or
 case related_to_type
  when 'Corporate Lead' then exists(select 1 from public.leads l where l.id=activities.related_to_id)
  when 'Lead' then exists(select 1 from public.leads l where l.id=activities.related_to_id)
  when 'Client' then exists(select 1 from public.accounts a where a.id=activities.related_to_id)
  when 'Client Contact' then exists(select 1 from public.contacts c where c.id=activities.related_to_id)
  when 'Proposal' then exists(select 1 from public.deals d where d.id=activities.related_to_id)
  when 'Training Request' then exists(select 1 from public.training_requests r where r.id=activities.related_to_id)
  when 'Training Batch' then exists(select 1 from public.training_batches b where b.id=activities.related_to_id)
  else false end
);
create policy "Contract owners and admins can read" on public.client_contracts for select to authenticated using ((select private.crm_owner_access(owner_name)));
create policy "Contract owners and admins can insert" on public.client_contracts for insert to authenticated with check (
 (select private.crm_owner_access(owner_name)) and exists(select 1 from public.accounts a where a.id=client_contracts.account_id)
);
create policy "Contract owners and admins can update" on public.client_contracts for update to authenticated using ((select private.crm_owner_access(owner_name))) with check (
 (select private.crm_owner_access(owner_name)) and exists(select 1 from public.accounts a where a.id=client_contracts.account_id)
);
create policy "Contract history follows contract access" on public.client_contract_history for select to authenticated using (
 exists(select 1 from public.client_contracts c where c.id=client_contract_history.contract_id)
);
create policy "Admins manage global sync state" on public.ceipal_sync_state for all to authenticated using ((select private.crm_access_admin())) with check ((select private.crm_access_admin()));

-- The member directory supplies only the current user's identity to BD users.
-- Administrators retain the complete assignment and access-management directory.
drop policy "Members can view access status" on public.bd_team_members;
create policy "Self or admin member directory" on public.bd_team_members for select to authenticated using (
 id=(select auth.uid()) or (select private.crm_access_admin())
);

-- Blank ownership on a new BD-created record is assigned by the database,
-- never from a client-provided role or a selected dashboard identity.
create function private.assign_business_owner() returns trigger
language plpgsql security invoker set search_path='' as $$
declare label text;
begin
 label:=to_jsonb(new)->>tg_argv[0];
 if label is null or btrim(label)='' then
  new:=jsonb_populate_record(new,jsonb_build_object(tg_argv[0],private.crm_current_owner()));
 end if;
 return new;
end $$;
revoke all on function private.assign_business_owner() from public,anon,authenticated;
do $$ declare t text; c text; begin
 foreach t in array array['accounts','contacts','deals','activities','cag_targets','call_logs','poa_entries','kra_targets','leads','trainers','training_requests','training_batches'] loop
  c:=case when t='call_logs' then 'rep_name' when t in ('poa_entries','kra_targets') then 'team_member' else 'owner_name' end;
  execute format('create trigger aa_assign_business_owner before insert on public.%I for each row execute function private.assign_business_owner(%L)',t,c);
 end loop;
end $$;
