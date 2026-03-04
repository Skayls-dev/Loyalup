# LoyalUp API — Spécifications (v1)

## 1. Vue d’ensemble

Ce document décrit les APIs publiques exposées via Supabase Edge Functions pour :
- les fournisseurs LoyalUp (Provider API),
- les partenaires externes qui créditent/débitent des points (Partner Transfers),
- le self-service de gestion des clés partenaire (Partner Self-Service).

Base URL (prod actuelle) :
- `https://yyftqivizzgvveeczbpv.supabase.co/functions/v1`

---

## 2. Modèles d’authentification

### 2.1 Provider API (fournisseurs)
- Header principal : `X-API-Key: <api_key>`
- Alternative : `Authorization: Bearer <api_key>`
- Contrôles appliqués : clé active, expiration, scopes, environnement, rate limiting.

### 2.2 Partner Transfers (partenaires externes)
- Header requis : `X-Partner-Key: <partner_key>`
- Header requis : `Idempotency-Key: <uuid>`
- Cette API n’utilise pas `X-API-Key`.

### 2.3 Partner Self-Service (dashboard provider)
- Endpoint utilisé côté app provider (via session Supabase du provider).
- Action envoyée dans le body : `action: ...`.

---

## 3. Formats de réponse

### 3.1 Provider API (`api-v1-*`, `api-v1-sandbox`)
Format standard enveloppé :

```json
{
  "success": true,
  "data": {},
  "meta": {
    "request_id": "...",
    "timestamp": "...",
    "api_version": "v1",
    "rate_limit_remaining": 123
  }
}
```

En erreur :

```json
{
  "success": false,
  "error": {
    "code": "validation_error",
    "message": "..."
  },
  "meta": {
    "request_id": "...",
    "timestamp": "...",
    "api_version": "v1"
  }
}
```

### 3.2 Partner Transfers
Format JSON direct (sans enveloppe `data/meta`).
Exemple succès :

```json
{
  "success": true,
  "status": "accepted",
  "transfer_id": "uuid",
  "transaction_ref": "tx-123",
  "partner_code": "PROVIDER_3",
  "external_user_id": "ext-42",
  "loyalup_user_id": "uuid",
  "points_delta": 120,
  "resulting_balance": 450
}
```

---

## 4. Endpoints Provider API

## 4.1 Clients
Endpoint : `/api-v1-clients`

### GET `/api-v1-clients`
- Scope requis : `clients`
- Query params : `page`, `limit`, `min_points`, `segment`
- Retourne : liste clients + pagination

### GET `/api-v1-clients?client_id=<id>`
- Scope requis : `clients`
- Retourne : profil client, points, dernières transactions

### POST `/api-v1-clients/<client_id>/points`
- Scope requis : `transactions`
- Body :

```json
{
  "amount": 100,
  "type": "credit",
  "description": "Ajustement manuel"
}
```

- `type` : `credit | debit`

## 4.2 Transactions
Endpoint : `/api-v1-transactions`

### GET `/api-v1-transactions`
- Scope requis : `read`
- Query params : `page`, `limit`, `client_id`, `service_id`, `date_from`, `date_to`

### GET `/api-v1-transactions?id=<id>`
- Scope requis : `read`
- Retourne le détail transaction

### POST `/api-v1-transactions`
- Scope requis : `transactions`
- Body minimal :

```json
{
  "client_email": "client@example.com",
  "montant": 24.5,
  "service_id": "optional-service-id"
}
```

## 4.3 Services
Endpoint : `/api-v1-services`

### GET `/api-v1-services`
- Retourne les services actifs du fournisseur

### POST `/api-v1-services`
- Scope requis : `write`
- Body minimum :

```json
{
  "nom": "Lavage premium",
  "emoji": "🫧"
}
```

- Champs optionnels : `prix_defaut`, `points_defaut`, `points_per_euro`, `actif`

### PUT `/api-v1-services?id=<id>`
- Scope requis : `write`
- Met à jour un service

## 4.4 Promotions
Endpoint : `/api-v1-promotions`

### GET `/api-v1-promotions`
- Retourne les promotions actives dans la fenêtre date début/fin

### POST `/api-v1-promotions`
- Scope requis : `write`
- Body :

```json
{
  "titre": "Happy Hour",
  "description": "-20% sur une sélection",
  "emoji": "🎉",
  "type": "discount",
  "valeur": 20,
  "date_debut": "2026-03-01T00:00:00.000Z",
  "date_fin": "2026-03-31T23:59:59.000Z"
}
```

- `type` : `double_points | discount | free_item | custom`

## 4.5 Stats
Endpoint : `/api-v1-stats`

### GET `/api-v1-stats`
- Scope requis : `read`
- Retourne :
  - `total_revenue`
  - `total_points_credited`
  - `total_transactions`
  - `active_clients`
  - `average_basket`

