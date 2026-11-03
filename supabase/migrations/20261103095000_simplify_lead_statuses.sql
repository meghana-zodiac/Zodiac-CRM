update public.leads
set status = case
  when status = 'Qualified' then 'Contacted'
  when status = 'Disqualified' then 'Not Interested'
  else status
end,
updated_at = now()
where status in ('Qualified', 'Disqualified');
