create table if not exists public.daily_eod_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  employee_name text not null,
  report_date date not null default current_date,
  best_outcome text not null default '',
  support_needed text not null default '',
  next_day_priorities text not null default '',
  metrics_snapshot jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  submitted_at timestamptz,
  manager_review text not null default 'pending',
  manager_comments text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_eod_reports_user_date_key unique (user_id, report_date),
  constraint daily_eod_reports_status_check check (status in ('draft', 'submitted')),
  constraint daily_eod_reports_review_check
    check (manager_review in ('pending', 'reviewed', 'coaching_required'))
);

create index if not exists daily_eod_reports_report_date_idx
  on public.daily_eod_reports (report_date desc);
create index if not exists daily_eod_reports_employee_name_idx
  on public.daily_eod_reports (employee_name);

alter table public.daily_eod_reports enable row level security;

revoke all on table public.daily_eod_reports from anon;
grant select, insert, update on table public.daily_eod_reports to authenticated;

drop policy if exists "Members can view own EOD reports" on public.daily_eod_reports;
create policy "Members can view own EOD reports"
on public.daily_eod_reports for select to authenticated
using (
  private.crm_access_approved()
  and ((select auth.uid()) = user_id or private.crm_access_admin())
);

drop policy if exists "Members can create own EOD reports" on public.daily_eod_reports;
create policy "Members can create own EOD reports"
on public.daily_eod_reports for insert to authenticated
with check (
  private.crm_access_approved()
  and (select auth.uid()) = user_id
);

drop policy if exists "Members can update own EOD reports" on public.daily_eod_reports;
create policy "Members can update own EOD reports"
on public.daily_eod_reports for update to authenticated
using (
  private.crm_access_approved()
  and ((select auth.uid()) = user_id or private.crm_access_admin())
)
with check (
  private.crm_access_approved()
  and ((select auth.uid()) = user_id or private.crm_access_admin())
);
