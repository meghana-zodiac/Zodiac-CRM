alter table public.bd_team_members
  add column if not exists device_limit integer not null default 2
  check (device_limit between 1 and 10);

update public.bd_team_members
set device_limit = 3,
    updated_at = now()
where lower(email) = 'meghana@zodiachrc.com';
