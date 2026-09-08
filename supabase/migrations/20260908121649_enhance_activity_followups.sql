alter table public.activities
  add column if not exists priority text not null default 'Medium',
  add column if not exists reminder_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.activities
  drop constraint if exists activities_priority_check;

alter table public.activities
  add constraint activities_priority_check
  check (priority in ('Low', 'Medium', 'High'));

create index if not exists activities_open_due_date_idx
  on public.activities (due_date)
  where status <> 'Completed';

create index if not exists activities_owner_status_due_idx
  on public.activities (owner_name, status, due_date);

create index if not exists activities_reminder_at_idx
  on public.activities (reminder_at)
  where reminder_at is not null and status <> 'Completed';

grant select, insert, update, delete on public.activities to authenticated;

