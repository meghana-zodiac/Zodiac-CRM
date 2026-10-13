-- Administrator-controlled device enrolment for Zodiac CRM.
-- Existing users remain unaffected until an administrator enables the
-- requirement for that member, allowing a safe staged rollout.
create extension if not exists pgcrypto with schema extensions;

alter table public.bd_team_members
  add column if not exists device_access_required boolean not null default false;

create table if not exists public.crm_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.bd_team_members(id) on delete cascade,
  device_label text not null,
  device_type text not null check (device_type in ('laptop', 'mobile', 'tablet', 'other')),
  browser text,
  operating_system text,
  token_hash text not null unique,
  approved_by uuid not null references public.bd_team_members(id),
  approved_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 months'),
  last_seen_at timestamptz,
  last_ip inet,
  revoked_at timestamptz,
  revoked_by uuid references public.bd_team_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_devices_user_active_idx
  on public.crm_devices (user_id, expires_at)
  where revoked_at is null;

create table if not exists public.crm_device_enrollment_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.bd_team_members(id) on delete cascade,
  code_hash text not null,
  created_by uuid not null references public.bd_team_members(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists crm_device_enrollment_codes_lookup_idx
  on public.crm_device_enrollment_codes (user_id, code_hash, expires_at)
  where used_at is null;

alter table public.crm_devices enable row level security;
alter table public.crm_device_enrollment_codes enable row level security;

revoke all on table public.crm_devices from anon, authenticated;
revoke all on table public.crm_device_enrollment_codes from anon, authenticated;

-- Validates the device token supplied by the CRM's Supabase client. The token
-- itself is never stored; only its SHA-256 digest is retained.
create or replace function private.crm_device_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bd_team_members member
    where member.id = (select auth.uid())
      and (
        not member.device_access_required
        or exists (
          select 1
          from public.crm_devices device
          where device.user_id = member.id
            and device.revoked_at is null
            and device.expires_at > now()
            and device.token_hash = encode(
              extensions.digest(
                coalesce(
                  nullif(current_setting('request.headers', true), ''),
                  '{}'
                )::jsonb ->> 'x-zodiac-device-token',
                'sha256'
              ),
              'hex'
            )
        )
      )
  );
$$;

revoke all on function private.crm_device_approved() from public, anon, authenticated;
grant execute on function private.crm_device_approved() to authenticated;

-- Extend the existing approval check so every CRM RLS policy that already
-- calls this function gains device enforcement automatically.
create or replace function private.crm_access_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bd_team_members member
    where member.id = (select auth.uid())
      and member.active
      and member.access_status = 'approved'
  ) and private.crm_device_approved();
$$;

revoke all on function private.crm_access_approved() from public, anon, authenticated;
grant execute on function private.crm_access_approved() to authenticated;

-- Admin-only RLS paths must obey the same device rule once enforcement is on.
create or replace function private.crm_access_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.bd_team_members member
    where member.id = (select auth.uid())
      and member.active
      and member.access_status = 'approved'
      and member.access_role = 'primary_admin'
  ) and private.crm_device_approved();
$$;

revoke all on function private.crm_access_admin() from public, anon, authenticated;
grant execute on function private.crm_access_admin() to authenticated;

-- Primary administrators can enable/disable enforcement for a member. Device
-- records and enrolment codes are modified only by authenticated server
-- functions using the service role.
grant update (device_access_required, updated_at)
  on table public.bd_team_members to authenticated;
