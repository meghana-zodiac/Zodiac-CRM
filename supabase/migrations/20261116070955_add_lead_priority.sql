-- Keep qualification status available for existing conversion/reporting workflows.
-- Priority starts unset: a lead's temperature must be chosen by its owner.
alter table public.leads
  add column if not exists priority text
  constraint leads_priority_check check (priority in ('Hot', 'Warm', 'Cold'));
