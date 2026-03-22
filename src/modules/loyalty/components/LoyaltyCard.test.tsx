import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoyaltyCard } from './LoyaltyCard'
import type { LoyaltyCard as LoyaltyCardModel } from '../hooks/useLoyalty'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'client-1' } }),
}))

vi.mock('../hooks/usePointsRealtime', () => ({
  usePointsRealtime: () => ({ solde: 250 }),
}))

describe('LoyaltyCard', () => {
  const card: LoyaltyCardModel = {
    fournisseur: {
      id: 'fournisseur-1',
      nom_commerce: 'Coffee Loyal',
      adresse: 'Paris',
    },
    solde: 200,
    displaySolde: 200,
    total_visites: 10,
    updated_at: new Date().toISOString(),
    nextReward: {
      id: 'reward-1',
      fournisseur_id: 'fournisseur-1',
      nom: 'Café offert',
      description: '',
      points_required: 500,
      emoji: '🎁',
      expiry_date: null,
      actif: true,
      reward_delivery_type: 'in_store',
      requires_physical_presence: false,
      created_at: new Date().toISOString(),
    },
    progressPercent: 40,
    pointsNeeded: 300,
  }

  it('renders provider name and points', () => {
    render(<LoyaltyCard card={card} index={0} />)

    expect(screen.getByText(/Coffee Loyal/)).toBeInTheDocument()
    expect(screen.getByText(/250/)).toBeInTheDocument()
  })

  it('renders progress bar with correct percentage', () => {
    render(<LoyaltyCard card={card} index={0} />)
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('updates progress when points prop changes', () => {
    const { rerender } = render(<LoyaltyCard card={{ ...card, solde: 200, displaySolde: 200 }} index={0} />)
    rerender(<LoyaltyCard card={{ ...card, solde: 260, displaySolde: 260 }} index={0} />)

    expect(screen.getByText('52%')).toBeInTheDocument()
  })

  it('navigates to detail view on tap', () => {
    render(<LoyaltyCard card={card} index={0} />)
    fireEvent.click(screen.getByRole('button'))

    expect(navigateMock).toHaveBeenCalledWith('/history?provider=fournisseur-1')
  })
})
