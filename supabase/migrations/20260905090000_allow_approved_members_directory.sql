drop policy if exists "Members can view access status" on public.bd_team_members;

create policy "Members can view access status"
on public.bd_team_members
for select
to authenticated
using (
  id = auth.uid()
  or private.crm_access_admin()
  or (
    private.crm_access_approved()
    and active
    and access_status = 'approved'
  )
);
