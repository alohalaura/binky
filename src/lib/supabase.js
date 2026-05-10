import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Implicit grant: session tokens are delivered in the URL hash after Google redirects
 * back—no PKCE code_verifier in storage. PKCE failed reliably on this app even when
 * the start/return origin matched (cookie + storage approaches). Tradeoff: tokens pass
 * through the fragment; the client strips them on load (detectSessionInUrl).
 */
export const supabase = createClient(url, key, {
  auth: {
    flowType: 'implicit',
    detectSessionInUrl: true,
    persistSession: true,
  },
})
