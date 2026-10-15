alter table public.leads
  add column if not exists phone_2 text,
  add column if not exists landline text;

alter table public.accounts
  add column if not exists phone_2 text,
  add column if not exists landline text;

alter table public.contacts
  add column if not exists phone_2 text,
  add column if not exists landline text;
