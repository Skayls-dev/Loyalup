import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationPanel } from './ValidationPanel'

let validationState: {
  selectedService: {
    id: string
    nom: string
    emoji: string
    prix_defaut: number
    points_defaut: null
    points_per_euro: number
    actif: boolean
    fournisseur_id: string
    created_at: string
  } | null
  montant: string
  pointsPreview: number
  isSubmitting: boolean
  isSuccess: boolean
  error: string | null
  canValidate: boolean
} = {
  selectedService: { id: 'service-1', nom: 'Café', emoji: '☕', prix_defaut: 5, points_defaut: null, points_per_euro: 10, actif: true, fournisseur_id: 'f', created_at: new Date().toISOString() },
  montant: '10',
  pointsPreview: 100,
  isSubmitting: false,
  isSuccess: false,
  error: null as string | null,
  canValidate: true,
}

const validateMock = vi.fn()
const cancelMock = vi.fn()
const selectServiceMock = vi.fn()
const setMontantMock = vi.fn()
const resetMock = vi.fn()

vi.mock('../hooks/useServices', () => ({
  useServices: () => ({
    services: [{ id: 'service-1', nom: 'Café', emoji: '☕', prix_defaut: 5, points_defaut: null, points_per_euro: 10, actif: true, fournisseur_id: 'f', created_at: new Date().toISOString() }],
    loading: false,
    error: null,
  }),
}))

vi.mock('../hooks/useValidation', () => ({
  useValidation: () => ({
    ...validationState,
    selectService: selectServiceMock,
    setMontant: setMontantMock,
    validate: validateMock,
    cancel: cancelMock,
    reset: resetMock,
  }),
}))

describe('ValidationPanel', () => {
  beforeEach(() => {
    validationState = {
      selectedService: { id: 'service-1', nom: 'Café', emoji: '☕', prix_defaut: 5, points_defaut: null, points_per_euro: 10, actif: true, fournisseur_id: 'f', created_at: new Date().toISOString() },
      montant: '10',
      pointsPreview: 100,
      isSubmitting: false,
      isSuccess: false,
      error: null,
      canValidate: true,
    }
    validateMock.mockResolvedValue({ points_credited: 100, new_balance: 500 })
    cancelMock.mockResolvedValue(undefined)
  })

  const props = {
    pendingTransaction: {
      id: 'pending-1',
      qr_token_id: 'qr-1',
      client_id: 'client-1',
      fournisseur_id: 'fournisseur-1',
      status: 'pending' as const,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60000).toISOString(),
    },
    clientProfile: {
      id: 'client-1',
      email: 'client@loyalup.app',
      role: 'client' as const,
      nom: 'Client Test',
      created_at: new Date().toISOString(),
    },
    clientPoints: 300,
    onDismiss: vi.fn(),
  }

  it('renders client name and current points', () => {
    render(<ValidationPanel {...props} />)
    expect(screen.getByText(/Client Test/)).toBeInTheDocument()
    expect(screen.getByText(/300/)).toBeInTheDocument()
  })

  it('service selection updates points preview', () => {
    render(<ValidationPanel {...props} />)
    expect(screen.getByText(/100 pts/)).toBeInTheDocument()
  })

  it('custom price calculates points correctly (1€ = 10pts)', () => {
    render(<ValidationPanel {...props} />)
    const input = screen.getByPlaceholderText('0.00')
    fireEvent.change(input, { target: { value: '12' } })
    expect(setMontantMock).toHaveBeenCalled()
  })

  it('validate button disabled when no price entered', async () => {
    validationState = {
      ...validationState,
      selectedService: null,
      montant: '',
      pointsPreview: 0,
      canValidate: false,
    }

    render(<ValidationPanel {...props} />)
    expect(screen.getByRole('button', { name: /valider/i })).toBeDisabled()
  })

  it('calls creditPoints on validate click', async () => {
    render(<ValidationPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /valider/i }))
    await waitFor(() => {
      expect(validateMock).toHaveBeenCalledWith('pending-1')
    })
  })

  it('shows success screen after validation', async () => {
    validationState = {
      ...validationState,
      isSuccess: true,
    }
    vi.mocked(validateMock).mockResolvedValueOnce({ points_credited: 100, new_balance: 500 })
    render(<ValidationPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /valider/i }))

    expect(await screen.findByText(/Transaction validée/i)).toBeInTheDocument()
  })

  it('calls cancelTransaction on cancel click', async () => {
    render(<ValidationPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }))
    expect(cancelMock).toHaveBeenCalledWith('pending-1')
  })
})
