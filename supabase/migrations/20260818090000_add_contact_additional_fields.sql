alter table public.contacts
  add column if not exists additional_fields jsonb not null default '{}'::jsonb;

comment on column public.contacts.additional_fields is
  'Unmapped source fields preserved during spreadsheet imports.';
