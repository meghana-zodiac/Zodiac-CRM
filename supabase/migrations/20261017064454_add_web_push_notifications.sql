create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.bd_team_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  user_agent text,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count integer not null default 0,
  revoked_at timestamptz
);

create index if not exists push_subscriptions_user_active_idx
  on public.push_subscriptions (user_id)
  where revoked_at is null;

create table if not exists public.activity_push_deliveries (
  activity_id uuid not null references public.activities(id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  reminder_key text not null,
  status text not null default 'processing'
    check (status in ('processing', 'sent', 'failed')),
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  primary key (activity_id, subscription_id, reminder_key)
);

alter table public.push_subscriptions enable row level security;
alter table public.activity_push_deliveries enable row level security;

grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.activity_push_deliveries from anon, authenticated;

create policy "Members can view their push subscriptions"
  on public.push_subscriptions for select
  to authenticated
  using ((select auth.uid()) = user_id and private.crm_access_approved());

create policy "Members can register their push subscriptions"
  on public.push_subscriptions for insert
  to authenticated
  with check ((select auth.uid()) = user_id and private.crm_access_approved());

create policy "Members can update their push subscriptions"
  on public.push_subscriptions for update
  to authenticated
  using ((select auth.uid()) = user_id and private.crm_access_approved())
  with check ((select auth.uid()) = user_id and private.crm_access_approved());

create policy "Members can remove their push subscriptions"
  on public.push_subscriptions for delete
  to authenticated
  using ((select auth.uid()) = user_id and private.crm_access_approved());

