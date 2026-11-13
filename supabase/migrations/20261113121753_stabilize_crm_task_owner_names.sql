-- CRM owner names are assignment keys. Editable auth metadata must not
-- change an existing member identity or permit duplicate approved owners.
create unique index bd_team_members_approved_owner_name_key
  on public.bd_team_members (lower(btrim(display_name)))
  where active and access_status = 'approved';

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
      updated_at = now();

  return new;
end;
$$;

