import { createBrowserClient } from '@supabase/ssr'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Cookie-based auth storage (chunked + base64url) so PKCE `code_verifier` survives
 * the OAuth redirect. Plain localStorage often loses it; @supabase/ssr matches hosted docs.
 */
export const supabase = createBrowserClient(url, key, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
  },
})
