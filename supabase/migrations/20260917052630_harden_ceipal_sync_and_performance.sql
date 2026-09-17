insert into public.ceipal_sync_state (
  sync_key,
  next_page,
  status,
  total_synced,
  last_error,
  updated_at
)
values ('leads', 1, 'idle', 0, null, now())
on conflict (sync_key) do nothing;

create index if not exists bd_team_members_reviewed_by_idx
  on public.bd_team_members (reviewed_by);

drop policy if exists "Members can view access status" on public.bd_team_members;
create policy "Members can view access status"
  on public.bd_team_members
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or private.crm_access_admin()
    or (private.crm_access_approved() and active and access_status = 'approved')
  );

drop policy if exists "Zodiac users can update their own CAG monthly summary"
  on public.cag_monthly_summary;
create policy "Zodiac users can update their own CAG monthly summary"
  on public.cag_monthly_summary
  for update
  to authenticated
  using (
    team_member <> 'Total CAG'
    and exists (
      select 1
      from public.bd_team_members member
      where lower(member.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
        and (
          member.display_name = cag_monthly_summary.team_member
          or (member.display_name = 'Nuzhat K' and cag_monthly_summary.team_member = 'Nuzhat')
        )
        and member.active
    )
  )
  with check (
    team_member <> 'Total CAG'
    and exists (
      select 1
      from public.bd_team_members member
      where lower(member.email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
        and (
          member.display_name = cag_monthly_summary.team_member
          or (member.display_name = 'Nuzhat K' and cag_monthly_summary.team_member = 'Nuzhat')
        )
        and member.active
    )
  );
