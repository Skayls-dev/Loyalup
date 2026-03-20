import { createClient } from '@supabase/supabase-js'
import { config } from './env'

export const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey, {
	auth: {
		// Avoid Navigator LockManager contention causing auth token lock timeouts in some browsers/extensions.
		lock: async (_name, _timeout, fn) => await fn(),
	},
})