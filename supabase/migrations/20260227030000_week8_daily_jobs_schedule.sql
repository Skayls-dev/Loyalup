create or replace function public.run_daily_maintenance_jobs()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_segments integer := 0;
  v_benchmarks integer := 0;
  v_expired_qr integer := 0;
  v_cancelled_pending integer := 0;
  v_alerts integer := 0;
  v_metrics jsonb := '{}'::jsonb;
begin
  v_segments := coalesce(public.compute_all_segments(), 0);
  insert into public.jobs_log (job_name, status, records_processed, details)
  values ('daily:recompute_segments', 'success', v_segments, '{}'::jsonb);

  v_benchmarks := coalesce(public.recompute_provider_benchmarks(), 0);
  insert into public.jobs_log (job_name, status, records_processed, details)
  values ('daily:recompute_benchmarks', 'success', v_benchmarks, '{}'::jsonb);

  v_expired_qr := coalesce(public.expire_old_qr_tokens(), 0);
  insert into public.jobs_log (job_name, status, records_processed, details)
  values ('daily:expire_qr_tokens', 'success', v_expired_qr, '{}'::jsonb);

  v_cancelled_pending := coalesce(public.cancel_expired_pending_transactions(), 0);
  insert into public.jobs_log (job_name, status, records_processed, details)
  values ('daily:cancel_pending_transactions', 'success', v_cancelled_pending, '{}'::jsonb);

  v_metrics := coalesce(public.compute_platform_metrics_snapshot(), '{}'::jsonb);
  insert into public.jobs_log (job_name, status, records_processed, details)
  values ('daily:compute_platform_metrics', 'success', 1, jsonb_build_object('snapshot', v_metrics));

  v_alerts := coalesce(public.create_at_risk_provider_alerts(), 0);
  insert into public.jobs_log (job_name, status, records_processed, details)
  values ('daily:at_risk_provider_alerts', 'success', v_alerts, '{}'::jsonb);

  return jsonb_build_object(
    'segments', v_segments,
    'benchmarks', v_benchmarks,
    'expired_qr_tokens', v_expired_qr,
    'cancelled_pending_transactions', v_cancelled_pending,
    'alerts', v_alerts,
    'metrics', v_metrics
  );
exception
  when others then
    insert into public.jobs_log (job_name, status, records_processed, details)
    values (
      'daily:maintenance',
      'failed',
      0,
      jsonb_build_object('error', sqlerrm)
    );
    raise;
end;
$$;

revoke all on function public.run_daily_maintenance_jobs() from public;
grant execute on function public.run_daily_maintenance_jobs() to service_role;

-- Best effort scheduling for environments that have pg_cron enabled.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('week8-daily-maintenance');
    perform cron.schedule(
      'week8-daily-maintenance',
      '5 2 * * *',
      'select public.run_daily_maintenance_jobs();'
    );

    perform cron.unschedule('week8-platform-metrics-30min');
    perform cron.schedule(
      'week8-platform-metrics-30min',
      '*/30 * * * *',
      'select public.compute_platform_metrics_snapshot();'
    );
  end if;
exception
  when others then
    null;
end $$;
