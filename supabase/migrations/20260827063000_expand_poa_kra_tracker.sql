-- Expand the existing POA/KRA records into the full daily target,
-- achievement, and monthly commercial tracker. Existing columns are retained
-- so previously logged CRM data and reports continue to work.

alter table public.poa_entries
  add column if not exists target_leads integer not null default 0,
  add column if not exists target_follow_up_calls integer not null default 0,
  add column if not exists target_calls_connected integer not null default 0,
  add column if not exists target_proposals_shared integer not null default 0,
  add column if not exists target_vc_meetings integer not null default 0,
  add column if not exists target_f2f_meetings integer not null default 0,
  add column if not exists target_clients_onboarded integer not null default 0,
  add column if not exists actual_leads integer not null default 0,
  add column if not exists follow_up_calls_connected integer not null default 0,
  add column if not exists clients_called integer not null default 0,
  add column if not exists proposals_shared integer not null default 0,
  add column if not exists vc_meetings integer not null default 0,
  add column if not exists f2f_meetings integer not null default 0,
  add column if not exists clients_onboarded integer not null default 0,
  add column if not exists clients_billed integer not null default 0,
  add column if not exists recruitment_revenue numeric not null default 0,
  add column if not exists learning_development_revenue numeric not null default 0,
  add column if not exists other_services_revenue numeric not null default 0;

update public.poa_entries
set
  clients_called = calls_made,
  proposals_shared = proposals_sent,
  recruitment_revenue = actual_revenue
where
  clients_called = 0
  and proposals_shared = 0
  and recruitment_revenue = 0;

create unique index if not exists poa_entries_date_team_member_unique
  on public.poa_entries (date, team_member);

alter table public.kra_targets
  add column if not exists target_clients_billed integer not null default 0,
  add column if not exists target_recruitment_revenue numeric not null default 0,
  add column if not exists target_learning_development_revenue numeric not null default 0,
  add column if not exists target_other_services_revenue numeric not null default 0;

update public.kra_targets
set target_recruitment_revenue = target_revenue
where target_recruitment_revenue = 0 and target_revenue <> 0;

grant select, insert, update, delete on public.poa_entries to authenticated;
grant select, insert, update, delete on public.kra_targets to authenticated;
