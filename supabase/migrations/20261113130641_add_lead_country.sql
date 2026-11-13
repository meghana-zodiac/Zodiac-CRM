-- Unknown countries stay unset; no country is inferred from phone numbers or city.
alter table public.leads add column country text;
comment on column public.leads.country is 'Country of the company or property, independently of contact phone country code.';
