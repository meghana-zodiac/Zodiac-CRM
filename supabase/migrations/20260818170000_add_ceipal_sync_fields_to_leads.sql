alter table public.leads
  add column if not exists ceipal_id text,
  add column if not exists ceipal_last_synced_at timestamptz;

create unique index if not exists leads_ceipal_id_key
  on public.leads (ceipal_id);
