export type Role = 'client' | 'fournisseur' | 'admin'

export type ConsentType = 'essential' | 'analytics' | 'marketing' | 'third_party'

export type ConsentRecord = {
	id: string
	user_id: string
	consent_type: ConsentType
	granted: boolean
	policy_version: string
	granted_at: string
	revoked_at: string | null
}

export type EventType =
	| 'auth.login'
	| 'auth.logout'
	| 'auth.register'
	| 'client.qr_scan_started'
	| 'client.qr_scan_success'
	| 'client.qr_scan_error'
	| 'client.card_viewed'
	| 'client.history_viewed'
	| 'client.promo_viewed'
	| 'client.promo_clicked'
	| 'client.reward_viewed'
	| 'client.reward_used'
	| 'client.profile_viewed'
	| 'provider.qr_displayed'
	| 'provider.client_scanned'
	| 'provider.transaction_validated'
	| 'provider.transaction_cancelled'
	| 'provider.promo_created'
	| 'provider.service_added'
	| 'provider.dashboard_viewed'
	| 'provider.clients_viewed'
	| 'app.installed'
	| 'app.push_enabled'
	| 'app.push_disabled'
	| 'app.language_changed'
	| 'app.offline_detected'

export type Profile = {
	id: string
	email: string
	role: Role
	nom: string
	created_at: string
}

export type Fournisseur = {
	id: string
	user_id: string
	nom_commerce: string
	adresse: string
	created_at: string
}

export type AuthState = {
	user: {
		id: string
		email: string | null
	} | null
	profile: Profile | null
	role: Role | null
	loading: boolean
	error: string | null
}

export * from './webhooks'
