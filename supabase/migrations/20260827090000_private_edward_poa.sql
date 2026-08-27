-- Edward's POA/KRA records are private to his mapped Google Workspace login.
-- Other Zodiac users retain access to records that do not belong to Edward.

drop policy if exists "Zodiac Google Workspace users can access CRM data" on public.poa_entries;
drop policy if exists "Zodiac Google Workspace users can access CRM data" on public.kra_targets;

create policy "Team members can access permitted POA data"
on public.poa_entries
for all
to authenticated
using (
  public.is_zodiac_google_workspace_user()
  and case
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'edward@zodiachrc.com'
      then team_member = 'Edward D'
    else team_member <> 'Edward D'
  end
)
with check (
  public.is_zodiac_google_workspace_user()
  and case
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'edward@zodiachrc.com'
      then team_member = 'Edward D'
    else team_member <> 'Edward D'
  end
);

create policy "Team members can access permitted KRA data"
on public.kra_targets
for all
to authenticated
using (
  public.is_zodiac_google_workspace_user()
  and case
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'edward@zodiachrc.com'
      then team_member = 'Edward D'
    else team_member <> 'Edward D'
  end
)
with check (
  public.is_zodiac_google_workspace_user()
  and case
    when lower(coalesce(auth.jwt() ->> 'email', '')) = 'edward@zodiachrc.com'
      then team_member = 'Edward D'
    else team_member <> 'Edward D'
  end
);
