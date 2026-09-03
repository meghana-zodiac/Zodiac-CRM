drop policy if exists "Zodiac users can update their own CAG monthly summary"
on public.cag_monthly_summary;

create policy "Zodiac users can update their own CAG monthly summary"
on public.cag_monthly_summary
for update
to authenticated
using (
  team_member <> 'Total CAG'
  and exists (
    select 1 from public.bd_team_members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (
        member.display_name = team_member
        or (member.display_name = 'Nuzhat K' and team_member = 'Nuzhat')
      )
      and member.active
  )
)
with check (
  team_member <> 'Total CAG'
  and exists (
    select 1 from public.bd_team_members member
    where lower(member.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and (
        member.display_name = team_member
        or (member.display_name = 'Nuzhat K' and team_member = 'Nuzhat')
      )
      and member.active
  )
);
