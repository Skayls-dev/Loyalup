import { createClient } from 'npm:@supabase/supabase-js@2'
import type {
  PartnerIdentityDecision,
  PartnerIdentityResolveResponse,
  PartnerIdentitySource,
  PartnerIdentityStatus,
} from './partnerIdentity.ts'

type CaseRow = {
  id: string
  status: PartnerIdentityStatus
  decision: PartnerIdentityDecision
  resolved_loyalup_user_id: string | null
  conflict_reason: string | null
}

type LinkRow = {
  id: string
  loyalup_user_id: string
  link_status: 'active' | 'pending_verification' | 'conflict' | 'merged' | 'revoked' | null
  conflict_reason: string | null
}

export type ResolvePartnerIdentityParams = {
  admin: ReturnType<typeof createClient>
  partnerId: string
  partnerCode: string
  externalUserId: string
  email?: string | null
  displayName?: string
  source?: PartnerIdentitySource
  createIfMissing: boolean
  autoActivate: boolean
}

export async function resolvePartnerIdentity(params: ResolvePartnerIdentityParams): Promise<PartnerIdentityResolveResponse> {
  const {
    admin,
    partnerId,
    partnerCode,
    externalUserId,
    email,
    displayName,
    source = 'partner-api',
    createIfMissing,
    autoActivate,
  } = params

  const normalizedEmail = normalizeOptionalEmail(email)

  const existingLink = await admin
    .from('partner_user_links')
    .select('id, loyalup_user_id, link_status, conflict_reason')
    .eq('partner_id', partnerId)
    .eq('external_user_id', externalUserId)
    .maybeSingle<LinkRow>()

  if (existingLink.error) {
    throw new Error(existingLink.error.message)
  }

  if (existingLink.data?.loyalup_user_id) {
    const mapped = mapLinkStatus(existingLink.data.link_status)
    const decision: PartnerIdentityDecision = mapped === 'resolved' ? 'adopt_existing' : mapped === 'conflict' ? 'blocked_conflict' : 'adopt_existing'
    const nextAction = mapped === 'resolved' ? 'none' : mapped === 'conflict' ? 'manual_review' : 'complete_adoption'

    const currentCase = await ensureCase(admin, {
      partnerId,
      externalUserId,
      status: mapped,
      decision,
      requestedEmail: normalizedEmail,
      requestedDisplayName: displayName,
      resolvedUserId: existingLink.data.loyalup_user_id,
      conflictReason: existingLink.data.conflict_reason,
      source,
    })

    await recordEvent(admin, {
      caseId: currentCase.id,
      partnerId,
      externalUserId,
      eventType: mapped === 'resolved' ? 'linked' : mapped === 'conflict' ? 'conflict_detected' : 'decision_computed',
      fromStatus: currentCase.status,
      toStatus: mapped,
      actorType: 'system',
      payload: { decision, source, existing_link: true },
    })

    return {
      success: true,
      case_id: currentCase.id,
      partner_id: partnerId,
      external_user_id: externalUserId,
      status: mapped,
      decision,
      next_action: nextAction,
      loyalup_user_id: existingLink.data.loyalup_user_id,
      requires_verification: mapped === 'pending_verification',
      conflict_reason: existingLink.data.conflict_reason,
      message: mapped === 'resolved' ? 'Partner user link already resolved' : 'Partner user link requires follow-up',
    }
  }

  if (!createIfMissing) {
    const createdCase = await ensureCase(admin, {
      partnerId,
      externalUserId,
      status: 'pending_verification',
      decision: 'adopt_existing',
      requestedEmail: normalizedEmail,
      requestedDisplayName: displayName,
      resolvedUserId: null,
      conflictReason: null,
      source,
    })

    await recordEvent(admin, {
      caseId: createdCase.id,
      partnerId,
      externalUserId,
      eventType: 'case_opened',
      fromStatus: createdCase.status,
      toStatus: 'pending_verification',
      actorType: 'system',
      payload: { decision: 'adopt_existing', source, create_if_missing: false },
    })

    return {
      success: true,
      case_id: createdCase.id,
      partner_id: partnerId,
      external_user_id: externalUserId,
      status: 'pending_verification',
      decision: 'adopt_existing',
      next_action: 'complete_adoption',
      loyalup_user_id: null,
      requires_verification: true,
      conflict_reason: null,
      message: 'Partner user is not linked yet. Adoption flow is required.',
    }
  }

  if (normalizedEmail) {
    const profileByEmail = await admin
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle<{ id: string }>()

    if (profileByEmail.error) {
      throw new Error(profileByEmail.error.message)
    }

    if (profileByEmail.data?.id) {
      const conflictLink = await admin
        .from('partner_user_links')
        .select('id, external_user_id')
        .eq('partner_id', partnerId)
        .eq('loyalup_user_id', profileByEmail.data.id)
        .neq('external_user_id', externalUserId)
        .limit(1)
        .maybeSingle<{ id: string; external_user_id: string }>()

      if (conflictLink.error) {
        throw new Error(conflictLink.error.message)
      }

      if (conflictLink.data?.id) {
        const reason = `loyalup_user_id already linked to external_user_id=${conflictLink.data.external_user_id}`
        const conflictCase = await ensureCase(admin, {
          partnerId,
          externalUserId,
          status: 'conflict',
          decision: 'blocked_conflict',
          requestedEmail: normalizedEmail,
          requestedDisplayName: displayName,
          resolvedUserId: profileByEmail.data.id,
          conflictReason: reason,
          source,
        })

        await recordEvent(admin, {
          caseId: conflictCase.id,
          partnerId,
          externalUserId,
          eventType: 'conflict_detected',
          fromStatus: conflictCase.status,
          toStatus: 'conflict',
          actorType: 'system',
          payload: { source, conflict_with_external_user_id: conflictLink.data.external_user_id },
        })

        return {
          success: true,
          case_id: conflictCase.id,
          partner_id: partnerId,
          external_user_id: externalUserId,
          status: 'conflict',
          decision: 'blocked_conflict',
          next_action: 'manual_review',
          loyalup_user_id: profileByEmail.data.id,
          requires_verification: false,
          conflict_reason: reason,
          message: 'Identity conflict detected. Manual review is required.',
        }
      }

      const adoptStatus: PartnerIdentityStatus = autoActivate ? 'resolved' : 'pending_verification'
      const linkMethod = autoActivate ? 'adopt_existing' : 'adopt_existing'
      const now = new Date().toISOString()

      const upsertLink = await admin
        .from('partner_user_links')
        .upsert({
          partner_id: partnerId,
          external_user_id: externalUserId,
          loyalup_user_id: profileByEmail.data.id,
          link_status: adoptStatus === 'resolved' ? 'active' : 'pending_verification',
          link_method: linkMethod,
          source,
          verified_at: autoActivate ? now : null,
          last_status_change_at: now,
          conflict_reason: null,
          metadata: {
            linked_via: 'partner-identity-resolve',
            adopted_by_email: normalizedEmail,
            linked_at: now,
          },
        }, { onConflict: 'partner_id,external_user_id' })

      if (upsertLink.error) {
        throw new Error(upsertLink.error.message)
      }

      const adoptCase = await ensureCase(admin, {
        partnerId,
        externalUserId,
        status: adoptStatus,
        decision: 'adopt_existing',
        requestedEmail: normalizedEmail,
        requestedDisplayName: displayName,
        resolvedUserId: profileByEmail.data.id,
        conflictReason: null,
        source,
      })

      await recordEvent(admin, {
        caseId: adoptCase.id,
        partnerId,
        externalUserId,
        eventType: adoptStatus === 'resolved' ? 'linked' : 'verification_sent',
        fromStatus: adoptCase.status,
        toStatus: adoptStatus,
        actorType: 'system',
        payload: { source, adopted_email: normalizedEmail },
      })

      return {
        success: true,
        case_id: adoptCase.id,
        partner_id: partnerId,
        external_user_id: externalUserId,
        status: adoptStatus,
        decision: 'adopt_existing',
        next_action: adoptStatus === 'resolved' ? 'none' : 'send_verification',
        loyalup_user_id: profileByEmail.data.id,
        requires_verification: adoptStatus !== 'resolved',
        conflict_reason: null,
        message: adoptStatus === 'resolved' ? 'Existing account adopted' : 'Existing account matched; verification required',
      }
    }
  }

  const shadow = await createShadowLinkedUser(admin, {
    partnerId,
    partnerCode,
    externalUserId,
    email: normalizedEmail,
    displayName,
    autoActivate,
    source,
  })

  const shadowStatus: PartnerIdentityStatus = autoActivate ? 'resolved' : 'pending_verification'
  const shadowDecision: PartnerIdentityDecision = 'create_shadow'
  const shadowCase = await ensureCase(admin, {
    partnerId,
    externalUserId,
    status: shadowStatus,
    decision: shadowDecision,
    requestedEmail: normalizedEmail,
    requestedDisplayName: displayName,
    resolvedUserId: shadow.loyalupUserId,
    conflictReason: null,
    source,
  })

  await recordEvent(admin, {
    caseId: shadowCase.id,
    partnerId,
    externalUserId,
    eventType: shadowStatus === 'resolved' ? 'linked' : 'verification_sent',
    fromStatus: shadowCase.status,
    toStatus: shadowStatus,
    actorType: 'system',
    payload: { source, auto_activate: autoActivate },
  })

  return {
    success: true,
    case_id: shadowCase.id,
    partner_id: partnerId,
    external_user_id: externalUserId,
    status: shadowStatus,
    decision: shadowDecision,
    next_action: shadowStatus === 'resolved' ? 'none' : 'send_verification',
    loyalup_user_id: shadow.loyalupUserId,
    requires_verification: shadowStatus !== 'resolved',
    conflict_reason: null,
    message: shadowStatus === 'resolved' ? 'Shadow account created and linked' : 'Shadow account created; verification required',
  }
}

