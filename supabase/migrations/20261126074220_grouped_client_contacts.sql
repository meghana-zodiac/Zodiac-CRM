alter table public.accounts add column priority text check(priority in ('Hot','Warm','Cold'));
alter table public.accounts add column email_addresses text[] not null default '{}';
alter table public.accounts add column notes text;
alter table public.contacts add column email_addresses text[] not null default '{}';
-- One transaction, using the caller's existing ownership/device policies.
-- Stable client IDs make a retry safe without updating an existing record.
create or replace function public.create_client_with_contract(p_client jsonb,p_contract jsonb default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
 c public.accounts;
 saved public.accounts;
 d public.client_contracts;
 existing_contract public.client_contracts;
 expected_client jsonb;
begin
 if auth.uid() is null or not private.crm_access_approved() then
  raise exception 'Approved CRM access is required' using errcode='42501';
 end if;
 if jsonb_typeof(p_client) is distinct from 'object' then raise exception 'Invalid client details'; end if;
 if exists(select 1 from jsonb_each(p_client) x where x.key<>all(array['id','name','industry','client_type','city','website','phone','phone_2','landline','owner_name']) or jsonb_typeof(x.value) not in ('string','null')) then raise exception 'Unsupported client field'; end if;
 c:=jsonb_populate_record(null::public.accounts,p_client);
 c.name:=nullif(btrim(c.name),'');
 c.owner_name:=coalesce(nullif(btrim(c.owner_name),''),private.crm_current_owner());
 if c.id is null or c.name is null then raise exception 'Client name and request ID are required'; end if;
 if p_contract='null'::jsonb then p_contract:=null; end if;
 if p_contract is not null then
  if jsonb_typeof(p_contract) is distinct from 'object' then raise exception 'Invalid contract details'; end if;
  if exists(select 1 from jsonb_each(p_contract) x where x.key<>all(array['activity_status','recruiter','approach_date','visit_date','mandate_received_date','terms','notes']) or jsonb_typeof(x.value) not in ('string','null')) then raise exception 'Unsupported contract field'; end if;
  d:=jsonb_populate_record(null::public.client_contracts,p_contract);
  if c.owner_name is null then raise exception 'Choose a BD owner to save contract details'; end if;
  if nullif(btrim(d.activity_status),'') is null then raise exception 'Choose Active or Non-active for the contract'; end if;
 end if;
 expected_client:=to_jsonb(c)-array['created_at','ceipal_id','ceipal_client_number','ceipal_last_synced_at','priority','email_addresses','notes'];
 insert into public.accounts(id,name,industry,client_type,city,website,phone,phone_2,landline,owner_name)
 values(c.id,c.name,c.industry,c.client_type,c.city,c.website,c.phone,c.phone_2,c.landline,c.owner_name)
 on conflict(id) do nothing returning * into saved;
 if not found then
  select * into saved from public.accounts where id=c.id;
  if not found or not(to_jsonb(saved) @> expected_client) then
   raise exception 'This client request was already saved with different details. Refresh Clients before retrying.';
  end if;
 end if;
 if p_contract is not null then
  insert into public.client_contracts(account_id,owner_name,activity_status,recruiter,approach_date,visit_date,mandate_received_date,terms,notes)
  values(saved.id,saved.owner_name,d.activity_status,d.recruiter,d.approach_date,d.visit_date,d.mandate_received_date,d.terms,d.notes)
  on conflict(account_id) do nothing returning * into existing_contract;
  if not found then
   select * into existing_contract from public.client_contracts where account_id=saved.id;
   if not found or row(existing_contract.owner_name,existing_contract.activity_status,existing_contract.recruiter,existing_contract.approach_date,existing_contract.visit_date,existing_contract.mandate_received_date,existing_contract.terms,existing_contract.notes)
     is distinct from row(saved.owner_name,d.activity_status,d.recruiter,d.approach_date,d.visit_date,d.mandate_received_date,d.terms,d.notes) then
    raise exception 'This client already has different contract details. Refresh Clients before retrying.';
   end if;
  end if;
 end if;
 return saved.id;
end;
$$;
revoke all on function public.create_client_with_contract(jsonb,jsonb) from public,anon;
grant execute on function public.create_client_with_contract(jsonb,jsonb) to authenticated;

create function public.create_client_group(p_client jsonb,p_contract jsonb default null,p_contacts jsonb default '[]')
returns uuid language plpgsql security invoker set search_path='' as $$
declare aid uuid; a public.accounts; c public.contacts; saved public.contacts; item jsonb; was_existing boolean; priority_value text; shared text[]; remarks text;
begin
 if auth.uid() is null or not private.crm_access_approved() then raise exception 'Approved CRM access is required' using errcode='42501'; end if;
 if jsonb_typeof(p_client) is distinct from 'object' or jsonb_typeof(p_contacts) is distinct from 'array' then raise exception 'Invalid client or contacts'; end if;
 aid:=(p_client->>'id')::uuid;
 if aid is null then raise exception 'Request ID required'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(aid::text,0));
 select * into a from public.accounts where id=aid; was_existing:=found;
 priority_value:=nullif(btrim(p_client->>'priority'),''); remarks:=nullif(btrim(p_client->>'notes'),'');
 if p_client ? 'email_addresses' and jsonb_typeof(p_client->'email_addresses') is distinct from 'array' then raise exception 'Company emails must be a list'; end if;
 select coalesce(array_agg(value),'{}') into shared from jsonb_array_elements_text(coalesce(p_client->'email_addresses','[]'::jsonb));
 if was_existing and (row(a.priority,a.email_addresses,a.notes) is distinct from row(priority_value,shared,remarks)) then raise exception 'This request was saved with different company details. Refresh Clients before retrying.'; end if;
 if was_existing and exists(select 1 from public.contacts x where x.account_id=aid and not exists(select 1 from jsonb_array_elements(p_contacts) j where (j->>'id')::uuid=x.id)) then raise exception 'This request already has different contacts. Refresh Clients before retrying.'; end if;
 aid:=public.create_client_with_contract(p_client-array['priority','email_addresses','notes'],p_contract);
 select * into a from public.accounts where id=aid;
 if not was_existing then update public.accounts set priority=priority_value,email_addresses=shared,notes=remarks where id=aid; end if;
 for item in select value from jsonb_array_elements(p_contacts) loop
  if jsonb_typeof(item) is distinct from 'object' or exists(select 1 from jsonb_object_keys(item) k where k<>all(array['id','first_name','last_name','title','phone','landline','email','email_addresses'])) then raise exception 'Unsupported contact details'; end if;
  c:=jsonb_populate_record(null::public.contacts,item); c.account_id:=aid; c.owner_name:=a.owner_name;
  if c.id is null or nullif(btrim(concat_ws(' ',c.first_name,c.last_name)),'') is null then raise exception 'Each HR contact needs a name and request ID'; end if;
  c.email_addresses:=coalesce(c.email_addresses,'{}');
  insert into public.contacts(id,account_id,owner_name,first_name,last_name,title,phone,landline,email,email_addresses)
   values(c.id,c.account_id,c.owner_name,c.first_name,c.last_name,c.title,c.phone,c.landline,c.email,c.email_addresses)
   on conflict(id) do nothing returning * into saved;
  if not found then
   select * into saved from public.contacts where id=c.id;
   if not found or row(saved.account_id,saved.owner_name,saved.first_name,saved.last_name,saved.title,saved.phone,saved.landline,saved.email,saved.email_addresses)
    is distinct from row(c.account_id,c.owner_name,c.first_name,c.last_name,c.title,c.phone,c.landline,c.email,c.email_addresses) then raise exception 'A contact was saved with different details. Refresh Clients before retrying.'; end if;
  end if;
 end loop;
 return aid;
end;
$$;
revoke all on function public.create_client_group(jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.create_client_group(jsonb,jsonb,jsonb) to authenticated;
