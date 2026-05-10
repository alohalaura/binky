import { useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useAuth } from '../auth/authContext'

const POST_LOGIN_REDIRECT_KEY = 'post_login_redirect'

export function Signup() {
  const { session, signInWithGoogle } = useAuth()
  const location = useLocation()
  const [serverError, setServerError] = useState('')

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

    if (error) setServerError(error.message)
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <Card className="mt-6">
        <h1 className="font-display text-2xl font-semibold text-text-dark">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-text-mid">
          Sign up with your Google account.
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
          Already have an account?{' '}
          <Link className="font-semibold text-lavender" to="/login">
            Log in
          </Link>
        </div>
      </Card>
    </main>
  )
}

