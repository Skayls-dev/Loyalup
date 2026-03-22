import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RewardCard } from './RewardCard'
import type { RewardCatalogItem } from '../services/loyaltyService'

function createReward(overrides: Partial<RewardCatalogItem> = {}): RewardCatalogItem {
  return {
    id: 'catalog-1',
    fournisseur_id: 'fournisseur-1',
    fournisseur_nom: 'Coffee Loyal',
    status: 'available',
    unlocked_reward_id: 'client-reward-1',
    unlocked_at: new Date().toISOString(),
    current_points: 500,
    points_needed: 0,
    reward_rule: {
      id: 'rule-1',
      fournisseur_id: 'fournisseur-1',
      nom: 'Café offert',
      description: 'Un café gratuit',
      points_required: 500,
      emoji: '🎁',
      expiry_date: null,
      actif: true,
      reward_delivery_type: 'in_store',
      requires_physical_presence: false,
      created_at: new Date().toISOString(),
    },
    ...overrides,
  }
}

describe('RewardCard', () => {
  it('available in_store reward : ne montre pas le bouton Utiliser, affiche le message présence physique', () => {
    const onUse = vi.fn().mockResolvedValue(undefined)
    const reward = createReward({
      reward_rule: {
        ...createReward().reward_rule,
        reward_delivery_type: 'in_store',
      },
    })

    render(<RewardCard reward={reward} onUse={onUse} />)

    expect(screen.queryByRole('button', { name: 'Utiliser' })).not.toBeInTheDocument()
    expect(screen.getByText('Récompense prête — présentez votre app en boutique lors de votre prochain achat')).toBeInTheDocument()
  })

  it('available digital_code reward : montre le bouton Utiliser (flow V2 intact)', () => {
    const onUse = vi.fn().mockResolvedValue(undefined)
    const reward = createReward({
      reward_rule: {
        ...createReward().reward_rule,
        reward_delivery_type: 'digital_code',
      },
    })

    render(<RewardCard reward={reward} onUse={onUse} />)

    expect(screen.getByRole('button', { name: 'Utiliser' })).toBeInTheDocument()
  })
})
