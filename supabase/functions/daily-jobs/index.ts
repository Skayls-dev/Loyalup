import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type JobResult = {
  name: string
  status: 'success' | 'failed'
  records_processed: number
  duration_ms: number
  details?: Record<string, unknown>
}

async function runJob(
  name: string,
  callback: () => Promise<{ records: number; details?: Record<string, unknown> }>,
): Promise<JobResult> {
  const startedAt = performance.now()

  try {
    const result = await callback()
    return {
      name,
      status: 'success',
      records_processed: result.records,
      duration_ms: Math.round(performance.now() - startedAt),
      details: result.details,
    }
  } catch (error) {
    return {
      name,
      status: 'failed',
      records_processed: 0,
      duration_ms: Math.round(performance.now() - startedAt),
      details: { error: error instanceof Error ? error.message : 'Unexpected error' },
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const jobs = await Promise.all([
    runJob('recompute_segments', async () => {
      const { data, error } = await adminClient.rpc('compute_all_segments')
      if (error) throw error
      return { records: Number(data ?? 0) }
    }),
    runJob('recompute_benchmarks', async () => {
      const { data, error } = await adminClient.rpc('recompute_provider_benchmarks')
      if (error) throw error
      return { records: Number(data ?? 0) }
    }),
    runJob('expire_qr_tokens', async () => {
      const { data, error } = await adminClient.rpc('expire_old_qr_tokens')
      if (error) throw error
      return { records: Number(data ?? 0) }
    }),
    runJob('cancel_pending_transactions', async () => {
      const { data, error } = await adminClient.rpc('cancel_expired_pending_transactions')
      if (error) throw error
      return { records: Number(data ?? 0) }
    }),
    runJob('compute_platform_metrics', async () => {
      const { data, error } = await adminClient.rpc('compute_platform_metrics_snapshot')
      if (error) throw error
      return { records: 1, details: { snapshot: data } }
    }),
    runJob('at_risk_provider_alerts', async () => {
      const { data, error } = await adminClient.rpc('create_at_risk_provider_alerts')
      if (error) throw error
      return { records: Number(data ?? 0) }
    }),
  ])

  await adminClient.from('jobs_log').insert(
    jobs.map((job) => ({
      job_name: `daily:${job.name}`,
      status: job.status,
      duration_ms: job.duration_ms,
      records_processed: job.records_processed,
      details: job.details ?? {},
    })),
  )

  const hasFailure = jobs.some((job) => job.status === 'failed')

  return new Response(
    JSON.stringify({
      ok: !hasFailure,
      jobs,
    }),
    {
      status: hasFailure ? 500 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    },
  )
})
