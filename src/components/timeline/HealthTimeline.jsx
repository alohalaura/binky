import { useMemo, useState } from 'react'
import { useBunny } from '../../hooks/useBunny'
import { useTimelineEvents } from '../../hooks/useTimelineEvents'
import { TimelineEvent } from './TimelineEvent'
import { EmptyState } from '../ui/EmptyState'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'symptom', label: 'Symptoms' },
  { id: 'vet_visit', label: 'Vet visits' },
  { id: 'prescription', label: 'Medicine' },
]

export function HealthTimeline() {
  const { activeBunnyId } = useBunny()
  const { data: events = [], isLoading, error } = useTimelineEvents()
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return events
    return events.filter((e) => e.type === filter)
  }, [events, filter])

  const emptyState =
    !activeBunnyId
      ? 'Choose an active bunny in Settings to see the timeline.'
      : isLoading
        ? 'Loading…'
        : filtered.length
          ? ''
          : ''

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="flex min-w-max gap-2 pb-4 sm:pb-0">
          {FILTERS.map((f) => {
            const active = filter === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cx(
                  'rounded-full border px-4 py-2 text-sm font-semibold',
                  active
                    ? 'border-lavender bg-lavender text-white'
                    : 'border-lavender-mid/30 bg-warm-white text-text-dark hover:brightness-95',
                )}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 text-sm text-text-mid">{emptyState}</div>
      {error ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error?.message || 'Failed to load timeline.'}
        </div>
      ) : null}

      {activeBunnyId && !isLoading && filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No timeline events yet"
            description="Once you log symptoms, visits, or medicines, you’ll see them all here in one timeline."
          />
        </div>
      ) : null}

      {activeBunnyId && filtered.length ? (
        <div className="mt-4">
          {filtered.map((event, idx) => (
            <TimelineEvent
              key={`${event.type}-${event.id}`}
              event={event}
              showConnector={idx !== filtered.length - 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

