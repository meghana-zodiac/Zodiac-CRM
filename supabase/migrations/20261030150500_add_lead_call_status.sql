alter table public.leads
  add column if not exists call_status text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_call_status_check'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_call_status_check
      check (
        call_status is null or call_status = any (
          array[
            'Interested'::text,
            'Not Interested'::text,
            'Follow-up Required'::text,
            'Call Back'::text,
            'No Response'::text,
            'Busy'::text,
            'Wrong Number'::text,
            'Converted / Closed'::text
          ]
        )
      );
  end if;
end
$$;

comment on column public.leads.call_status is
  'Latest BD calling outcome for the lead; separate from pipeline status.';
