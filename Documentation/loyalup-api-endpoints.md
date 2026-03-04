# LoyalUp API & Architecture d’intégration tierce

Ce document unique décrit :
- les endpoints API publics LoyalUp (provider-facing),
- l’architecture cible quand un client achète via une application tierce puis est crédité sur LoyalUp.

## Sommaire

- [1) Base URL](#1-base-url)
- [2) Authentification](#2-authentification)
- [3) Format de réponse standard](#3-format-de-réponse-standard)
- [4) Endpoints](#4-endpoints)
  - [4.1 Clients](#41-clients)
  - [4.2 Transactions](#42-transactions)
  - [4.3 Services](#43-services)
  - [4.4 Promotions](#44-promotions)
  - [4.5 Stats](#45-stats)
  - [4.6 Sandbox](#46-sandbox)
  - [4.7 Partner Transfers (Sprint 1)](#47-partner-transfers-sprint-1)
  - [4.8 Partner Self-Service (Sprint 2)](#48-partner-self-service-sprint-2)
- [5) Erreurs fréquentes](#5-erreurs-fréquentes)
- [6) Swagger / OpenAPI](#6-swagger--openapi)
- [7) Exemple cURL](#7-exemple-curl)
- [8) Architecture — achat via app tierce puis crédit LoyalUp](#8-architecture--achat-via-app-tierce-puis-crédit-loyalup)

## 1) Base URL

- Production (projet actuel) : `https://yyftqivizzgvveeczbpv.supabase.co/functions/v1`
- Format endpoint : `<BASE_URL>/<endpoint>`

Exemples :
- `https://yyftqivizzgvveeczbpv.supabase.co/functions/v1/api-v1-clients`
- `https://yyftqivizzgvveeczbpv.supabase.co/functions/v1/api-v1-transactions`

## 2) Authentification

- Header requis : `X-API-Key: <votre_cle_api>`
- Alternative supportée : `Authorization: Bearer <votre_cle_api>`

L’API valide aussi :
- état de la clé (active/révoquée/expirée),
- environnement (`sandbox` vs `production`),
- scopes,
- rate limiting.

## 3) Format de réponse standard

### Succès

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

### Erreur

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

## 4) Endpoints

## 4.1 Clients

Endpoint: `/api-v1-clients`

### GET `/api-v1-clients`
- Description : liste paginée des clients du fournisseur
- Scope requis : `clients`
- Query params :
  - `page` (défaut `1`)
  - `limit` (défaut `20`, max `100`)
  - `min_points` (défaut `0`)
  - `segment` (optionnel)

### GET `/api-v1-clients?client_id=<id>`
- Description : détail d’un client (profil + fidélité + transactions récentes)
- Scope requis : `clients`

### POST `/api-v1-clients/<client_id>/points`
- Description : crédit ou débit de points
- Scope requis : `transactions`
- Body requis :

```json
{
  "amount": 100,
  "type": "credit",
  "description": "Ajustement manuel"
}
```

`type` ∈ `credit | debit`

## 4.2 Transactions

Endpoint: `/api-v1-transactions`

### GET `/api-v1-transactions`
- Description : liste paginée des transactions
- Scope requis : `read`
- Query params :
  - `page`, `limit`
  - `client_id` (optionnel)
  - `service_id` (optionnel)
  - `date_from` (optionnel)
  - `date_to` (optionnel)

### GET `/api-v1-transactions?id=<id>`
- Description : détail d’une transaction
- Scope requis : `read`

### POST `/api-v1-transactions`
- Description : création d’une transaction POS validée
- Scope requis : `transactions`
- Body requis :

```json
{
  "client_email": "client@example.com",
  "service_id": "optional-service-id",
  "montant": 24.5,
  "description": "Passage caisse"
}
```

## 4.7 Partner Transfers (Sprint 1)

Endpoint: `/partner/v1/transfers`

### POST `/partner/v1/transfers`
- Description : transfert de points d’un partenaire externe vers le wallet LoyalUp d’un utilisateur lié
- Auth requise : `X-Partner-Key`
- Header requis : `Idempotency-Key`
- Body requis :

```json
{
  "external_user_id": "kuvaago-user-123",
  "transaction_ref": "tx-2026-03-04-0001",
  "points": 120,
  "direction": "credit",
  "display_name": "Client Kuvaago",
  "metadata": {
    "source": "kuvaago",
    "campaign": "spring"
  }
}
```

- `direction` ∈ `credit | debit` (défaut: `credit`)
- `transaction_ref` est unique par partenaire (idempotence)
- Si l’utilisateur externe n’est pas encore lié, LoyalUp peut créer et lier automatiquement un compte client

## 4.8 Partner Self-Service (Sprint 2)

Endpoint: `/partner-self-service`

Ce endpoint est utilisé côté **Provider Dashboard / Developer Portal** (auth provider via token Supabase), pour éviter que l’admin génère manuellement toutes les clés partenaire.

### POST `/partner-self-service` avec `action=GET_PROFILE`
- Description : récupère (ou auto-provisionne) le profil partenaire lié au provider
- Retour : `partner`, `can_use_production`

### POST `/partner-self-service` avec `action=LIST_KEYS`
- Description : liste les clés partenaire du provider

### POST `/partner-self-service` avec `action=CREATE_KEY`
- Description : génère une clé API partenaire (one-time reveal)
- Body :

```json
{
  "action": "CREATE_KEY",
  "environment": "sandbox",
  "scopes": ["transfers:write"]
}
```

- Règle :
  - `sandbox` autorisé directement,
  - `production` autorisé uniquement si partenaire `production_active`.

### POST `/partner-self-service` avec `action=REQUEST_PRODUCTION_ACCESS`
- Description : soumet une demande d’activation production
- Body optionnel :

```json
{
  "action": "REQUEST_PRODUCTION_ACCESS",
  "notes": "Go-live prévu semaine prochaine"
}
```

### POST `/partner-self-service` avec `action=LIST_REQUESTS`
- Description : historique des demandes production du partenaire

## 4.3 Services

Endpoint: `/api-v1-services`

### GET `/api-v1-services`
- Description : liste des services actifs du fournisseur
- Scope requis : auth API key valide

### POST `/api-v1-services`
- Description : création d’un service
- Scope requis : `write`
- Body minimum :

```json
{
  "nom": "Lavage premium",
  "emoji": "🫧"
}
```

Body optionnel : `prix_defaut`, `points_defaut`, `points_per_euro`, `actif`

### PUT `/api-v1-services?id=<id>`
- Description : mise à jour d’un service
- Scope requis : `write`

## 4.4 Promotions

Endpoint: `/api-v1-promotions`

### GET `/api-v1-promotions`
- Description : promotions actives (fenêtre date début/fin)
- Scope requis : auth API key valide

### POST `/api-v1-promotions`
- Description : création d’une promotion
- Scope requis : `write`
- Body requis :

```json
{
  "titre": "Happy Hour",
  "type": "discount",
  "valeur": 20,
  "date_debut": "2026-03-01T00:00:00.000Z",
  "date_fin": "2026-03-31T23:59:59.000Z",
  "emoji": "🎉",
  "description": "-20% sur une sélection"
}
```

`type` ∈ `double_points | discount | free_item | custom`

## 4.5 Stats

Endpoint: `/api-v1-stats`

### GET `/api-v1-stats`
- Description : agrégats fournisseur (`total_revenue`, `total_points_credited`, `total_transactions`, `active_clients`, `average_basket`)
- Scope requis : `read`

## 4.6 Sandbox

Endpoint: `/api-v1-sandbox`

### GET `/api-v1-sandbox?mode=status`
- Description : check statut clé sandbox
- Contrainte : **clé sandbox uniquement**

### GET `/api-v1-sandbox?mode=echo`
- Description : echo des query params
- Contrainte : **clé sandbox uniquement**

## 5) Erreurs fréquentes

- `401 invalid_api_key` : clé manquante ou invalide
- `401 api_key_expired` / `api_key_revoked`
- `403 missing_scope` : scope insuffisant
- `403 sandbox_key_not_allowed` : clé sandbox utilisée sur endpoint prod
- `403 production_key_not_allowed` : clé prod utilisée sur sandbox
- `429 rate_limited` : quota dépassé

## 6) Swagger / OpenAPI

- Spec YAML (hébergée) : `https://loyalup-pink.vercel.app/docs/openapi.yaml`
- Swagger UI : `https://petstore.swagger.io/?url=https://loyalup-pink.vercel.app/docs/openapi.yaml`

## 7) Exemple cURL

```bash
curl -X GET \
  "https://yyftqivizzgvveeczbpv.supabase.co/functions/v1/api-v1-clients?page=1&limit=20" \
  -H "X-API-Key: YOUR_API_KEY"
```

## 8) Architecture — achat via app tierce puis crédit LoyalUp

### 8.1 Contexte fonctionnel

Un client réalise un achat dans une application tierce (POS/e-commerce). Après confirmation de l’achat, LoyalUp doit créditer automatiquement le compte fidélité du client.

### 8.2 Composants

- **Application tierce** : source de vérité de l’achat (`order_id`, montant, devise, client, magasin, timestamp).
- **API Gateway LoyalUp** : reçoit les appels API, valide la clé (`X-API-Key`), scopes et limites de débit.
- **Ingestion transactionnelle** (`/api-v1-transactions`) : crée l’événement transaction et déclenche le crédit des points.
- **Loyalty store** (tables transactions + client_points) : persiste la transaction validée et met à jour le solde.
- **Règles métier** : conversion montant → points, services, promotions, multiplicateurs réseau.
- **Webhook dispatcher** : diffuse les événements (`transaction.validated`, `client.updated`) vers systèmes externes.
- **Observabilité** : `request_id`, logs d’usage API, métriques de latence et d’échec.

### 8.3 Flux de bout en bout

1. L’app tierce confirme l’achat.
2. Elle appelle `POST /api-v1-transactions` avec la clé API fournisseur.
3. LoyalUp valide auth/scope/environnement et le payload.
4. LoyalUp retrouve le client (email), calcule les points, enregistre la transaction.
5. LoyalUp met à jour `client_points` (solde + visites).
6. LoyalUp répond immédiatement avec `transaction_id`, `points_credited`, `new_balance`.
7. LoyalUp émet en asynchrone les webhooks d’intégration.

### 8.4 Contrats minimaux entre app tierce et LoyalUp

- **Entrée minimale** pour crédit :
  - `client_email`
  - `montant`
- **Sortie attendue** :
  - `transaction_id`
  - `points_credited`
  - `new_balance`

### 8.5 Sécurité et fiabilité

- Clés API scoppées (`read`, `write`, `transactions`, `clients`) et contrôlées à chaque appel.
- Distinction environnement `production` vs `sandbox`.
- Limitation de débit par clé API (`429 rate_limited`).
- Journalisation d’usage API (endpoint, statut HTTP, temps de réponse, taille).

### 8.6 Recommandations d’intégration (sans implémentation)

- Utiliser un identifiant externe d’achat (`external_order_id`) côté app tierce pour éviter les doubles crédits lors des retries.
- Mettre en place un retry exponentiel côté app tierce sur erreurs réseau/5xx.
- Traiter les 4xx (validation/auth/scope) comme erreurs métier non rejouables.
- Corréler tous les appels via `request_id` retourné par LoyalUp.

