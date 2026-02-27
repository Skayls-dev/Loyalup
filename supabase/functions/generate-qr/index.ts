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

	try {
		const supabaseUrl = Deno.env.get('SUPABASE_URL')
		const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
		const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

		if (!supabaseUrl || !anonKey || !serviceRoleKey) {
			return new Response(JSON.stringify({ error: 'Missing Supabase environment variables' }), {
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			})
		}

		const authHeader = req.headers.get('Authorization')
		if (!authHeader?.startsWith('Bearer ')) {
			return new Response(JSON.stringify({ error: 'Missing or invalid Authorization header' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			})
		}

		const jwt = authHeader.replace('Bearer ', '').trim()

		const authClient = createClient(supabaseUrl, anonKey)
		const { data: userData, error: userError } = await authClient.auth.getUser(jwt)

		if (userError || !userData.user) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			})
		}

		const adminClient = createClient(supabaseUrl, serviceRoleKey)

		let fournisseurId = userData.user.user_metadata?.fournisseur_id as string | undefined

		if (!fournisseurId) {
			const { data: fournisseurData, error: fournisseurError } = await adminClient
				.from('fournisseurs')
				.select('id')
				.eq('user_id', userData.user.id)
				.maybeSingle()

			if (fournisseurError) {
				return new Response(JSON.stringify({ error: fournisseurError.message }), {
					status: 400,
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				})
			}

			fournisseurId = fournisseurData?.id
		}

		if (!fournisseurId) {
			return new Response(JSON.stringify({ error: 'Provider profile not found' }), {
				status: 403,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			})
		}

		const nowIso = new Date().toISOString()
		const { error: cleanupError } = await adminClient
			.from('qr_tokens')
			.update({ status: 'expired' })
			.eq('fournisseur_id', fournisseurId)
			.eq('status', 'active')
			.lt('expires_at', nowIso)

		if (cleanupError) {
			return new Response(JSON.stringify({ error: cleanupError.message }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			})
		}

		const token = crypto.randomUUID()
		const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString()

		const { error: insertError } = await adminClient.from('qr_tokens').insert({
			fournisseur_id: fournisseurId,
			token,
			status: 'active',
			expires_at: expiresAt,
		})

		if (insertError) {
			return new Response(JSON.stringify({ error: insertError.message }), {
				status: 400,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			})
		}

		return new Response(JSON.stringify({ token, expires_at: expiresAt }), {
			status: 200,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		})
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unexpected error'

		return new Response(JSON.stringify({ error: message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		})
	}
})