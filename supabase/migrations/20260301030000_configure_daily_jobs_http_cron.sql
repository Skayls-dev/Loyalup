-- Configure daily pg_cron job to trigger the daily-jobs Edge Function
-- Runs every day at 03:00 UTC

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    perform cron.unschedule('daily-jobs');

    perform cron.schedule(
      'daily-jobs',
      '0 3 * * *',
      $job$
        select net.http_post(
          url := 'https://yyftqivizzgvveeczbpv.supabase.co/functions/v1/daily-jobs',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
          )
        );
      $job$
    );

  else
    raise notice 'Skipping cron setup: pg_cron and/or pg_net extension missing.';
  end if;
exception
  when others then
    raise notice 'daily-jobs cron setup skipped due to error: %', sqlerrm;
end
$$;
