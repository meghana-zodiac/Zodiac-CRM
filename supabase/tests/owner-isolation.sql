begin;
-- Execute in a transaction and ROLLBACK. Fixtures include approved devices;
-- no approval, ownership or device-control function is replaced or disabled.
create temp table isolation_members as select id,display_name,access_role,gen_random_uuid()::text||gen_random_uuid()::text as device_token from public.bd_team_members where active and access_status='approved';
create temp table isolation_records(tbl text,owner_label text,id uuid);
grant select on isolation_members,isolation_records to authenticated;
insert into public.crm_devices(user_id,device_label,device_type,token_hash,approved_by,expires_at)
 select id,'Transactional owner-isolation test','other',encode(extensions.digest(device_token,'sha256'),'hex'),(select id from isolation_members where access_role='primary_admin' limit 1),now()+interval '5 minutes' from isolation_members;

do $fixtures$ declare m record; aid uuid; cid uuid; tid uuid; rid uuid; rowid uuid; table_name text; activity text; begin
for m in select * from isolation_members where display_name in ('Edward D','debarati d') loop
 insert into public.accounts(name,owner_name) values('Isolation fixture '||m.display_name,m.display_name) returning id into aid;
 insert into isolation_records values('accounts',m.display_name,aid);
 insert into public.contacts(last_name,account_id,owner_name) values('Isolation fixture',aid,m.display_name) returning id into cid;
 insert into isolation_records values('contacts',m.display_name,cid);
 insert into public.deals(deal_name,account_id,contact_id,owner_name) values('Isolation fixture',aid,cid,m.display_name) returning id into rowid;
 insert into isolation_records values('deals',m.display_name,rowid);
 insert into public.leads(company_name,owner_name) values('Isolation fixture',m.display_name) returning id into rowid;
 insert into isolation_records values('leads',m.display_name,rowid);
 foreach activity in array array['Task','Meeting','Call'] loop
  insert into public.activities(title,activity_type,owner_name,related_to_type,related_to_id) values('Isolation fixture',activity::public.activity_type,m.display_name,'Client',aid) returning id into rowid;
  insert into isolation_records values('activities',m.display_name,rowid);
 end loop;
 insert into public.call_logs(phone_number,rep_name,call_type) values('0000000000',m.display_name,'Isolation test') returning id into rowid;
 insert into isolation_records values('call_logs',m.display_name,rowid);
 insert into public.poa_entries(date,team_member) values('2099-12-01',m.display_name) returning id into rowid;
 insert into isolation_records values('poa_entries',m.display_name,rowid);
 insert into public.kra_targets(month,team_member) values('December 2099',m.display_name) returning id into rowid;
 insert into isolation_records values('kra_targets',m.display_name,rowid);
 insert into public.cag_monthly_summary(month,team_member) values('2099-12-01',m.display_name) returning id into rowid;
 insert into isolation_records values('cag_monthly_summary',m.display_name,rowid);
 insert into public.cag_targets(owner_name) values(m.display_name) returning id into rowid;
 insert into isolation_records values('cag_targets',m.display_name,rowid);
 insert into public.trainers(full_name,owner_name) values('Isolation fixture',m.display_name) returning id into tid;
 insert into isolation_records values('trainers',m.display_name,tid);
 insert into public.training_requests(course_topic,account_id,trainer_id,owner_name) values('Isolation fixture',aid,tid,m.display_name) returning id into rid;
 insert into isolation_records values('training_requests',m.display_name,rid);
 insert into public.training_batches(batch_code,request_id,trainer_id,owner_name) values('Isolation-'||aid::text,rid,tid,m.display_name) returning id into rowid;
 insert into isolation_records values('training_batches',m.display_name,rowid);
 insert into public.client_contracts(account_id,owner_name,activity_status,terms) values(aid,m.display_name,'Active','Isolation test') returning id into cid;
 insert into isolation_records values('client_contracts',m.display_name,cid);
 insert into isolation_records select 'client_contract_history',m.display_name,id from public.client_contract_history where contract_id=cid;
 insert into public.daily_eod_reports(user_id,employee_name,report_date) values(m.id,m.display_name,'2099-12-01') returning id into rowid;
 insert into isolation_records values('daily_eod_reports',m.display_name,rowid);
end loop;
insert into public.accounts(name) values('Unassigned isolation fixture') returning id into rowid;
insert into isolation_records values('accounts','Unassigned',rowid);
end $fixtures$;

