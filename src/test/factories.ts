import type { Profile, Fournisseur } from '../shared/types'
import type { Transaction, ClientPoints, Service } from '../modules/transactions/services/transactionService'
import type { Promotion } from '../modules/promotions/services/promotionService'
import type { RewardRule } from '../modules/loyalty/services/loyaltyService'

type Override<T> = Partial<T>

export function createMockProfile(overrides: Override<Profile> = {}): Profile {
  return {
    id: 'profile-1',
    email: 'client@loyalup.app',
    role: 'client',
    nom: 'Client Test',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockFournisseur(overrides: Override<Fournisseur> = {}): Fournisseur {
  return {
    id: 'fournisseur-1',
    user_id: 'provider-user-1',
    nom_commerce: 'Coffee Loyal',
    adresse: '12 Rue de Test, Paris',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockTransaction(overrides: Override<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    pending_transaction_id: crypto.randomUUID(),
    client_id: 'client-1',
    fournisseur_id: 'fournisseur-1',
    service_id: 'service-1',
    montant: 18.5,
    points_credited: 185,
    status: 'validated',
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockClientPoints(overrides: Override<ClientPoints> = {}): ClientPoints {
  return {
    id: crypto.randomUUID(),
    client_id: 'client-1',
    fournisseur_id: 'fournisseur-1',
    solde: 420,
    total_visites: 11,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockPromotion(overrides: Override<Promotion> = {}): Promotion {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    fournisseur_id: 'fournisseur-1',
    titre: 'Double points café du matin',
    description: '2x points avant 10h',
    emoji: '☕',
    type: 'double_points',
    valeur: 2,
    date_debut: new Date(now - 60 * 60 * 1000).toISOString(),
    date_fin: new Date(now + 48 * 60 * 60 * 1000).toISOString(),
    actif: true,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

export function createMockRewardRule(overrides: Override<RewardRule> = {}): RewardRule {
  const { expiry_date, ...restOverrides } = overrides

  return {
    id: 'reward-rule-1',
    fournisseur_id: 'fournisseur-1',
    nom: 'Boisson offerte',
    description: 'Une boisson gratuite',
    points_required: 300,
    emoji: '🎁',
    expiry_date: expiry_date ?? null,
    actif: true,
    created_at: new Date().toISOString(),
    ...restOverrides,
  }
}

export function createMockService(overrides: Override<Service> = {}): Service {
  return {
    id: 'service-1',
    fournisseur_id: 'fournisseur-1',
    nom: 'Menu déjeuner',
    emoji: '🍽️',
    prix_defaut: 12,
    points_defaut: null,
    points_per_euro: 10,
    actif: true,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}
