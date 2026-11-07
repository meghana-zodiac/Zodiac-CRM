-- Repair CRM usage tracking so audit evidence is recorded reliably.
-- This does not change CRM data access; it only writes the signed-in member's usage evidence.

create or replace function private.crm_usage_actor_approved()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.bd_team_members member
    where member.id = (select auth.uid())
      and member.active
      and member.access_status = 'approved'
  );
$$;

revoke all on function private.crm_usage_actor_approved()
  from public, anon, authenticated;

create or replace function public.record_crm_usage(
  p_session_key text,
  p_device_type text,
  p_browser text,
  p_operating_system text,
  p_route text,
  p_event_type text default null,
  p_action text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if actor_id is null or not private.crm_usage_actor_approved() then
    raise exception 'CRM usage actor is not approved';
  end if;

  if nullif(btrim(p_session_key), '') is null then
    raise exception 'CRM usage session key is required';
  end if;

  if p_device_type not in ('desktop', 'mobile', 'tablet', 'unknown') then
    raise exception 'Invalid CRM usage device type';
  end if;

  insert into public.crm_usage_sessions (
    user_id, session_key, device_type, browser, operating_system,
    current_path, last_seen_at
  )
  values (
    actor_id, p_session_key, p_device_type, nullif(p_browser, ''),
    nullif(p_operating_system, ''), nullif(p_route, ''), now()
  )
  on conflict (user_id, session_key) do update
  set device_type = excluded.device_type,
      browser = excluded.browser,
      operating_system = excluded.operating_system,
      current_path = excluded.current_path,
      last_seen_at = excluded.last_seen_at;

  if nullif(btrim(p_event_type), '') is not null then
    insert into public.crm_usage_events (
      user_id, event_type, action, device_type, browser,
      operating_system, route, source, metadata
    )
    values (
      actor_id,
      p_event_type,
      coalesce(nullif(btrim(p_action), ''), p_event_type),
      p_device_type,
      nullif(p_browser, ''),
      nullif(p_operating_system, ''),
      nullif(p_route, ''),
      'client',
      coalesce(p_metadata, '{}'::jsonb)
    );
  end if;
end;
$$;

revoke all on function public.record_crm_usage(text, text, text, text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.record_crm_usage(text, text, text, text, text, text, text, jsonb)
  to authenticated;

create or replace function private.log_crm_record_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  row_data jsonb;
  old_data jsonb;
  event_name text;
  action_name text;
  label_value text;
  current_device text := 'unknown';
  current_browser text;
  current_os text;
  current_route text;
  extra jsonb := '{}'::jsonb;
begin
  -- The underlying CRM write already passed its own authorization policy.
  -- Audit logging only needs a signed-in, active CRM member and must not
  -- disappear because a device header is unavailable inside a trigger.
  if actor_id is null or not private.crm_usage_actor_approved() then
    return coalesce(new, old);
  end if;

  row_data := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  old_data := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;

  select session.device_type, session.browser, session.operating_system, session.current_path
    into current_device, current_browser, current_os, current_route
  from public.crm_usage_sessions session
  where session.user_id = actor_id
    and session.last_seen_at >= now() - interval '30 minutes'
  order by session.last_seen_at desc
  limit 1;

  current_device := coalesce(current_device, 'unknown');
  label_value := coalesce(
    nullif(row_data ->> 'contact_name', ''),
    nullif(row_data ->> 'company_name', ''),
    nullif(row_data ->> 'name', ''),
    nullif(row_data ->> 'deal_name', ''),
    nullif(row_data ->> 'title', ''),
    nullif(row_data ->> 'course_topic', ''),
    nullif(row_data ->> 'employee_name', ''),
    nullif(row_data ->> 'phone_number', ''),
    'CRM record'
  );

  event_name := case tg_op
    when 'INSERT' then 'record_created'
    when 'UPDATE' then 'record_updated'
    when 'DELETE' then 'record_deleted'
  end;
  action_name := initcap(lower(tg_op)) || ' ' || replace(tg_table_name, '_', ' ');

  if tg_table_name = 'activities' then
    extra := extra || jsonb_build_object(
      'activity_type', row_data ->> 'activity_type',
      'status', row_data ->> 'status'
    );
  end if;

  if tg_table_name = 'leads'
     and tg_op = 'UPDATE'
     and lower(coalesce(old_data ->> 'status', '')) is distinct from
         lower(coalesce(row_data ->> 'status', ''))
  then
    if lower(coalesce(row_data ->> 'status', '')) = 'converted' then
      event_name := 'lead_converted';
      action_name := 'Converted lead to corporate client';
    else
      event_name := 'lead_status_changed';
      action_name := 'Changed lead status';
    end if;
    extra := extra || jsonb_build_object(
      'from_status', old_data ->> 'status',
      'to_status', row_data ->> 'status'
    );
  elsif tg_table_name = 'leads'
        and tg_op = 'UPDATE'
        and coalesce(old_data ->> 'call_status', '') is distinct from
            coalesce(row_data ->> 'call_status', '')
  then
    event_name := 'call_status_changed';
    action_name := 'Changed call status';
    extra := extra || jsonb_build_object(
      'from_status', old_data ->> 'call_status',
      'to_status', row_data ->> 'call_status'
    );
  elsif tg_table_name = 'activities'
        and tg_op = 'UPDATE'
        and coalesce(old_data ->> 'status', '') is distinct from
            coalesce(row_data ->> 'status', '')
        and row_data ->> 'status' = 'Completed'
  then
    event_name := 'activity_completed';
    action_name := 'Completed ' || lower(coalesce(row_data ->> 'activity_type', 'activity'));
  elsif tg_table_name = 'daily_eod_reports' and tg_op = 'INSERT' then
    event_name := 'eod_submitted';
    action_name := 'Submitted daily EOD';
  end if;

  insert into public.crm_usage_events (
    user_id, event_type, action, entity_type, entity_id, entity_label,
    device_type, browser, operating_system, route, source, metadata
  )
  values (
    actor_id,
    event_name,
    action_name,
    tg_table_name,
    nullif(row_data ->> 'id', '')::uuid,
    label_value,
    current_device,
    current_browser,
    current_os,
    current_route,
    'database',
    extra
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.log_crm_record_activity()
  from public, anon, authenticated;
