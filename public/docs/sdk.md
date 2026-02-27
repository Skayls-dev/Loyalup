# LoyalUp SDK Quickstart

## Install

```bash
npm install @loyalup/sdk
```

## Initialize

```ts
import { LoyalUpClient } from '@loyalup/sdk'

const api = new LoyalUpClient({
  baseUrl: 'https://YOUR_PROJECT.supabase.co/functions/v1',
  apiKey: 'lup_live_xxx',
})
```

## Common calls

```ts
await api.clients.list()
await api.services.list()
await api.transactions.create({
  client_id: 'client-uuid',
  montant: 25,
  points_credited: 250,
})
```

## Verify webhooks

```ts
import { verifyWebhookSignature } from '@loyalup/sdk'

const valid = await verifyWebhookSignature({
  secret: process.env.LOYALUP_WEBHOOK_SECRET!,
  payload: rawBody,
  signature: req.headers['x-loyalup-signature'] as string,
  timestamp: req.headers['x-loyalup-timestamp'] as string,
})
```
