import { createClient } from '@supabase/supabase-js'

/**
 * PKCE needs the code_verifier in browser storage across the redirect to Google and back.
 * Mirror `*-code-verifier` into sessionStorage as well—some environments lose one store; both
 * survive normal same-tab redirects on the same origin.
 */
function createPkceFriendlyStorage() {
  const isVerifierKey = (key) =>
    typeof key === 'string' && key.includes('code-verifier')

  return {
    getItem(key) {
      try {
        const fromLocal = localStorage.getItem(key)
        if (fromLocal != null) return fromLocal
        if (isVerifierKey(key)) return sessionStorage.getItem(key)
        return null
      } catch {
        return isVerifierKey(key) ? sessionStorage.getItem(key) : null
      }
    },
    setItem(key, value) {
      try {
        localStorage.setItem(key, value)
      } catch {
        /* private mode / quota */
      }
      if (isVerifierKey(key)) {
        try {
          sessionStorage.setItem(key, value)
        } catch {
          /* ignore */
        }
      }
    },
    removeItem(key) {
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* ignore */
      }
    },
  }
}

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
      storage: createPkceFriendlyStorage(),
    },
  },
)

