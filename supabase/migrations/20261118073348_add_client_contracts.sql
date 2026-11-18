create table public.client_contracts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete restrict,
  owner_name text not null,
  activity_status text not null check (activity_status in ('Active', 'Non-active')),
  recruiter text,
  approach_date text,
  visit_date date,
  mandate_received_date date,
  terms text,
  notes text,
  source_organisation text,
  source_sector text,
  source_place text,
  contact_names text,
  contact_designations text,
  mobile_numbers text,
  landline_numbers text,
  email_addresses text,
  source_key text unique,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_contracts_owner_status on public.client_contracts(owner_name, activity_status);
alter table public.client_contracts enable row level security;
revoke all on public.client_contracts from authenticated;
grant select, insert, update on public.client_contracts to authenticated;
revoke all on public.client_contracts from anon;
create policy "Approved members can view client contracts" on public.client_contracts for select to authenticated using ((select private.crm_access_approved()));
create policy "Owners and admins can create client contracts" on public.client_contracts for insert to authenticated with check ((select private.crm_lead_access(owner_name)));
create policy "Owners and admins can update client contracts" on public.client_contracts for update to authenticated using ((select private.crm_lead_access(owner_name))) with check ((select private.crm_lead_access(owner_name)));

create table public.client_contract_history (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.client_contracts(id) on delete restrict,
  revision integer not null,
  changed_at timestamptz not null default now(),
  changed_by uuid,
  actor_name text not null,
  previous_values jsonb,
  new_values jsonb not null
);
create index client_contract_history_contract on public.client_contract_history(contract_id, revision desc);
alter table public.client_contract_history enable row level security;
revoke all on public.client_contract_history from authenticated;
grant select on public.client_contract_history to authenticated;
revoke all on public.client_contract_history from anon;
create policy "Approved members can view contract history" on public.client_contract_history for select to authenticated using ((select private.crm_access_approved()));

create function private.stamp_client_contract() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.account_id<>old.account_id then raise exception 'A contract cannot be moved to another client'; end if;
    new.revision:=old.revision+1;
  else new.revision:=1;
  end if;
  new.updated_at:=clock_timestamp();
  return new;
end $$;
create trigger stamp_client_contract before insert or update on public.client_contracts for each row execute function private.stamp_client_contract();

create function private.audit_client_contract() returns trigger language plpgsql security definer set search_path='' as $$
declare actor text;
begin
  select display_name into actor from public.bd_team_members where id=auth.uid();
  insert into public.client_contract_history(contract_id,revision,changed_by,actor_name,previous_values,new_values)
  values(new.id,new.revision,auth.uid(),coalesce(actor,'Tracker import'),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
  return new;
end $$;
revoke all on function private.audit_client_contract() from public, anon, authenticated;
revoke all on function private.stamp_client_contract() from public, anon, authenticated;
create trigger audit_client_contract after insert or update on public.client_contracts for each row execute function private.audit_client_contract();
