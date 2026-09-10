create table if not exists public.ceipal_sync_state (
  sync_key text primary key,
  next_page integer not null default 1 check (next_page > 0),
  status text not null default 'idle' check (status in ('idle', 'running', 'completed', 'failed')),
  total_synced integer not null default 0 check (total_synced >= 0),
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.ceipal_sync_state enable row level security;

drop policy if exists "Approved BD members can manage CEIPAL sync state"
  on public.ceipal_sync_state;
create policy "Approved BD members can manage CEIPAL sync state"
  on public.ceipal_sync_state
  for all
  to authenticated
  using (private.crm_access_approved())
  with check (private.crm_access_approved());

grant select, insert, update on public.ceipal_sync_state to authenticated;
revoke all on public.ceipal_sync_state from anon;

