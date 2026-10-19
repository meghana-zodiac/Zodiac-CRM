create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'web-push-dispatch-every-minute';

  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end
$$;

select cron.schedule(
  'web-push-dispatch-every-minute',
  '* * * * *',
  $job$
  select net.http_post(
    url := 'https://crm.zodiachrc.com/api/push/dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'web_push_cron_secret'
        order by created_at desc
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  ) as request_id;
  $job$
);