## 4.6 Sandbox
Endpoint : `/api-v1-sandbox`

### GET `/api-v1-sandbox?mode=status`
- Clé requise : sandbox uniquement
- Retourne statut de la clé, provider et scopes

### GET `/api-v1-sandbox?mode=echo`
- Clé requise : sandbox uniquement
- Retourne les query params reçus

---

## 5. Partner Transfers (B2B externe)

Endpoint actuel : `/partner-transfers`

### POST `/partner-transfers`
Headers requis :
- `X-Partner-Key`
- `Idempotency-Key`
- `Content-Type: application/json`

Body :

```json
{
  "external_user_id": "partner-user-123",
  "email": "client@example.com",
  "transaction_ref": "order-2026-03-04-0001",
  "points": 120,
  "direction": "credit",
  "display_name": "Jean Martin",
  "create_user_if_missing": true,
  "metadata": {
    "source": "partner-app",
    "campaign": "spring"
  }
}
```

Règles métier :
- `external_user_id` requis (min 2 chars)
- `email` optionnel (recommandé pour activer ensuite le compte LoyalUp utilisateur)
- `transaction_ref` requis (min 4 chars)
- `points` entier positif
- `direction` : `credit | debit` (défaut `credit`)
- idempotence via `transaction_ref` + `Idempotency-Key`
- si utilisateur externe non lié : création + liaison automatique possible
- en débit, si solde insuffisant => rejet `409` avec `error: insufficient_balance`

Réponses typiques :
- `200` + `status: accepted`
- `200` + `status: duplicate` (retry/idempotence)
- `401` (clé manquante/invalide)
- `403` (partenaire non actif ou production non activée)
- `409` (`insufficient_balance`)

### POST `/partner-account-claim`
Headers requis :
- `X-Partner-Key`
- `Content-Type: application/json`

Action 1: `GET_STATUS`

```json
{
  "action": "GET_STATUS",
  "external_user_id": "partner-user-123"
}
```

Action 2: `START_CLAIM`

```json
{
  "action": "START_CLAIM",
  "external_user_id": "partner-user-123",
  "email": "client@example.com",
  "redirect_to": "https://loyalup-pink.vercel.app/auth/callback"
}
```

Usage :
- `GET_STATUS` permet au partenaire de savoir si le compte LoyalUp lié nécessite encore activation.
- `START_CLAIM` associe l’email réel et génère un magic link (`action_link`) à envoyer à l’utilisateur final.

---

## 6. Partner Self-Service (Sprint 2)

Endpoint : `/partner-self-service`

### POST action=`GET_PROFILE`
- Retourne le profil partenaire lié au provider

### POST action=`LIST_KEYS`
- Retourne les clés partenaire

### POST action=`CREATE_KEY`
Body exemple :

```json
{
  "action": "CREATE_KEY",
  "environment": "sandbox",
  "scopes": ["transfers:write"]
}
```

Règle : clé `production` autorisée uniquement si partenaire `production_active`.

### POST action=`REQUEST_PRODUCTION_ACCESS`
Body optionnel :

```json
{
  "action": "REQUEST_PRODUCTION_ACCESS",
  "notes": "Go-live prévu semaine prochaine"
}
```

### POST action=`LIST_REQUESTS`
- Retourne l’historique des demandes d’accès production

---

## 7. Erreurs fréquentes

Provider API :
- `401 missing_api_key` / `invalid_api_key`
- `401 api_key_expired` / `api_key_revoked`
- `403 missing_scope`
- `403 sandbox_key_not_allowed`
- `403 production_key_not_allowed`
- `429 rate_limited`

Partner Transfers :
- `401 Missing X-Partner-Key` / `Invalid partner key`
- `400 Missing Idempotency-Key header`
- `400 transaction_ref is required`
- `403 Partner production access not enabled`
- `409 insufficient_balance`

---

## 8. OpenAPI / Swagger

- Fichier spec : `/docs/openapi.yaml`
- Swagger UI (viewer) : `https://petstore.swagger.io/?url=https://loyalup-pink.vercel.app/docs/openapi.yaml`

---

## 9. cURL rapides

### 9.1 List clients

```bash
curl -X GET \
  "https://yyftqivizzgvveeczbpv.supabase.co/functions/v1/api-v1-clients?page=1&limit=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

### 9.2 Partner transfer (credit)

```bash
curl -X POST \
  "https://yyftqivizzgvveeczbpv.supabase.co/functions/v1/partner-transfers" \
  -H "Content-Type: application/json" \
  -H "X-Partner-Key: YOUR_PARTNER_KEY" \
  -H "Idempotency-Key: 5ff9fae2-bddf-4f77-8f11-6d7dd73f6b34" \
  -d '{
    "external_user_id": "partner-user-123",
    "transaction_ref": "order-2026-03-04-0001",
    "points": 120,
    "direction": "credit"
  }'
```
