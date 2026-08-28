-- Preserve all historical POA/KRA values while assigning legacy records to
-- the corresponding Google-login BD profiles.
update public.poa_entries
set team_member = case team_member
  when 'Edward' then 'Edward D'
  when 'Nuzhat' then 'Nuzhat K'
  else team_member
end,
updated_at = now()
where team_member in ('Edward', 'Nuzhat');

update public.kra_targets
set team_member = case team_member
  when 'Edward' then 'Edward D'
  when 'Nuzhat' then 'Nuzhat K'
  else team_member
end,
updated_at = now()
where team_member in ('Edward', 'Nuzhat');
