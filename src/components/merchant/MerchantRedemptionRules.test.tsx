import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { MerchantRedemptionRules } from './MerchantRedemptionRules'
import { setTableData } from '../../test/mocks/supabase'

const merchantId = 'fournisseur-1'

beforeEach(() => {
  setTableData('fournisseurs', [
    {
      id: merchantId,
      user_id: 'user-1',
      points_conversion_rate: 100,
      created_at: new Date().toISOString(),
    },
  ])

  setTableData('redemption_rules', [
    {
      id: 'rule-1',
      fournisseur_id: merchantId,
      label: 'Remise cafe',
      points_cost: 100,
      discount_value: 1,
      discount_type: 'fixed',
      max_discount_eur: null,
      actif: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'rule-2',
      fournisseur_id: merchantId,
      label: 'Remise premium',
      points_cost: 250,
      discount_value: 10,
      discount_type: 'percent',
      max_discount_eur: 5,
      actif: false,
      created_at: new Date().toISOString(),
    },
  ])
})

describe('MerchantRedemptionRules', () => {
  it('renders redemption rules and conversion preview', async () => {
    render(<MerchantRedemptionRules merchantId={merchantId} />)

    expect(await screen.findByText('Remise cafe')).toBeInTheDocument()
    expect(screen.getByText('Remise premium')).toBeInTheDocument()
    expect(screen.getByText(/Apercu: 100 pts = 1 EUR/i)).toBeInTheDocument()
  })

  it('filters list with search query', async () => {
    render(<MerchantRedemptionRules merchantId={merchantId} />)

    await screen.findByText('Remise cafe')

    fireEvent.change(screen.getByPlaceholderText('Ex: remise cafe'), {
      target: { value: 'premium' },
    })

    await waitFor(() => {
      expect(screen.queryByText('Remise cafe')).not.toBeInTheDocument()
      expect(screen.getByText('Remise premium')).toBeInTheDocument()
    })
  })

  it('filters list by inactive status', async () => {
    render(<MerchantRedemptionRules merchantId={merchantId} />)

    await screen.findByText('Remise cafe')

    fireEvent.change(screen.getByDisplayValue('Toutes les regles'), {
      target: { value: 'inactive' },
    })

    await waitFor(() => {
      expect(screen.queryByText('Remise cafe')).not.toBeInTheDocument()
      expect(screen.getByText('Remise premium')).toBeInTheDocument()
    })
  })
})
