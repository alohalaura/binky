import { useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useBunhouses } from '../../hooks/useBunhouses'
import { useBunhouse } from '../../hooks/useBunhouse'
import { useBunnies } from '../../hooks/useBunnies'
import { useBunny } from '../../hooks/useBunny'

function displayName(bunny) {
  return bunny?.name?.trim() ? bunny.name : 'Unnamed bunny'
}

function displayBunhouseName(bunhouse) {
  return bunhouse?.name?.trim() ? bunhouse.name : 'Unnamed bunhouse'
}

export function BunnySwitcher() {
  const { data: bunhouses = [], isLoading: bunhousesLoading } = useBunhouses()
  const { activeBunhouseId, setActiveBunhouseId } = useBunhouse()
  const { data: bunnies = [], isLoading } = useBunnies()
  const { activeBunnyId, setActiveBunnyId, clearActiveBunny } = useBunny()
  useLocation()

  useEffect(() => {
    if (bunhouses.length === 0) return

    const stillValid =
      activeBunhouseId && bunhouses.some((b) => b.id === activeBunhouseId)
    if (!stillValid) {
      setActiveBunhouseId(bunhouses[0].id)
    }
  }, [activeBunhouseId, bunhouses, setActiveBunhouseId])

  useEffect(() => {
    // Bunhouse changes invalidate the currently selected bunny.
    clearActiveBunny()
  }, [activeBunhouseId, clearActiveBunny])

  useEffect(() => {
    if (bunnies.length === 0) return

    // If there's no active bunny (or it's stale from a previous session/user),
    // default to the first available bunny for this user.
    const stillValid = activeBunnyId && bunnies.some((b) => b.id === activeBunnyId)
    if (!stillValid) {
      setActiveBunnyId(bunnies[0].id)
    }
  }, [activeBunnyId, bunnies, setActiveBunnyId])

  return (
    <div className="flex w-auto max-w-full flex-row flex-wrap items-center gap-2 sm:gap-3">
      <div className="relative w-max max-w-full shrink-0">
        <select
          className="box-border h-10 w-max min-w-0 max-w-[calc(100vw-5.5rem)] appearance-none rounded-xl border border-lavender-mid/30 bg-warm-white px-2 pr-8 text-xs leading-none outline-none focus:border-lavender [field-sizing:content] sm:max-w-[min(16rem,calc(100vw-8rem))] sm:px-3 sm:pr-10 sm:text-sm sm:leading-normal"
          value={activeBunhouseId ?? ''}
          onChange={(e) => setActiveBunhouseId(e.target.value || null)}
          disabled={bunhousesLoading || bunhouses.length === 0}
          aria-label="Select bunhouse"
        >
          {bunhouses.length === 0 ? (
            <option value="">No bunhouses yet</option>
          ) : null}
          {bunhouses.map((bunhouse) => (
            <option key={bunhouse.id} value={bunhouse.id}>
              {displayBunhouseName(bunhouse)}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-mid sm:right-3 sm:h-4 sm:w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <div className="relative w-max max-w-full shrink-0">
        <select
          className="box-border h-10 w-max min-w-0 max-w-[calc(100vw-5.5rem)] appearance-none rounded-xl border border-lavender-mid/30 bg-warm-white px-2 pr-8 text-xs leading-none outline-none focus:border-lavender [field-sizing:content] sm:max-w-[min(14rem,calc(100vw-8rem))] sm:px-3 sm:pr-10 sm:text-sm sm:leading-normal"
          value={activeBunnyId ?? ''}
          onChange={(e) => setActiveBunnyId(e.target.value || null)}
          disabled={isLoading || bunnies.length === 0}
          aria-label="Select active bunny"
        >
          {bunnies.length === 0 ? <option value="">No bunnies yet</option> : null}
          {bunnies.map((bunny) => (
            <option key={bunny.id} value={bunny.id}>
              {displayName(bunny)}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-mid sm:right-3 sm:h-4 sm:w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
            clipRule="evenodd"
          />
        </svg>
      </div>
    </div>
  )
}

