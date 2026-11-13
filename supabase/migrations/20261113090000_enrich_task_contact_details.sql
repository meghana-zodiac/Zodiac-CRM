create or replace function public.enrich_task_contact_details()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_name text;
  v_phone text;
  v_phone_2 text;
  v_landline text;
  v_email text;
  v_email_2 text;
begin
  if new.activity_type::text <> 'Task' or new.related_to_id is null then
    return new;
  end if;

  if new.related_to_type = 'Corporate Lead' then
    select l.contact_name, l.phone, l.phone_2, l.landline, l.email, l.email_2
      into v_name, v_phone, v_phone_2, v_landline, v_email, v_email_2
    from public.leads l
    where l.id = new.related_to_id;

  elsif new.related_to_type = 'Client Contact' then
    select concat_ws(' ', c.first_name, c.last_name), c.phone, c.phone_2, c.landline, c.email, null
      into v_name, v_phone, v_phone_2, v_landline, v_email, v_email_2
    from public.contacts c
    where c.id = new.related_to_id;

  elsif new.related_to_type = 'Client' then
    select
      coalesce(nullif(concat_ws(' ', c.first_name, c.last_name), ''), a.name),
      coalesce(c.phone, a.phone),
      coalesce(c.phone_2, a.phone_2),
      coalesce(c.landline, a.landline),
      c.email,
      null
      into v_name, v_phone, v_phone_2, v_landline, v_email, v_email_2
    from public.accounts a
    left join lateral (
      select c0.*
      from public.contacts c0
      where c0.account_id = a.id
      order by c0.created_at
      limit 1
    ) c on true
    where a.id = new.related_to_id;

  elsif new.related_to_type = 'Proposal' then
    select
      coalesce(nullif(concat_ws(' ', c.first_name, c.last_name), ''), a.name),
      coalesce(c.phone, a.phone),
      coalesce(c.phone_2, a.phone_2),
      coalesce(c.landline, a.landline),
      c.email,
      null
      into v_name, v_phone, v_phone_2, v_landline, v_email, v_email_2
    from public.deals d
    left join public.accounts a on a.id = d.account_id
    left join lateral (
      select c0.*
      from public.contacts c0
      where c0.id = d.contact_id or (d.contact_id is null and c0.account_id = d.account_id)
      order by (c0.id = d.contact_id) desc, c0.created_at
      limit 1
    ) c on true
    where d.id = new.related_to_id;

  elsif new.related_to_type = 'Training Request' then
    select
      coalesce(nullif(concat_ws(' ', c.first_name, c.last_name), ''), tr.client_name, a.name),
      coalesce(c.phone, a.phone),
      coalesce(c.phone_2, a.phone_2),
      coalesce(c.landline, a.landline),
      c.email,
      null
      into v_name, v_phone, v_phone_2, v_landline, v_email, v_email_2
    from public.training_requests tr
    left join public.accounts a on a.id = tr.account_id
    left join lateral (
      select c0.*
      from public.contacts c0
      where c0.account_id = tr.account_id
      order by c0.created_at
      limit 1
    ) c on true
    where tr.id = new.related_to_id;

  elsif new.related_to_type = 'Training Batch' then
    select
      coalesce(nullif(concat_ws(' ', c.first_name, c.last_name), ''), tr.client_name, a.name),
      coalesce(c.phone, a.phone),
      coalesce(c.phone_2, a.phone_2),
      coalesce(c.landline, a.landline),
      c.email,
      null
      into v_name, v_phone, v_phone_2, v_landline, v_email, v_email_2
    from public.training_batches tb
    left join public.training_requests tr on tr.id = tb.request_id
    left join public.accounts a on a.id = tr.account_id
    left join lateral (
      select c0.*
      from public.contacts c0
      where c0.account_id = tr.account_id
      order by c0.created_at
      limit 1
    ) c on true
    where tb.id = new.related_to_id;
  end if;

  new.service_details :=
    (coalesce(new.service_details, '{}'::jsonb)
      - array['contact_name','contact_phone','contact_phone_2','contact_landline','contact_email','contact_email_2']::text[])
    || jsonb_strip_nulls(jsonb_build_object(
      'contact_name', nullif(v_name, ''),
      'contact_phone', nullif(v_phone, ''),
      'contact_phone_2', nullif(v_phone_2, ''),
      'contact_landline', nullif(v_landline, ''),
      'contact_email', nullif(v_email, ''),
      'contact_email_2', nullif(v_email_2, '')
    ));

  return new;
end;
$$;

drop trigger if exists enrich_task_contact_details_trigger on public.activities;
create trigger enrich_task_contact_details_trigger
before insert or update of activity_type, related_to_id, related_to_type
on public.activities
for each row
execute function public.enrich_task_contact_details();

update public.activities
set related_to_id = related_to_id
where activity_type::text = 'Task'
  and related_to_id is not null;