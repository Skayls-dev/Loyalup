import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../shared/lib/supabaseClient'

export function useAdminGuard() {
  const navigate = useNavigate()
  const location = useLocation()
  const [isLoading, setIsLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setIsLoading(true)

      const { data, error } = await supabase.auth.getUser()
      const role = String(data.user?.app_metadata?.role ?? '')
      const allowed = !error && Boolean(data.user) && role === 'super_admin'

      if (cancelled) return

      setIsAdmin(allowed)
      setIsLoading(false)

      if (!allowed && location.pathname !== '/unauthorized') {
        navigate('/unauthorized', { replace: true })
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [location.pathname, navigate])

  return { isAdmin, isLoading }
}
