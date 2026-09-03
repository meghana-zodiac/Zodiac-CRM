-- POA/KRA remains visible to authorized Zodiac BD users. Imported records
-- retain their existing team_member assignment and are not duplicated.

drop policy if exists "Team members can access permitted POA data" on public.poa_entries;
drop policy if exists "Team members can access permitted KRA data" on public.kra_targets;

create policy "Zodiac users can view team POA data"
on public.poa_entries
for select
to authenticated
using (public.is_zodiac_google_workspace_user());

create policy "Zodiac users can add their own POA data"
on public.poa_entries
for insert
to authenticated
with check (
  public.is_zodiac_google_workspace_user()
  and exists (
    select 1 from public.bd_team_members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and member.display_name = team_member
      and member.active
  )
);

create policy "Zodiac users can update their own POA data"
on public.poa_entries
for update
to authenticated
using (
  exists (
    select 1 from public.bd_team_members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and member.display_name = team_member
      and member.active
  )
)
with check (
  exists (
    select 1 from public.bd_team_members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and member.display_name = team_member
      and member.active
  )
);

create policy "Zodiac users can delete their own POA data"
on public.poa_entries
for delete
to authenticated
using (
  exists (
    select 1 from public.bd_team_members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and member.display_name = team_member
      and member.active
  )
);

create policy "Zodiac users can view team KRA data"
on public.kra_targets
for select
to authenticated
using (public.is_zodiac_google_workspace_user());

create policy "Zodiac users can manage their own KRA data"
on public.kra_targets
for all
to authenticated
using (
  exists (
    select 1 from public.bd_team_members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and member.display_name = team_member
      and member.active
  )
)
with check (
  public.is_zodiac_google_workspace_user()
  and exists (
    select 1 from public.bd_team_members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and member.display_name = team_member
      and member.active
  )
);
