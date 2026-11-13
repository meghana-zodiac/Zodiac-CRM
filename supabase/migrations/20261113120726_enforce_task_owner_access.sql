-- Approved members retain shared non-task activities. Tasks are private to
-- their assigned CRM member, with full access for approved primary admins.
-- Restrictive policy is ANDed with the existing CRM approval policy.
create policy "Task access is limited to owner or admin"
on public.activities
as restrictive
for all
to authenticated
using (
  activity_type is distinct from 'Task'
  or (select private.crm_access_admin())
  or lower(btrim(owner_name)) in (
    select lower(btrim(member.display_name))
    from public.bd_team_members member
    where member.id = (select auth.uid())
      and member.active
      and member.access_status = 'approved'
  )
)
with check (
  activity_type is distinct from 'Task'
  or (select private.crm_access_admin())
  or lower(btrim(owner_name)) in (
    select lower(btrim(member.display_name))
    from public.bd_team_members member
    where member.id = (select auth.uid())
      and member.active
      and member.access_status = 'approved'
  )
);
