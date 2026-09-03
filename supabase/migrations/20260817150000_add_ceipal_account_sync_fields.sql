alter table public.accounts
  add column if not exists ceipal_id text,
  add column if not exists ceipal_client_number text,
  add column if not exists ceipal_last_synced_at timestamptz;

create unique index if not exists accounts_ceipal_id_key
  on public.accounts (ceipal_id)
  where ceipal_id is not null;
