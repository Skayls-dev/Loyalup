client1@loyalup.test   client      created f312b2b4-d4df-4b9c-acb0-870667cf2986
client2@loyalup.test   client      created 42979de9-453f-4fe0-941f-71d517de3bf4
provider1@loyalup.test fournisseur created b02a0bc0-ffac-4789-bbd9-f70d31f74921
provider2@loyalup.test fournisseur created 5a89d6b9-3a3d-4f6a-a9f9-acc564bcb193
admin1@loyalup.test    admin       created 91a3ab5d-e6b2-4561-90cc-ab8a7d5bcb6e

client1@loyalup.test — role: client — password: Test1234!
client2@loyalup.test — role: client — password: Test1234!
provider1@loyalup.test — role: fournisseur — password: Test1234!
provider2@loyalup.test — role: fournisseur — password: Test1234!
admin1@loyalup.test — role: admin — password: Test1234! (login via /admin/auth)

---

Local test data provisioning

- Recreate baseline test users (including admin):
	- `node scripts/create-test-users.mjs`
- Seed realistic local data (services, promotions, transactions, points, rewards, consents, events):
	- `node scripts/seed-test-data.mjs`

---

Supabase Function JWT mode

- Default (safe / prod): `verify_jwt = true` for all Edge Functions.
- Local workaround mode (only if local edge gateway hits JWT bug):
	1. `npm run supabase:mode:local`
	2. `npx supabase start`
- Switch back to prod-safe mode:
	1. `npm run supabase:mode:prod`
	2. `npm run supabase:mode:check`

Important: keep prod mode before deploy (`npm run supabase:mode:check` must pass).

---

Week 9 – Public API / SDK / White Label

- API key management function: `manage-api-keys`
- Webhook management function: `manage-webhooks`
- White-label management function: `manage-white-label`
- Webhook dispatch function (internal): `dispatch-webhooks`
- Public widget config endpoint: `widget-public`
- API v1 endpoints: `api-v1-clients`, `api-v1-transactions`, `api-v1-services`, `api-v1-promotions`, `api-v1-stats`, `api-v1-sandbox`

Build commands:

- App: `npm run build`
- Widget bundle: `npm run build:widget`
- SDK package: `npm run build:sdk`

Week 9 smoke validation:

- Serve functions with Week 9 secrets:
	- `npm run smoke:week9:serve`
- Run smoke checks (in another terminal):
	- `npm run smoke:week9`

Required local file:

- `.env.functions.local` must define:
	- `API_KEY_PEPPER=...`
	- `WEBHOOK_DISPATCH_TOKEN=...`

OpenAPI:

- Source spec: `docs/openapi.yaml`
- Hosted dev copy: `public/docs/openapi.yaml`

SDK docs:

- Hosted dev quickstart: `public/docs/sdk.md`
- Package source: `packages/loyalup-sdk`