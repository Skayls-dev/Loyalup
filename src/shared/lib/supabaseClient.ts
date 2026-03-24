import { createClient } from '@supabase/supabase-js'
import { config } from './env'

const authLocks = new Map<string, Promise<unknown>>()

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
	auth: {
		lock: async <R>(name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => {
			while (authLocks.has(name)) {
				try { await authLocks.get(name) } catch { }
			}
			const promise = fn()
			authLocks.set(name, promise)
			try {
				return await promise
			} finally {
				authLocks.delete(name)
			}
		},
	},
})