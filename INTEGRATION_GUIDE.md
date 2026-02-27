# 📱 Integration Guide - Week 10 Gamification

## Router Integration Examples

### Client Routes (Gamification Widget)

```tsx
// src/routes/clientRoutes.tsx
import { GamificationWidget, ProviderNetworkPage, AdminNetworkDashboard } from '@/modules/gamification'

export const clientRoutes = [
  {
    path: '/gamification',
    element: <GamificationWidget layout="full" language="fr" />,
    label: '🎮 Gamification',
  },
  {
    path: '/provider/network',
    element: <ProviderNetworkPage />,
    label: '🤝 Réseau',
    requiredRole: 'provider',
  },
  {
    path: '/admin/network',
    element: <AdminNetworkDashboard />,
    label: '📊 Network Analytics',
    requiredRole: 'admin',
  },
]
```

### React Router v6 Example

```tsx
// src/Router.tsx
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  GamificationWidget,
  ProviderNetworkPage,
  AdminNetworkDashboard,
} from '@/modules/gamification'
import ClientHome from '@/pages/ClientHome'
import ProviderDashboard from '@/pages/ProviderDashboard'

const ROLE_ROUTES: Record<string, any[]> = {
  client: [
    { path: '/gamification', element: <GamificationWidget layout="full" language="fr" /> },
  ],
  provider: [
    { path: '/provider/network', element: <ProviderNetworkPage /> },
  ],
  admin: [
    { path: '/admin/network', element: <AdminNetworkDashboard /> },
  ],
}

export function Router() {
  const userRole = useAuthStore((state) => state.user?.role)

  const routes = ROLE_ROUTES[userRole] || []

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Navigate to="/home" />} />

        {/* Role-based routes */}
        {routes.map((route) => (
          <Route key={route.path} path={route.path} element={route.element} />
        ))}

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/home" />} />
      </Routes>
    </BrowserRouter>
  )
}
```

### Bottom Navigation Integration

```tsx
// src/components/BottomNav.tsx
import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const CLIENT_TABS = [
  { icon: '💳', label: 'Cartes', path: '/card' },
  { icon: '📷', label: 'Scanner', path: '/scan' },
  { icon: '🎯', label: 'Défis', path: '/gamification', subTab: 'challenges' },
  { icon: '🏆', label: 'Classement', path: '/gamification', subTab: 'leaderboard' },
  { icon: '👤', label: 'Profil', path: '/profile' },
]

const PROVIDER_TABS = [
  { icon: '📊', label: 'Dashboard', path: '/provider' },
  { icon: '🤝', label: 'Réseau', path: '/provider/network' },
  { icon: '👤', label: 'Profil', path: '/provider/profile' },
]

const ADMIN_TABS = [
  { icon: '📊', label: 'Dashboard', path: '/admin' },
  { icon: '🔗', label: 'Réseau', path: '/admin/network' },
  { icon: '⚙️', label: 'Paramètres', path: '/admin/settings' },
]

export function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const userRole = useAuthStore((state) => state.user?.role)

  const tabs = userRole === 'provider'
    ? PROVIDER_TABS
    : userRole === 'admin'
    ? ADMIN_TABS
    : CLIENT_TABS

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          onClick={() => navigate(tab.path, { state: { subTab: tab.subTab } })}
          className={`flex-1 py-3 text-xs text-center font-semibold transition-colors ${
            location.pathname === tab.path
              ? 'text-blue-600 border-t-2 border-blue-600'
              : 'text-gray-700 hover:text-gray-900'
          }`}
        >
          <div className="text-xl">{tab.icon}</div>
          <div>{tab.label}</div>
        </button>
      ))}
    </nav>
  )
}
```

### Header Integration (Level Badge)

```tsx
// src/components/Header.tsx
import React from 'react'
import { useClientLevel, LevelBadge } from '@/modules/gamification'

export function Header() {
  const { levelData } = useClientLevel()

  return (
    <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
      <h1 className="text-xl font-bold text-gray-800">LoyalUp</h1>

      {levelData && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-700">
              {levelData.level_name['fr'] ?? levelData.level_name['en']}
            </p>
            <p className="text-xs text-gray-600">{levelData.xp_total} XP</p>
          </div>
          <LevelBadge
            level={levelData.current_level}
            emoji={levelData.level_emoji}
            color={levelData.level_color}
            size="sm"
          />
        </div>
      )}
    </header>
  )
}
```

### Client Home Integration

```tsx
// src/pages/ClientHome.tsx
import React, { useState } from 'react'
import { GamificationWidget, ChallengeList, StreakDisplay } from '@/modules/gamification'

export function ClientHome() {
  const [showFullGamification, setShowFullGamification] = useState(false)

  if (showFullGamification) {
    return (
      <div>
        <button
          onClick={() => setShowFullGamification(false)}
          className="mb-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
        >
          ← Retour
        </button>
        <GamificationWidget layout="full" language="fr" />
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Existing card content */}

      {/* Gamification compact integration */}
      <section className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">🎮 Progression</h2>
          <button
            onClick={() => setShowFullGamification(true)}
            className="text-xs text-purple-600 font-semibold hover:text-purple-700"
          >
            Voir plus →
          </button>
        </div>

        <GamificationWidget layout="compact" language="fr" />
      </section>

      {/* Quick sections */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">🎯 Défis du jour</h2>
        <ChallengeList language="fr" maxVisible={2} />
      </section>

      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4">🔥 Votre série</h2>
        <StreakDisplay language="fr" />
      </section>
    </div>
  )
}
```

## Environment Variables

Ensure these are set in `.env.local`:

```bash
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Optional: Edge Function timeouts
VITE_EDGE_FUNCTION_TIMEOUT=10000
```

## Deployment Checklist

- [ ] Database migrations deployed (`supabase db push`)
- [ ] Edge Functions deployed (`supabase functions deploy`)
- [ ] Service layer tested
- [ ] Hooks integrated with components
- [ ] Routes configured
- [ ] Bottom navigation updated
- [ ] Header integrated with level badge
- [ ] Page layouts updated
- [ ] Responsive design tested
- [ ] i18n language switching tested

## Testing Integration

```bash
# Test TS compilation
npm run typecheck

# Test components
npm run test

# Build for production
npm run build

# Start dev server
npm run dev
```

## Rollback Plan

If integration breaks:

1. Revert route changes:
   ```bash
   git checkout HEAD -- src/routes
   ```

2. Revert UI component changes:
   ```bash
   git checkout HEAD -- src/components
   ```

3. Keep all gamification module files (safe to revert services layer only if needed)

---

**Status**: Ready for integration ✅
