export const OFFLINE_WRITE_MESSAGE = 'Connexion requise pour cette action'

export function requireOnlineForWrite() {
  if (!navigator.onLine) {
    throw new Error(OFFLINE_WRITE_MESSAGE)
  }
}

export async function withCachedRead<T>(key: string, readFn: () => Promise<T>): Promise<T> {
  if (!navigator.onLine) {
    const cached = localStorage.getItem(key)
    if (cached) {
      return JSON.parse(cached) as T
    }
  }

  const data = await readFn()
  localStorage.setItem(key, JSON.stringify(data))
  return data
}
