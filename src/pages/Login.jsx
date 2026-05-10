import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useAuth } from '../auth/authContext'
import {
  clearOAuthStartOrigin,
  readOAuthStartOrigin,
  rememberOAuthStartOrigin,
} from '../lib/oauthOrigin'
import { supabase } from '../lib/supabase'

const POST_LOGIN_REDIRECT_KEY = 'post_login_redirect'

export function Login() {
  const { session, loading, signInWithGoogle } = useAuth()
  const location = useLocation()
  const [serverError, setServerError] = useState('')
  const codeExchangeTried = useRef(false)
  /** If set, OAuth return landed on a different origin than where sign-in started (PKCE cannot work). */
  const oauthReturnMismatch = useRef('')

  useEffect(() => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    const err =
      url.searchParams.get('error_description') ||
      url.searchParams.get('error') ||
      hash.get('error_description') ||
      hash.get('error')
    const code = url.searchParams.get('code')

    if (code) {
      const started = readOAuthStartOrigin()
      if (started && started !== window.location.origin) {
        oauthReturnMismatch.current = started
        clearOAuthStartOrigin()
      }
    }

    queueMicrotask(() => {
      if (err) {
        setServerError(decodeURIComponent(String(err).replace(/\+/g, ' ')))
        window.history.replaceState(window.history.state, '', url.pathname)
      } else if (oauthReturnMismatch.current) {
        const from = oauthReturnMismatch.current
        setServerError(
          `Sign-in started on ${from}, but you were sent back to ${window.location.origin}. The PKCE secret is tied to where you started. In Supabase → Authentication → URL, add Redirect URLs for every host you use (including Vercel preview URLs or add a wildcard), and use the same address in the browser that is listed in Supabase.`,
        )
      }
    })
  }, [])

  useEffect(() => {
    if (loading || session || codeExchangeTried.current || oauthReturnMismatch.current) return
    const code = new URLSearchParams(window.location.search).get('code')
    if (!code) return

    codeExchangeTried.current = true
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (cancelled) return
      if (error) {
        const started = readOAuthStartOrigin()
        let msg = error.message
        if (
          typeof msg === 'string' &&
          msg.includes('verifier') &&
          started &&
          started === window.location.origin
        ) {
          msg += ` If you did not change sites, try: disable extensions that block cookies, use a normal browser window, and confirm Vercel has the same VITE_SUPABASE_* env as local.`
        }
        if (
          typeof msg === 'string' &&
          msg.includes('verifier') &&
          started &&
          started !== window.location.origin
        ) {
          msg = `Started on ${started}, returned on ${window.location.origin}. Add both URLs to Supabase Redirect URLs. Original error: ${error.message}`
        }
        if (
          typeof msg === 'string' &&
          msg.includes('verifier') &&
          !started
        ) {
          msg += ` If you use a Vercel preview URL, add it explicitly under Supabase → Authentication → URL → Redirect URLs (wildcard \`https://*.vercel.app/**\` is easiest).`
        }
        setServerError(msg)
        return
      }
      if (data.session) {
        const u = new URL(window.location.href)
        u.searchParams.delete('code')
        u.searchParams.delete('state')
        window.history.replaceState(window.history.state, '', `${u.pathname}${u.search}${u.hash}`)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [loading, session])

  const from = location.state?.from || '/'
  const storedFrom = localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
  const nextPath = storedFrom || from || '/'

  if (session) {
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
    clearOAuthStartOrigin()
    return <Navigate to={nextPath} replace />
  }

  async function onContinueWithGoogle() {
    setServerError('')
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, from)
    rememberOAuthStartOrigin()

    const { error } = await signInWithGoogle({
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) {
      setServerError(error.message)
      return
    }
    // navigation happens after OAuth redirect completes
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <Card className="mt-6">
        <h1 className="font-display text-2xl font-semibold text-text-dark">
          Welcome back
        </h1>
        <p className="mt-2 text-sm text-text-mid">
          Log in with your Google account.
        </p>

        {serverError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {serverError}
          </div>
        )}

        <div className="mt-6" />
        <Button className="w-full" onClick={onContinueWithGoogle} type="button">
          Continue with Google
        </Button>

        <div className="mt-4 text-center text-sm text-text-mid">
          Don’t have an account?{' '}
          <Link className="font-semibold text-lavender" to="/signup">
            Sign up
          </Link>
        </div>
      </Card>
    </main>
  )
}

