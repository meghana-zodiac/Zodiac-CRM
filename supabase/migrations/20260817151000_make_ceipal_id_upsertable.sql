drop index if exists public.accounts_ceipal_id_key;

create unique index accounts_ceipal_id_key
  on public.accounts (ceipal_id);
