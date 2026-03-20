# Partner Identity Lot 3 Integration

## Goal
Implement the partner-side UX flow "I already have a LoyalUp account" using the LoyalUp identity resolver APIs.

## Endpoints
- `POST /functions/v1/partner-identity-resolve`
- `POST /functions/v1/partner-transfers`

Both endpoints require:
- Header: `X-Partner-Key: <partner_api_key>`

`partner-transfers` additionally requires:
- Header: `Idempotency-Key: <unique_key>`

## Identity Resolve Request
```json
{
  "external_user_id": "ext-123",
  "email": "user@example.com",
  "display_name": "Jane Doe",
  "create_user_if_missing": false,
  "source": "partner-api"
}
```

## Identity Resolve Response Contract
```json
{
  "success": true,
  "identity": {
    "success": true,
    "case_id": "uuid",
    "partner_id": "uuid",
    "external_user_id": "ext-123",
    "status": "resolved|pending_verification|conflict|merged|rejected",
    "decision": "create_shadow|adopt_existing|merge_required|blocked_conflict",
    "next_action": "none|send_verification|complete_adoption|manual_review|merge_accounts",
    "loyalup_user_id": "uuid|null",
    "requires_verification": true,
    "conflict_reason": null,
    "message": "..."
  }
}
```

## Partner UX Mapping
1. `status=resolved`
- Show success state.
- Allow transfer flow immediately.

2. `status=pending_verification`
- Show "Check your email / complete adoption".
- Disable transfer CTA.
- Poll resolve endpoint or provide "Refresh status" button.

3. `status=conflict`
- Show conflict explanation.
- Disable transfer CTA.
- Provide support path (human resolution).

4. `status=merged|rejected`
- Show informational state and support CTA.

## Transfer Guarded Flow
Before credit/debit operations:
1. Call `partner-identity-resolve`.
2. Continue to `partner-transfers` only if `identity.status === "resolved"`.
3. If unresolved, surface `identity.message` and `identity.next_action` to user.

## Error Handling
- 401: partner key invalid/missing.
- 403: partner not active for environment.
- 404/409 on transfers with `status=identity_unresolved`: do not retry blindly, resolve identity first.

## Suggested Frontend States
- Idle
- Resolving identity
- Resolved (ready to transfer)
- Pending verification
- Conflict/manual review
- Transfer success
- Transfer rejected

## Minimal QA Scenarios
1. New external user, `create_user_if_missing=false` -> pending verification.
2. Existing LoyalUp email, no conflict -> adopt existing.
3. Existing LoyalUp user linked to another external id -> conflict.
4. Resolved identity -> transfer accepted.
5. Unresolved identity -> transfer blocked with `identity_unresolved`.
