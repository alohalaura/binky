import { createClient } from '@supabase/supabase-js'

/** First-party cookie backup for the PKCE verifier (see createPkceFriendlyStorage). */
const PKCE_VERIFIER_COOKIE = 'binky_oauth_pkce_verifier'

function readPkceVerifierCookie() {
  if (typeof document === 'undefined') return null
  const prefix = `${PKCE_VERIFIER_COOKIE}=`
  for (const part of document.cookie.split(';')) {
    const p = part.trim()
    if (p.startsWith(prefix)) {
      try {
        return decodeURIComponent(p.slice(prefix.length))
      } catch {
        return null
      }
    }
  }
  return null
}

function writePkceVerifierCookie(value) {
  if (typeof document === 'undefined') return
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:'
  // Short-lived: OAuth round-trip should finish within minutes.
  document.cookie = [
    `${PKCE_VERIFIER_COOKIE}=${encodeURIComponent(value)}`,
    'path=/',
    'max-age=900',
    'SameSite=Lax',
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function clearPkceVerifierCookie() {
  if (typeof document === 'undefined') return
  document.cookie = `${PKCE_VERIFIER_COOKIE}=;path=/;max-age=0`
}

/**
 * PKCE stores a code_verifier and must read it again after Google redirects back.
 * On some browsers (Safari, iOS, installed PWA) localStorage/sessionStorage are empty or
 * partitioned after the redirect; a SameSite=Lax cookie often survives the return trip.
 */
function createPkceFriendlyStorage() {
  const isVerifierKey = (key) =>
    typeof key === 'string' && key.includes('code-verifier')

  return {
    getItem(key) {
      try {
        const fromLocal = localStorage.getItem(key)
        if (fromLocal != null) return fromLocal
        if (isVerifierKey(key)) {
          const fromSession = sessionStorage.getItem(key)
          if (fromSession != null) return fromSession
          return readPkceVerifierCookie()
        }
        return null
      } catch {
        if (isVerifierKey(key)) {
          try {
            const s = sessionStorage.getItem(key)
            if (s != null) return s
          } catch {
            /* ignore */
          }
          return readPkceVerifierCookie()
        }
        return null
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
        writePkceVerifierCookie(value)
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
      if (isVerifierKey(key)) {
        clearPkceVerifierCookie()
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

