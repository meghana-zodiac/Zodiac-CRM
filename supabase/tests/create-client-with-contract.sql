-- All fixtures and devices are rolled back. Run after the migration.
begin;
create temp table creation_members as
 select id,display_name,access_role,device_access_required,gen_random_uuid()::text||gen_random_uuid()::text as token
 from public.bd_team_members where active and access_status='approved';
grant select on creation_members to authenticated;
insert into public.crm_devices(user_id,device_label,device_type,token_hash,approved_by,expires_at)
 select id,'Transactional client creation test','other',encode(extensions.digest(token,'sha256'),'hex'),
 (select id from creation_members where access_role='primary_admin' limit 1),now()+interval '5 minutes' from creation_members;
do $tests$
declare m record; aid uuid; failed_id uuid; cid uuid; rev integer; n integer; blocked boolean; payload jsonb; details jsonb;
begin
 for m in select * from creation_members where display_name in ('Edward D','debarati d') or access_role='primary_admin' loop
  perform set_config('request.jwt.claim.sub',m.id::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',m.id,'role','authenticated')::text,true);
  perform set_config('request.headers',json_build_object('x-zodiac-device-token',m.token)::text,true);
  execute 'set local role authenticated';
  aid:=gen_random_uuid();
  payload:=jsonb_build_object('id',aid,'name','Combined creation fixture','owner_name',m.display_name);
  details:='{"activity_status":"Non-active","recruiter":"Fixture","mandate_received_date":"2026-05-08","terms":"8.33% I Pay 30 Days I Replace 90 Days"}'::jsonb;
  if public.create_client_with_contract(payload,details)<>aid then raise exception 'Wrong client ID'; end if;
  select id,revision into cid,rev from public.client_contracts where account_id=aid;
  if cid is null or rev<>1 then raise exception 'Contract not saved'; end if;
  if public.create_client_with_contract(payload,details)<>aid then raise exception 'Retry failed'; end if;
  select count(*) into n from public.client_contract_history where contract_id=cid;
  if n<>1 then raise exception 'Retry created duplicate revision'; end if;
  blocked:=false;
  begin perform public.create_client_with_contract(payload||'{"name":"Changed request"}'::jsonb,details); exception when raise_exception then blocked:=true; end;
  if not blocked then raise exception 'Changed retry overwrote existing client'; end if;
  -- The account INSERT happens before the contract's CHECK constraint failure.
  failed_id:=gen_random_uuid(); blocked:=false;
  begin perform public.create_client_with_contract(payload||jsonb_build_object('id',failed_id),'{"activity_status":"Invalid fixture status"}'::jsonb); exception when check_violation then blocked:=true; end;
  if not blocked or exists(select 1 from public.accounts where id=failed_id) then raise exception 'Contract failure left an orphan client'; end if;
  failed_id:=gen_random_uuid();
  perform public.create_client_with_contract(payload||jsonb_build_object('id',failed_id),null);
  if exists(select 1 from public.client_contracts where account_id=failed_id) then raise exception 'Optional contract was invented'; end if;
  if m.access_role<>'primary_admin' then
   blocked:=false;
   begin perform public.create_client_with_contract(payload||jsonb_build_object('id',gen_random_uuid(),'owner_name','Meghana M'),details); exception when insufficient_privilege then blocked:=true; end;
   if not blocked then raise exception 'Cross-owner creation allowed'; end if;
  end if;
  perform set_config('request.headers','{}',true); blocked:=false;
  begin perform public.create_client_with_contract(payload||jsonb_build_object('id',gen_random_uuid()),details); exception when insufficient_privilege then blocked:=true; end;
  if m.device_access_required and not blocked then raise exception 'Unapproved device created client'; end if;
  execute 'reset role';
 end loop;
 if has_function_privilege('anon','public.create_client_with_contract(jsonb,jsonb)','EXECUTE') then raise exception 'Anonymous execution allowed'; end if;
 if (select prosecdef from pg_proc where oid='public.create_client_with_contract(jsonb,jsonb)'::regprocedure) then raise exception 'Function bypasses RLS'; end if;
end $tests$;
rollback;
select 'Combined client creation, retry, rollback, ownership and device checks passed' as result;
