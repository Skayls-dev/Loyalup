import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { App } from './app/App'
import { queryClient } from './shared/lib/queryClient'

const CHUNK_RELOAD_KEY = 'app:chunk-reload-once'

function reloadOnStaleChunk() {
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') {
      return
    }

    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    window.location.reload()
  } catch {
    window.location.reload()
  }
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnStaleChunk()
})

window.addEventListener('error', (event) => {
  const message = String(event?.message ?? '')
  if (message.includes('Failed to fetch dynamically imported module')) {
    reloadOnStaleChunk()
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
