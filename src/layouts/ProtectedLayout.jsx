import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
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
import { sweepPendingBunhouseInvitesClient } from '../lib/clientInviteAccept'

export function ProtectedLayout() {
  const queryClient = useQueryClient()
  const { loading, session, user } = useAuth()
  const location = useLocation()
  const [inviteAcceptanceSettled, setInviteAcceptanceSettled] = useState(false)
  const inviteRunRef = useRef({ userId: null, email: null })
  const { data: bunhouses = [], isLoading: bunhousesLoading } = useBunhouses()
  const { activeBunhouseId, setActiveBunhouseId, clearActiveBunhouse } = useBunhouse()
  const { data: bunnies = [], isLoading: bunniesLoading } = useBunnies()
  const isOnboarding = location.pathname.startsWith('/onboarding')
  const userId = user?.id ?? null
  const userEmail = user?.email ?? null

  // Persisted active bunhouse can be stale (different user, removed membership, or old dev state).
  // Reconcile before route guards run; otherwise we query the wrong bunhouse_id, get zero bunnies, and
  // send invitees to onboarding. (BunnySwitcher also fixes this, but only after this layout allows render.)
  useLayoutEffect(() => {
    if (bunhouses.length === 0) {
      if (activeBunhouseId != null) clearActiveBunhouse()
      return
    }
    const stillValid =
      activeBunhouseId != null && bunhouses.some((b) => b.id === activeBunhouseId)
    if (!stillValid) {
      setActiveBunhouseId(bunhouses[0].id)
    }
  }, [activeBunhouseId, bunhouses, clearActiveBunhouse, setActiveBunhouseId])

  useEffect(() => {
    let cancelled = false

    if (!userId) {
      inviteRunRef.current = { userId: null, email: null }
      setInviteAcceptanceSettled(false)
      return
    }

    const alreadyRan =
      inviteRunRef.current.userId === userId &&
      inviteRunRef.current.email === userEmail
    if (alreadyRan) {
      setInviteAcceptanceSettled(true)
      return
    }

    setInviteAcceptanceSettled(false)

    async function acceptInvites() {
      try {
        if (cancelled) return

        /* Primary: SECURITY DEFINER RPC (migration 010). */
        const { error: rpcErr } = await supabase.rpc('accept_pending_bunhouse_invites')
        if (import.meta.env.DEV && rpcErr)
          console.warn('accept_pending_bunhouse_invites', rpcErr.message)

        /* Mop-up: no-op when RPC succeeded; catches missing migration or partial RPC failures. */
        if (!cancelled) {
          await sweepPendingBunhouseInvitesClient({
            cancelled,
            uid: userId,
            session,
            user,
          })
        }
      } finally {
        /* invalidateQueries alone does not block: cached [] + isLoading false sent invitees to onboarding before refetch. */
        if (!cancelled) {
          try {
            await queryClient.refetchQueries({ queryKey: ['bunhouses', userId] })
          } catch {
            /* Non-fatal: guards use whatever cache has on next paint. */
          }
          inviteRunRef.current = { userId, email: userEmail }
          setInviteAcceptanceSettled(true)
        }
      }
    }

    acceptInvites()
    return () => {
      cancelled = true
    }
  }, [userId, userEmail, queryClient, session, user])

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

  const activeBunhouseBelongsToUser =
    bunhouses.length === 0 ||
    (activeBunhouseId != null && bunhouses.some((b) => b.id === activeBunhouseId))

  const waitingForBunnies = bunhouses.length > 0 && bunniesLoading

  if (
    !inviteAcceptanceSettled ||
    bunhousesLoading ||
    (bunhouses.length > 0 && !activeBunhouseBelongsToUser) ||
    waitingForBunnies
  ) {
    return <LoadingScreen message="Loading…" />
  }

  if (!isOnboarding && bunhouses.length === 0) {
    return <Navigate to="/onboarding" replace />
  }

  /* Invited members may join a bunhouse that already has bunnies, or an empty hub; skip forcing a new bunny profile if they belong to any bunhouse. Solo new users hit onboarding via bunhouses.length === 0 above. */
  if (isOnboarding && bunnies.length > 0) {
    return <Navigate to="/" replace />
  }

  return (
    <div className={isOnboarding ? '' : 'pb-24'}>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {!isOnboarding ? (
        <header className="flex min-w-0 flex-row items-center justify-between gap-2 sm:gap-4">
          <div className="flex min-w-0 shrink-0 items-center gap-3">
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
          {bunhouses.length > 0 ? (
            <div className="min-w-0 shrink-0">
              <BunnySwitcher />
            </div>
          ) : null}
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

