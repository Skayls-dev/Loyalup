# Looyaal SDK

Lightweight TypeScript SDK for Looyaal Public API v1.

## Install

```bash
npm install @loyalup/sdk
```

## Publish (maintainers)

```bash
npm login
npm run build
npm publish --access public
```

## Usage

```ts
import { LoyalUpClient } from '@loyalup/sdk'

const client = new LoyalUpClient({
  baseUrl: 'https://your-project.supabase.co/functions/v1',
  apiKey: 'lup_live_xxx',
})

const services = await client.services.list()
```

## Webhook verification

```ts
import { verifyWebhookSignature } from '@loyalup/sdk'

const verified = await verifyWebhookSignature({
  secret: process.env.WEBHOOK_SECRET!,
  payload: rawBody,
  signature: headers['x-loyalup-signature'],
  timestamp: headers['x-loyalup-timestamp'],
})
```
