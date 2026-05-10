import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useAuth } from '../auth/authContext'

const POST_LOGIN_REDIRECT_KEY = 'post_login_redirect'

export function Login() {
  const { session, signInWithGoogle } = useAuth()
  const location = useLocation()
  const [serverError, setServerError] = useState('')

  useEffect(() => {
    const url = new URL(window.location.href)
    const hash = new URLSearchParams(url.hash.replace(/^#/, ''))
    const err =
      url.searchParams.get('error_description') ||
      url.searchParams.get('error') ||
      hash.get('error_description') ||
      hash.get('error')
    if (err) {
      setServerError(decodeURIComponent(String(err).replace(/\+/g, ' ')))
      window.history.replaceState(window.history.state, '', url.pathname)
    }
  }, [])

  const from = location.state?.from || '/'
  const storedFrom = localStorage.getItem(POST_LOGIN_REDIRECT_KEY)
  const nextPath = storedFrom || from || '/'

  if (session) {
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY)
    return <Navigate to={nextPath} replace />
  }

  async function onContinueWithGoogle() {
    setServerError('')
    localStorage.setItem(POST_LOGIN_REDIRECT_KEY, from)

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