function mapLinkStatus(value: LinkRow['link_status']): PartnerIdentityStatus {
  if (value === 'active') return 'resolved'
  if (value === 'pending_verification') return 'pending_verification'
  if (value === 'conflict') return 'conflict'
  if (value === 'merged') return 'merged'
  if (value === 'revoked') return 'rejected'
  return 'pending_verification'
}

async function ensureCase(
  admin: ReturnType<typeof createClient>,
  input: {
    partnerId: string
    externalUserId: string
    status: PartnerIdentityStatus
    decision: PartnerIdentityDecision
    requestedEmail: string | null
    requestedDisplayName?: string
    resolvedUserId: string | null
    conflictReason: string | null
    source: PartnerIdentitySource
  },
): Promise<CaseRow> {
  const openCase = await admin
    .from('partner_identity_cases')
    .select('id, status, decision, resolved_loyalup_user_id, conflict_reason')
    .eq('partner_id', input.partnerId)
    .eq('external_user_id', input.externalUserId)
    .in('status', ['pending_verification', 'conflict'])
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle<CaseRow>()

  if (openCase.error) {
    throw new Error(openCase.error.message)
  }

  if (openCase.data?.id) {
    const updated = await admin
      .from('partner_identity_cases')
      .update({
        status: input.status,
        decision: input.decision,
        requested_email: input.requestedEmail,
        requested_display_name: input.requestedDisplayName ?? null,
        resolved_loyalup_user_id: input.resolvedUserId,
        conflict_reason: input.conflictReason,
        source: input.source,
        resolved_at: input.status === 'resolved' || input.status === 'merged' || input.status === 'rejected'
          ? new Date().toISOString()
          : null,
      })
      .eq('id', openCase.data.id)
      .select('id, status, decision, resolved_loyalup_user_id, conflict_reason')
      .single<CaseRow>()

    if (updated.error) {
      throw new Error(updated.error.message)
    }

    return updated.data
  }

  const inserted = await admin
    .from('partner_identity_cases')
    .insert({
      partner_id: input.partnerId,
      external_user_id: input.externalUserId,
      status: input.status,
      decision: input.decision,
      requested_email: input.requestedEmail,
      requested_display_name: input.requestedDisplayName ?? null,
      resolved_loyalup_user_id: input.resolvedUserId,
      conflict_reason: input.conflictReason,
      source: input.source,
      resolved_at: input.status === 'resolved' || input.status === 'merged' || input.status === 'rejected'
        ? new Date().toISOString()
        : null,
    })
    .select('id, status, decision, resolved_loyalup_user_id, conflict_reason')
    .single<CaseRow>()

  if (inserted.error) {
    throw new Error(inserted.error.message)
  }

  return inserted.data
}