-- Real RLS under authenticated, including existing device approval checks.
do $tests$ declare member record; fixture record; n integer; label text; oldrev integer; before_count integer; own_account uuid; other_account uuid; blocked boolean; current_id uuid; begin
for member in select * from isolation_members where display_name in ('Edward D','debarati d','Nuzhat K') or access_role='primary_admin' loop
 perform set_config('request.jwt.claim.sub',member.id::text,true);
 perform set_config('request.jwt.claims',json_build_object('sub',member.id,'role','authenticated')::text,true);
 perform set_config('request.headers',json_build_object('x-zodiac-device-token',member.device_token)::text,true);
 execute 'set local role authenticated';
 for fixture in select * from isolation_records loop
  execute format('select count(*) from public.%I where id=$1',fixture.tbl) into n using fixture.id;
  if (member.access_role='primary_admin' or fixture.owner_label=member.display_name) and n<>1 then raise exception 'Own/admin read denied: % / %',member.display_name,fixture.tbl; end if;
  if member.access_role<>'primary_admin' and fixture.owner_label<>member.display_name and n<>0 then raise exception 'Cross-user read leaked: % / %',member.display_name,fixture.tbl; end if;
 end loop;
 if member.access_role<>'primary_admin' then
  if exists(select 1 from public.bd_team_members where id<>member.id) then raise exception 'Team directory leaked'; end if;
  if exists(select 1 from public.ceipal_sync_state) then raise exception 'Global sync state leaked'; end if;
  for fixture in select * from isolation_records where tbl in ('accounts','contacts','deals','activities','leads','trainers','training_requests','training_batches','cag_targets','poa_entries','kra_targets','cag_monthly_summary','call_logs','client_contracts') loop
   label:=case when fixture.tbl='call_logs' then 'rep_name' when fixture.tbl in ('poa_entries','kra_targets','cag_monthly_summary') then 'team_member' else 'owner_name' end;
   execute format('update public.%I set %I=%I where id=$1',fixture.tbl,label,label) using fixture.id;
   get diagnostics n=row_count;
   if fixture.owner_label=member.display_name and n<>1 then raise exception 'Own update failed: % / %',member.display_name,fixture.tbl; end if;
   if fixture.owner_label<>member.display_name and n<>0 then raise exception 'Cross-user update allowed: % / %',member.display_name,fixture.tbl; end if;
  end loop;
  -- An employee cannot make one of their rows belong to another member.
  select id into own_account from isolation_records where tbl='accounts' and owner_label=member.display_name limit 1;
  select id into other_account from isolation_records where tbl='accounts' and owner_label<>member.display_name and owner_label<>'Unassigned' limit 1;
  if own_account is not null then
   blocked:=false;
   begin update public.accounts set owner_name='Meghana M' where id=own_account; exception when insufficient_privilege then blocked:=true; end;
   if not blocked then raise exception 'Cross-owner reassignment allowed'; end if;
   -- Own contact cannot link to someone else's account.
   blocked:=false;
   begin insert into public.contacts(last_name,owner_name,account_id) values('Forbidden link',member.display_name,other_account); exception when insufficient_privilege then blocked:=true; end;
   if not blocked then raise exception 'Cross-owner parent link allowed'; end if;
  end if;
  -- Creating on someone else's behalf is rejected even with a known owner label.
  blocked:=false;
  begin insert into public.accounts(name,owner_name) values('Forbidden owner','Meghana M'); exception when insufficient_privilege then blocked:=true; end;
  if not blocked then raise exception 'Cross-owner insert allowed'; end if;
  -- Blank owners are assigned to the authenticated member by the database.
  insert into public.accounts(name,owner_name) values('Own automatic assignment',null) returning id,owner_name into current_id,label;
  if label<>member.display_name then raise exception 'Automatic owner wrong'; end if;
  delete from public.accounts where id=current_id;
 end if;
 execute 'reset role';
end loop;
end $tests$;
-- Legacy aliases resolve only to their actual member; an unapproved device
-- still gets no business records after the new ownership checks are added.
select set_config('request.jwt.claim.sub',(select id::text from isolation_members where display_name='Nuzhat K'),true);
select set_config('request.headers',json_build_object('x-zodiac-device-token',(select device_token from isolation_members where display_name='Nuzhat K'))::text,true);
set local role authenticated;
do $$ begin
 if not private.crm_owner_access('Nuzhat') or private.crm_owner_access('Edward D') or private.crm_owner_access(null) then raise exception 'Legacy alias isolation failed'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub',(select id::text from isolation_members where display_name='Edward D'),true);
select set_config('request.headers','{}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.accounts) or exists(select 1 from public.client_contracts) or exists(select 1 from public.leads) then raise exception 'Unapproved device gained access'; end if;
end $$;
reset role;

rollback;
