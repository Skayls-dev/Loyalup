import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PromoCard } from './PromoCard'
import { createMockPromotion } from '../../../test/factories'

describe('PromoCard', () => {
  it('renders title, description, emoji', () => {
    const promotion = createMockPromotion({ titre: 'Promo midi', description: 'Test desc', emoji: '🔥' })
    render(<PromoCard promotion={promotion} fournisseurNom="Coffee Loyal" />)

    expect(screen.getByText('Promo midi')).toBeInTheDocument()
    expect(screen.getByText('Test desc')).toBeInTheDocument()
    expect(screen.getByText('🔥')).toBeInTheDocument()
  })

  it('shows correct PromoTypeBadge', () => {
    const promotion = createMockPromotion({ type: 'discount' })
    render(<PromoCard promotion={promotion} fournisseurNom="Coffee Loyal" />)

    expect(screen.getByText(/Réduction/i)).toBeInTheDocument()
  })

  it('shows red expiry text when expires in < 24h', () => {
    const promotion = createMockPromotion({ date_fin: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() })
    render(<PromoCard promotion={promotion} fournisseurNom="Coffee Loyal" />)

    const expiry = screen.getByText(/Expire ce soir|Expirée/i)
    expect(expiry.className).toContain('text-red-400')
  })

  it('shows normal expiry text otherwise', () => {
    const promotion = createMockPromotion({ date_fin: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() })
    render(<PromoCard promotion={promotion} fournisseurNom="Coffee Loyal" />)

    const expiry = screen.getByText(/Expire dans/i)
    expect(expiry.className).toContain('text-zinc-400')
  })
})
