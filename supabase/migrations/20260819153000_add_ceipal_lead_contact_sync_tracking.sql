alter table public.leads
  add column if not exists ceipal_contact_synced_at timestamptz;