async function recordEvent(
  admin: ReturnType<typeof createClient>,
  input: {
    caseId: string
    partnerId: string
    externalUserId: string
    eventType:
      | 'case_opened'
      | 'decision_computed'
      | 'verification_sent'
      | 'verification_succeeded'
      | 'verification_failed'
      | 'linked'
      | 'conflict_detected'
      | 'merge_requested'
      | 'merged'
      | 'rejected'
      | 'closed'
      | 'note_added'
    fromStatus: string | null
    toStatus: string | null
    actorType: 'system' | 'partner' | 'user' | 'admin'
    payload: Record<string, unknown>
  },
) {
  const insert = await admin.from('partner_identity_events').insert({
    case_id: input.caseId,
    partner_id: input.partnerId,
    external_user_id: input.externalUserId,
    event_type: input.eventType,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    actor_type: input.actorType,
    payload: input.payload,
  })

  if (insert.error) {
    throw new Error(insert.error.message)
  }
}

async function createShadowLinkedUser(
  admin: ReturnType<typeof createClient>,
  params: {
    partnerId: string
    partnerCode: string
    externalUserId: string
    email: string | null
    displayName?: string
    autoActivate: boolean
    source: PartnerIdentitySource
  },
): Promise<{ loyalupUserId: string }> {
  const generatedEmail = params.email || `${params.partnerCode.toLowerCase()}.${sanitizeEmailPart(params.externalUserId)}.${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}@partner.loyalup.local`
  const generatedPassword = `P-${crypto.randomUUID()}-A1!`

  const created = await admin.auth.admin.createUser({
    email: generatedEmail,
    password: generatedPassword,
    email_confirm: params.autoActivate ? true : params.email ? false : true,
    user_metadata: {
      role: 'client',
      source_partner: params.partnerCode,
      external_user_id: params.externalUserId,
      activation_required: params.autoActivate ? false : !params.email,
    },
  })

  if (created.error || !created.data.user?.id) {
    throw new Error(created.error?.message ?? 'Unable to create linked Looyaal user')
  }

  const loyalupUserId = created.data.user.id
  const resolvedName = params.displayName?.trim() || params.externalUserId
  const now = new Date().toISOString()

  const profileUpsert = await admin.from('profiles').upsert({
    id: loyalupUserId,
    email: generatedEmail,
    role: 'client',
    nom: resolvedName,
  }, { onConflict: 'id' })

  if (profileUpsert.error) {
    throw new Error(profileUpsert.error.message)
  }

  const linkUpsert = await admin.from('partner_user_links').upsert({
    partner_id: params.partnerId,
    external_user_id: params.externalUserId,
    loyalup_user_id: loyalupUserId,
    link_status: params.autoActivate ? 'active' : 'pending_verification',
    link_method: 'auto_create',
    source: params.source,
    verified_at: params.autoActivate ? now : null,
    last_status_change_at: now,
    metadata: {
      linked_via: 'partner-identity-resolve',
      auto_linked_by: 'partner-identity-resolve',
      linked_at: now,
    },
  }, { onConflict: 'partner_id,external_user_id' })

  if (linkUpsert.error) {
    throw new Error(linkUpsert.error.message)
  }

  return { loyalupUserId }
}

function sanitizeEmailPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40) || 'user'
}

function normalizeOptionalEmail(value?: string | null): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  const basicEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return basicEmailPattern.test(normalized) ? normalized : null
}
