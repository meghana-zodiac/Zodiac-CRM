-- One transaction, using the caller's existing ownership/device policies.
-- Stable client IDs make a retry safe without updating an existing record.
create function public.create_client_with_contract(p_client jsonb,p_contract jsonb default null)
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
 expected_client:=to_jsonb(c)-array['created_at','ceipal_id','ceipal_client_number','ceipal_last_synced_at'];
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
