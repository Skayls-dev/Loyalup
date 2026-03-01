-- Safely recreate daily-jobs cron without failing when no prior job exists.

do $$
declare
  job_row record;
  new_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    for job_row in
      select jobid
      from cron.job
      where jobname = 'daily-jobs'
    loop
      perform cron.unschedule(job_row.jobid);
    end loop;

    select cron.schedule(
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
    ) into new_job_id;

    raise notice 'daily-jobs scheduled with jobid=%', new_job_id;
  else
    raise notice 'Skipping schedule: pg_cron and/or pg_net unavailable.';
  end if;
exception
  when others then
    raise notice 'Failed to configure daily-jobs cron: %', sqlerrm;
end
$$;
