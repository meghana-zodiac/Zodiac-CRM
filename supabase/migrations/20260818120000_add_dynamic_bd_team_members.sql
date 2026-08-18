create schema if not exists private;

create table if not exists public.bd_team_members (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bd_team_members enable row level security;

revoke all on table public.bd_team_members from anon;
grant select on table public.bd_team_members to authenticated;

drop policy if exists "Zodiac users can view BD team members" on public.bd_team_members;
create policy "Zodiac users can view BD team members"
on public.bd_team_members
for select
to authenticated
using (public.is_zodiac_google_workspace_user());

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

  insert into public.bd_team_members (id, email, display_name, active, updated_at)
  values (new.id, lower(new.email), resolved_name, true, now())
  on conflict (id) do update
  set email = excluded.email,
      display_name = excluded.display_name,
      active = true,
      updated_at = now();

  return new;
end;
$$;

revoke all on function private.sync_bd_team_member() from public, anon, authenticated;

drop trigger if exists sync_bd_team_member_after_auth_change on auth.users;
create trigger sync_bd_team_member_after_auth_change
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function private.sync_bd_team_member();

insert into public.bd_team_members (id, email, display_name, active, updated_at)
select
  id,
  lower(email),
  coalesce(
    nullif(trim(raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(raw_user_meta_data ->> 'name'), ''),
    initcap(replace(replace(split_part(email, '@', 1), '.', ' '), '_', ' '))
  ),
  true,
  now()
from auth.users
where lower(coalesce(email, '')) like '%@zodiachrc.com'
on conflict (id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    active = true,
    updated_at = now();
