export async function dispatchWebhookEvent(params: {
  fournisseur_id: string
  event_type: string
  payload: Record<string, unknown>
}) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const dispatchToken = Deno.env.get('WEBHOOK_DISPATCH_TOKEN')

  if (!supabaseUrl || !dispatchToken) {
    return
  }

  try {
    await fetch(`${supabaseUrl}/functions/v1/dispatch-webhooks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dispatchToken}`,
      },
      body: JSON.stringify(params),
    })
  } catch {
    return
  }
}
