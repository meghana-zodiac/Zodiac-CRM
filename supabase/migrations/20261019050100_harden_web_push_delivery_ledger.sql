create index if not exists activity_push_deliveries_subscription_id_idx
  on public.activity_push_deliveries (subscription_id);

create policy "Client roles cannot access push delivery ledger"
  on public.activity_push_deliveries
  for all
  to anon, authenticated
  using (false)
  with check (false);
