import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

export const QUERY_STALE = {
  fiveMinutes: 5 * 60 * 1000,
  alwaysFresh: 0,
} as const
