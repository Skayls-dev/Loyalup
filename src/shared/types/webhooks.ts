export type WebhookEventType =
  | 'client.created'
  | 'client.updated'
  | 'service.created'
  | 'service.updated'
  | 'transaction.created'
  | 'transaction.validated'
  | 'promotion.created'
  | 'promotion.updated'

export type WebhookEnvelope<TData = Record<string, unknown>> = {
  id: string
  type: WebhookEventType
  fournisseur_id: string
  created_at: string
  data: TData
}

export type WebhookClientPayload = {
  id: string
  nom: string
  email: string
  solde?: number
}

export type WebhookTransactionPayload = {
  id: string
  client_id: string
  service_id: string | null
  montant: number
  points_credited: number
  status: string
  created_at: string
}

export type WebhookPromotionPayload = {
  id: string
  titre: string
  description: string
  points_requis: number
  actif: boolean
}

export type WebhookEventMap = {
  'client.created': WebhookClientPayload
  'client.updated': WebhookClientPayload
  'service.created': Record<string, unknown>
  'service.updated': Record<string, unknown>
  'transaction.created': WebhookTransactionPayload
  'transaction.validated': WebhookTransactionPayload
  'promotion.created': WebhookPromotionPayload
  'promotion.updated': WebhookPromotionPayload
}

export type TypedWebhookEnvelope<T extends WebhookEventType> = WebhookEnvelope<WebhookEventMap[T]> & {
  type: T
}