-- Try to enable required extensions, then schedule daily-jobs HTTP trigger.

do $$
begin
  begin
    create extension if not exists pg_net;
  exception
    when others then
      raise notice 'Could not enable pg_net: %', sqlerrm;
  end;

  begin
    create extension if not exists pg_cron;
  exception
    when others then
      raise notice 'Could not enable pg_cron: %', sqlerrm;
  end;
end
$$;

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
    raise notice 'Skipping schedule: pg_cron and/or pg_net still unavailable.';
  end if;
exception
  when others then
    raise notice 'Scheduling failed: %', sqlerrm;
end
$$;
