export type PartnerIdentityStatus =
  | 'pending_verification'
  | 'resolved'
  | 'conflict'
  | 'merged'
  | 'rejected'

export type PartnerIdentityDecision =
  | 'create_shadow'
  | 'adopt_existing'
  | 'merge_required'
  | 'blocked_conflict'

export type PartnerIdentityNextAction =
  | 'send_verification'
  | 'complete_adoption'
  | 'manual_review'
  | 'merge_accounts'
  | 'none'

export type PartnerIdentityResolveRequest = {
  partner_id?: string
  partner_code?: string
  external_user_id: string
  email?: string
  display_name?: string
  source?: 'partner-api' | 'admin-console' | 'support-tool' | 'user-self-serve'
  metadata?: Record<string, unknown>
}

export type PartnerIdentityResolveResponse = {
  success: boolean
  case_id: string
  partner_id: string
  external_user_id: string
  status: PartnerIdentityStatus
  decision: PartnerIdentityDecision
  next_action: PartnerIdentityNextAction
  loyalup_user_id: string | null
  requires_verification: boolean
  conflict_reason: string | null
  message: string | null
}
