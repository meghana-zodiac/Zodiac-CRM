-- Approval-based CRM access. Existing BD members remain approved; new users
-- are pending until one of the two primary administrators approves them.
create schema if not exists private;

alter table public.bd_team_members
  add column if not exists access_status text not null default 'pending',
  add column if not exists access_role text not null default 'bd_member',
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id);

alter table public.bd_team_members drop constraint if exists bd_team_members_access_status_check;
alter table public.bd_team_members add constraint bd_team_members_access_status_check
  check (access_status in ('pending', 'approved', 'rejected', 'suspended'));
alter table public.bd_team_members drop constraint if exists bd_team_members_access_role_check;
alter table public.bd_team_members add constraint bd_team_members_access_role_check
  check (access_role in ('primary_admin', 'bd_member'));

-- Preserve every user who was already using the CRM before approval was introduced.
update public.bd_team_members
set access_status = 'approved', active = true, updated_at = now()
where access_status = 'pending';

update public.bd_team_members
set access_role = 'primary_admin', access_status = 'approved', active = true, updated_at = now()
where lower(email) in ('preetamsanil@zodiachrc.com', 'meghana@zodiachrc.com');

create or replace function private.crm_access_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bd_team_members m
    where m.id = (select auth.uid())
      and m.active
      and m.access_status = 'approved'
  );
$$;

create or replace function private.crm_access_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bd_team_members m
    where m.id = (select auth.uid())
      and m.active
      and m.access_status = 'approved'
      and m.access_role = 'primary_admin'
  );
$$;

revoke all on function private.crm_access_approved() from public, anon, authenticated;
revoke all on function private.crm_access_admin() from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.crm_access_approved() to authenticated;
grant execute on function private.crm_access_admin() to authenticated;

-- New Zodiac users are registered as pending; existing decisions are never reset.
create or replace function private.sync_bd_team_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_name text;
begin
  if lower(coalesce(new.email, '')) not like '%@zodiachrc.com' then
    delete from public.bd_team_members where id = new.id;
    return new;
  end if;

  resolved_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    initcap(replace(replace(split_part(new.email, '@', 1), '.', ' '), '_', ' '))
  );

  insert into public.bd_team_members (id, email, display_name, active, access_status, access_role, updated_at)
  values (
    new.id,
    lower(new.email),
    resolved_name,
    true,
    case when lower(new.email) in ('preetamsanil@zodiachrc.com', 'meghana@zodiachrc.com') then 'approved' else 'pending' end,
    case when lower(new.email) in ('preetamsanil@zodiachrc.com', 'meghana@zodiachrc.com') then 'primary_admin' else 'bd_member' end,
    now()
  )
  on conflict (id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      updated_at = now();

  return new;
end;
$$;

revoke all on function private.sync_bd_team_member() from public, anon, authenticated;

revoke all on table public.bd_team_members from anon;
revoke update on table public.bd_team_members from authenticated;
grant select on table public.bd_team_members to authenticated;
grant update (access_status, active, reviewed_at, reviewed_by, updated_at)
  on table public.bd_team_members to authenticated;

create or replace function private.protect_primary_crm_admins()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(old.email) in ('preetamsanil@zodiachrc.com', 'meghana@zodiachrc.com') then
    new.access_status := 'approved';
    new.access_role := 'primary_admin';
    new.active := true;
  end if;
  return new;
end;
$$;
revoke all on function private.protect_primary_crm_admins() from public, anon, authenticated;
drop trigger if exists protect_primary_crm_admins_before_update on public.bd_team_members;
create trigger protect_primary_crm_admins_before_update
before update on public.bd_team_members
for each row execute function private.protect_primary_crm_admins();

drop policy if exists "Zodiac users can view BD team members" on public.bd_team_members;
drop policy if exists "Members can view access status" on public.bd_team_members;
drop policy if exists "Admins can update access" on public.bd_team_members;
create policy "Members can view access status"
on public.bd_team_members for select to authenticated
using (id = (select auth.uid()) or private.crm_access_admin());
create policy "Admins can update access"
on public.bd_team_members for update to authenticated
using (private.crm_access_admin())
with check (private.crm_access_admin());

do $$
declare
  crm_table text;
  existing_policy record;
begin
  foreach crm_table in array array[
    'accounts', 'activities', 'cag_targets', 'call_logs', 'contacts', 'deals',
    'kra_targets', 'leads', 'poa_entries', 'trainers', 'training_batches',
    'training_requests'
  ]
  loop
    if to_regclass(format('public.%I', crm_table)) is null then continue; end if;
    for existing_policy in
      select policyname from pg_policies where schemaname = 'public' and tablename = crm_table
    loop
      execute format('drop policy %I on public.%I', existing_policy.policyname, crm_table);
    end loop;
    execute format(
      'create policy %I on public.%I for all to authenticated using (private.crm_access_approved()) with check (private.crm_access_approved())',
      'Approved BD members can access CRM data', crm_table
    );
  end loop;
end
$$;
