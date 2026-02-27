# Auth Store

This store centralizes authentication state for the frontend using Zustand.

## What it is

- A single source of truth for auth state (`user`, `role`, `isAuthenticated`, `loading`, `error`)
- A wrapper around `authService` to keep Supabase calls out of UI components
- A place where sign-in/sign-up/sign-out state transitions are handled consistently

## Export

- `useAuthStore`

## Available actions

- `hydrateCurrentUser()`
  - Loads current session user from Supabase on app startup
  - Updates `user`, `role`, `isAuthenticated`
- `signIn(email, password)`
  - Authenticates user and updates store state
  - Returns `{ user, role }`
- `signUp(email, password, role)`
  - Creates account with role (`client` or `fournisseur`)
  - Returns `{ user, role }`
- `signOut()`
  - Signs out and clears auth state
- `clearError()`
  - Resets `error` to `null`

## Typical usage

Call `hydrateCurrentUser()` once at app startup, then consume state and actions from `useAuthStore` in auth-related pages/components.

## Startup integration

`hydrateCurrentUser()` should run once when the app starts.

Example in `src/main.tsx`:

```tsx
import { useEffect } from 'react'
import { useAuthStore } from './modules/auth/store/authStore'

function AppBootstrap() {
  const hydrateCurrentUser = useAuthStore((state) => state.hydrateCurrentUser)

  useEffect(() => {
    hydrateCurrentUser().catch(() => null)
  }, [hydrateCurrentUser])

  return <App />
}
```

## Component usage example

```tsx
import { useAuthStore } from '../../modules/auth/store/authStore'

export function LoginForm() {
  const { signIn, loading, error, clearError } = useAuthStore((state) => ({
    signIn: state.signIn,
    loading: state.loading,
    error: state.error,
    clearError: state.clearError,
  }))

  const handleSubmit = async (email, password) => {
    clearError()
    await signIn(email, password)
  }

  return null
}
```

## Role-based checks

Use `role` to conditionally render client/provider views.

```tsx
const { role, isAuthenticated } = useAuthStore((state) => ({
  role: state.role,
  isAuthenticated: state.isAuthenticated,
}))

if (!isAuthenticated) return <PublicView />
if (role === 'fournisseur') return <ProviderView />
return <ClientView />
```
