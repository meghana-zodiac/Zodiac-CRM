alter table public.bd_team_members
  add column if not exists mobile_number text;

grant update (mobile_number, updated_at)
  on table public.bd_team_members to authenticated;

comment on column public.bd_team_members.mobile_number is
  'Work mobile number used in CRM-generated employee signatures.';
