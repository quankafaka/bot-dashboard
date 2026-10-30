import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const configError = !url || !key
  ? 'VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set. Add them to .env.local (local) or to the Vercel project settings.'
  : null

export const supabase = configError ? null : createClient(url, key)

// The public site (the steam-chasing-dashboard Vercel project sets
// VITE_PUBLIC=1): no login, and every read goes to the anon-readable
// *_public views (migration 016), which hold the CAD books only.
export const isPublic = import.meta.env.VITE_PUBLIC === '1'
export const table = (name) => supabase.from(isPublic ? `${name}_public` : name)
