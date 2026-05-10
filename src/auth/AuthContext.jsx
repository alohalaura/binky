import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './authContext'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    async function init() {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error) {
        setSession(null)
        setUser(null)
        setLoading(false)
        return
      }

      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    }

    init()

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession)
        setUser(nextSession?.user ?? null)
        setLoading(false)
      },
    )

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      session,
      user,
      loading,
      signInWithGoogle: ({ redirectTo } = {}) =>
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            ...(redirectTo ? { redirectTo } : {}),
            queryParams: {
              prompt: 'select_account',
            },
          },
        }),
      signOut: () => supabase.auth.signOut(),
    }),
    [session, user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
