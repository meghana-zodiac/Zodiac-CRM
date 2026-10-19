alter table public.leads
  add column if not exists created_by uuid references auth.users(id) on delete set null
  default auth.uid();

create index if not exists leads_created_by_idx on public.leads (created_by);

create or replace function public.create_account_from_converted_lead()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if lower(coalesce(new.status, '')) = 'converted'
     and (tg_op = 'INSERT' or lower(coalesce(old.status, '')) is distinct from 'converted')
     and nullif(trim(new.company_name), '') is not null
     and not exists (
       select 1
       from public.accounts account
       where lower(regexp_replace(trim(account.name), '[^a-z0-9]+', '', 'g')) =
             lower(regexp_replace(trim(new.company_name), '[^a-z0-9]+', '', 'g'))
     )
  then
    insert into public.accounts (
      name,
      industry,
      phone,
      phone_2,
      landline,
      city,
      owner_name
    )
    values (
      trim(new.company_name),
      new.industry,
      new.phone,
      new.phone_2,
      new.landline,
      new.city,
      new.owner_name
    );
  end if;

  return new;
end;
$$;

drop trigger if exists create_account_when_lead_converted on public.leads;
create trigger create_account_when_lead_converted
after insert or update of status on public.leads
for each row
execute function public.create_account_from_converted_lead();

insert into public.accounts (
  name,
  industry,
  phone,
  phone_2,
  landline,
  city,
  owner_name
)
select
  trim(lead.company_name),
  lead.industry,
  lead.phone,
  lead.phone_2,
  lead.landline,
  lead.city,
  lead.owner_name
from public.leads lead
where lower(coalesce(lead.status, '')) = 'converted'
  and nullif(trim(lead.company_name), '') is not null
  and not exists (
    select 1
    from public.accounts account
    where lower(regexp_replace(trim(account.name), '[^a-z0-9]+', '', 'g')) =
          lower(regexp_replace(trim(lead.company_name), '[^a-z0-9]+', '', 'g'))
  );
