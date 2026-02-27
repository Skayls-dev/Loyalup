import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  const startedAt = performance.now()

  let processed = 0
  let segmentsUpdated = 0

  try {
    const { data: processedValue, error: processError } = await adminClient.rpc('compute_all_segments')
    if (processError) {
      throw processError
    }

    processed = Number(processedValue ?? 0)

    const { data: segmentDistribution, error: distributionError } = await adminClient.rpc('get_segment_distribution')
    if (distributionError) {
      throw distributionError
    }

    const distributionArray = Array.isArray(segmentDistribution) ? segmentDistribution : []
    segmentsUpdated = distributionArray.length

    const period = new Date().toISOString().slice(0, 10)

    await adminClient
      .from('platform_metrics')
      .upsert(
        {
          metric_key: 'segments.distribution',
          metric_value: processed,
          metric_data: { distribution: distributionArray },
          period,
          computed_at: new Date().toISOString(),
        },
        { onConflict: 'metric_key' },
      )

    const durationMs = Math.round(performance.now() - startedAt)

    await adminClient.from('jobs_log').insert({
      job_name: 'compute-segments',
      status: 'success',
      duration_ms: durationMs,
      records_processed: processed,
      details: { segments_updated: segmentsUpdated },
    })

    return new Response(
      JSON.stringify({
        processed,
        duration_ms: durationMs,
        segments_updated: segmentsUpdated,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt)
    const message = error instanceof Error ? error.message : 'Unexpected error'

    await adminClient.from('jobs_log').insert({
      job_name: 'compute-segments',
      status: 'failed',
      duration_ms: durationMs,
      records_processed: processed,
      details: { error: message },
    })

    return new Response(
      JSON.stringify({
        processed,
        duration_ms: durationMs,
        segments_updated: segmentsUpdated,
        error: message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})
