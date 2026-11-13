begin;
do $test$
declare
  member record;
  other_name text;
  expected_tasks integer;
  total_tasks integer;
  total_other_activities integer;
  actual integer;
  changed integer;
  task_id uuid;
  denied boolean;
begin
  -- Isolate task authorization from the separate device-token prerequisite.
  -- This fixture is invisible to other transactions and is rolled back.
  update public.bd_team_members set device_access_required=false where active and access_status='approved';
  select count(*) into total_tasks from public.activities where activity_type = 'Task';
  select count(*) into total_other_activities from public.activities where activity_type is distinct from 'Task';
  for member in select id, display_name, access_role from public.bd_team_members where active and access_status = 'approved'
  loop
    select display_name into other_name from public.bd_team_members where active and access_status='approved' and id <> member.id limit 1;
    select count(*) into expected_tasks from public.activities where activity_type='Task' and lower(btrim(owner_name))=lower(btrim(member.display_name));
    -- Simulate the editable profile metadata used by Auth's update-user API.
    update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('full_name', other_name, 'name', other_name) where id=member.id;
    if (select display_name from public.bd_team_members where id=member.id) <> member.display_name then
      raise exception 'Profile metadata changed task ownership';
    end if;
    perform set_config('request.jwt.claim.sub', member.id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub',member.id,'role','authenticated')::text,true);
    execute 'set local role authenticated';
    select count(*) into actual from public.activities where activity_type='Task';
    if actual <> (case when member.access_role='primary_admin' then total_tasks else expected_tasks end) then
      raise exception 'Task visibility failed for %: %', member.display_name,actual;
    end if;
    select count(*) into actual from public.activities where activity_type is distinct from 'Task';
    if actual <> total_other_activities then raise exception 'Non-task access changed'; end if;
    insert into public.activities(title,activity_type,status,owner_name) values ('Ownership access verification (rolled back)','Task','Pending',member.display_name) returning id into task_id;
    update public.activities set status='Completed' where id=task_id;
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'Own task update failed'; end if;
    if member.access_role <> 'primary_admin' then
      update public.activities set status=status where activity_type='Task' and lower(btrim(owner_name)) <> lower(btrim(member.display_name));
      get diagnostics changed = row_count;
      if changed <> 0 then raise exception 'Cross-owner update allowed'; end if;
      delete from public.activities where activity_type='Task' and lower(btrim(owner_name)) <> lower(btrim(member.display_name));
      get diagnostics changed = row_count;
      if changed <> 0 then raise exception 'Cross-owner deletion allowed'; end if;
      denied := false;
      begin
        update public.activities set owner_name=other_name where id=task_id;
      exception when insufficient_privilege then denied := true;
      end;
      if not denied then raise exception 'Cross-owner reassignment allowed'; end if;
      denied := false;
      begin
        insert into public.activities(title,activity_type,status,owner_name) values ('Denied ownership test','Task','Pending',other_name);
      exception when insufficient_privilege then denied := true;
      end;
      if not denied then raise exception 'Cross-owner creation allowed'; end if;
      denied := false;
      begin
        update public.activities set owner_name=null where id=task_id;
      exception when insufficient_privilege then denied := true;
      end;
      if not denied then raise exception 'Removing task ownership allowed'; end if;
    else
      update public.activities set owner_name=other_name where id=task_id;
      get diagnostics changed = row_count;
      if changed <> 1 then raise exception 'Admin reassignment failed'; end if;
    end if;
    delete from public.activities where id=task_id;
    get diagnostics changed = row_count;
    if changed <> 1 then raise exception 'Own/admin delete failed'; end if;
    execute 'reset role';
  end loop;
end $test$;
rollback;
select 'PASS: all five approved users verified for visibility, own-task CRUD, cross-owner blocks, admin assignment and unchanged non-task access. All test writes rolled back.' as result;
