create table if not exists public.cag_monthly_summary (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  team_member text not null,
  clients_acquired_target integer not null default 0,
  clients_acquired_actual integer not null default 0,
  bookings_target numeric not null default 0,
  bookings_actual numeric not null default 0,
  clients_billed_actual integer not null default 0,
  recruitment_revenue_target numeric not null default 0,
  recruitment_revenue_actual numeric not null default 0,
  other_services_revenue_actual numeric not null default 0,
  total_revenue_actual numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (month, team_member)
);

alter table public.cag_monthly_summary enable row level security;

create policy "Zodiac users can view CAG monthly summary"
on public.cag_monthly_summary
for select
to authenticated
using (public.is_zodiac_google_workspace_user());

grant select on public.cag_monthly_summary to authenticated;
