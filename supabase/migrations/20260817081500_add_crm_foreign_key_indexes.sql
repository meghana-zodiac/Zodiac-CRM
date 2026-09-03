create index contacts_account_id_idx on public.contacts(account_id);
create index deals_account_id_idx on public.deals(account_id);
create index deals_contact_id_idx on public.deals(contact_id);
create index training_requests_account_id_idx on public.training_requests(account_id);
create index training_requests_trainer_id_idx on public.training_requests(trainer_id);
create index training_batches_request_id_idx on public.training_batches(request_id);
create index training_batches_trainer_id_idx on public.training_batches(trainer_id);
