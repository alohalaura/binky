/** Set before redirecting to Google; used to detect Supabase sending you back to a different host. */
export const BINKY_OAUTH_START_ORIGIN_KEY = 'binky_oauth_start_origin'

export function rememberOAuthStartOrigin() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(BINKY_OAUTH_START_ORIGIN_KEY, window.location.origin)
  } catch {
    /* ignore */
  }
}

export function readOAuthStartOrigin() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    return sessionStorage.getItem(BINKY_OAUTH_START_ORIGIN_KEY)
  } catch {
    return null
  }
}

export function clearOAuthStartOrigin() {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.removeItem(BINKY_OAUTH_START_ORIGIN_KEY)
  } catch {
    /* ignore */
  }
}
