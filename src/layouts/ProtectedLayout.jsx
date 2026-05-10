import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { BunnySwitcher } from '../components/bunny/BunnySwitcher'
import { useBunhouses } from '../hooks/useBunhouses'
import { useBunhouse } from '../hooks/useBunhouse'
import { useBunnies } from '../hooks/useBunnies'
import { BottomNav } from '../components/nav/BottomNav'
import { IosAddToHomeScreenBanner } from '../components/pwa/IosAddToHomeScreenBanner'
import { LoadingScreen } from '../components/ui/LoadingScreen.jsx'
import { supabase } from '../lib/supabase'

export function ProtectedLayout() {
  const queryClient = useQueryClient()
  const { loading, session, user } = useAuth()
  const location = useLocation()
  const [inviteAcceptanceSettled, setInviteAcceptanceSettled] = useState(false)
  const { data: bunhouses = [], isLoading: bunhousesLoading } = useBunhouses()
  const { activeBunhouseId, setActiveBunhouseId } = useBunhouse()
  const { data: bunnies = [], isLoading: bunniesLoading } = useBunnies()
  const isOnboarding = location.pathname.startsWith('/onboarding')

  useEffect(() => {
    if (!activeBunhouseId && bunhouses.length > 0) {
      setActiveBunhouseId(bunhouses[0].id)
    }
  }, [activeBunhouseId, bunhouses, setActiveBunhouseId])

  useEffect(() => {
    let cancelled = false
    setInviteAcceptanceSettled(false)

    async function acceptInvites() {
      let acceptedAny = false
      try {
        const email = user?.email ? String(user.email).trim().toLowerCase() : ''
        if (!session?.user?.id || !email) return

        const { data: invites, error } = await supabase
          .from('bunhouse_invites')
          .select('id, bunhouse_id, email, accepted_at')
          .eq('accepted_at', null)
          .eq('email', email)
        if (cancelled) return
        if (error) return
        if (!Array.isArray(invites) || invites.length === 0) return

        for (const inv of invites) {
          if (!inv?.bunhouse_id || !inv?.id) continue

          const { error: memberErr } = await supabase
            .from('bunhouse_members')
            .insert({ bunhouse_id: inv.bunhouse_id, user_id: session.user.id })
          if (memberErr) continue

          await supabase
            .from('bunhouse_invites')
            .update({ accepted_at: new Date().toISOString(), accepted_by: session.user.id })
            .eq('id', inv.id)
          acceptedAny = true
        }

        if (!cancelled && acceptedAny) {
          await queryClient.invalidateQueries({ queryKey: ['bunhouses', session.user.id] })
          await queryClient.invalidateQueries({ queryKey: ['bunnies', session.user.id] })
        }
      } finally {
        if (!cancelled) setInviteAcceptanceSettled(true)
      }
    }

    acceptInvites()
    return () => {
      cancelled = true
    }
  }, [session, user?.email, user?.id, queryClient])

  if (loading) {
    return <LoadingScreen message="Checking your session…" />
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    )
  }

  if (
    !inviteAcceptanceSettled ||
    bunhousesLoading ||
    (!activeBunhouseId && bunhouses.length > 0) ||
    bunniesLoading
  ) {
    return (
      <LoadingScreen
        message={!inviteAcceptanceSettled ? 'Applying your invites…' : 'Loading your bunhouse…'}
      />
    )
  }

  if (!isOnboarding && bunhouses.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  if (!isOnboarding && bunnies.length === 0) {
    return <Navigate to="/onboarding" replace />
  }
  if (isOnboarding && bunnies.length > 0) {
    return <Navigate to="/" replace />
  }

  return (
    <div className={isOnboarding ? '' : 'pb-24'}>
      <div className="mx-auto max-w-4xl p-6">
      {!isOnboarding ? (
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/pwa-192.png"
              alt="Binky Labs logo"
              className="h-9 w-9 shrink-0 rounded-xl"
              width="36"
              height="36"
              decoding="async"
            />
            <div className="min-w-0 hidden sm:block">
              <div className="truncate font-display text-lg font-medium text-text-dark">
                Binky Labs
              </div>
            </div>
          </div>
          {bunhouses.length > 0 ? <BunnySwitcher /> : null}
        </header>
      ) : null}

      <div className={!isOnboarding ? 'mt-6' : ''}>
        <Outlet />
      </div>
      </div>

      {!isOnboarding ? <BottomNav /> : null}
      {!isOnboarding ? <IosAddToHomeScreenBanner /> : null}
    </div>
  )
}

