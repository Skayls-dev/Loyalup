import { supabase } from '../../../shared/lib/supabaseClient'

export type UpsertMerchantRatingInput = {
  transactionId: string
  rating: number
  comment?: string | null
}

function normalizeMessage(raw: unknown): string {
  const message =
    raw instanceof Error
      ? raw.message
      : typeof raw === 'string'
        ? raw
        : 'Impossible d\'enregistrer la note.'

  if (message.includes('RATING_TRANSACTION_NOT_ELIGIBLE')) {
    return 'Cette transaction n\'est pas eligible a la notation.'
  }

  if (message.includes('RATING_TRANSACTION_NOT_FOUND')) {
    return 'Transaction introuvable.'
  }

  return message
}

export async function upsertMerchantRating(input: UpsertMerchantRatingInput): Promise<void> {
  const rating = Math.trunc(input.rating)

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('La note doit etre comprise entre 1 et 5.')
  }

  const { error } = await supabase.from('merchant_ratings').upsert(
    {
      transaction_id: input.transactionId,
      rating,
      comment: input.comment?.trim() || null,
    },
    { onConflict: 'transaction_id' },
  )

  if (error) {
    throw new Error(normalizeMessage(error.message))
  }
}