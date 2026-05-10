import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SymptomLogger } from '../components/symptoms/SymptomLogger'
import { SymptomDetailsDrawer } from '../components/symptoms/SymptomDetailsDrawer'
import { useSymptoms } from '../hooks/useSymptoms'
import { useBunny } from '../hooks/useBunny'
import { Card } from '../components/ui/Card'
import { Drawer } from '../components/ui/Drawer'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { BODY_AREAS } from '../lib/constants'
import { toSentenceCase } from '../lib/text'
import { EmptyState } from '../components/ui/EmptyState'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function Chip({ children, className = '' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full bg-cream px-3 py-1 text-[11px] font-semibold text-text-dark',
        className,
      )}
    >
      {children}
    </span>
  )
}

function severityChipClass(n) {
  if (n === 1) return 'bg-severity-1/15'
  if (n === 2) return 'bg-severity-2/15'
  if (n === 3) return 'bg-severity-3/15'
  if (n === 4) return 'bg-severity-4/15'
  if (n === 5) return 'bg-severity-5/15'
  return ''
}

function safeDateTimeLabel(ts) {
  if (!ts) return '—'
  try {
    return format(new Date(ts), 'MMM d, yyyy, h:mm a')
  } catch {
    return new Date(ts).toLocaleString()
  }
}

function observedSinceLabel(value) {
  if (!value || typeof value !== 'string') return ''
  const d = `${value.slice(0, 10)}T00:00:00`
  try {
    return format(new Date(d), 'MMM d, yyyy')
  } catch {
    return value.slice(0, 10)
  }
}

export function Symptoms({ defaultOpen = false }) {
  const navigate = useNavigate()
  const { activeBunnyId } = useBunny()
  const { data: logs = [], isLoading, error } = useSymptoms()
  const [drawerOpen, setDrawerOpen] = useState(() => Boolean(defaultOpen))
  const [urgency, setUrgency] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const queryClient = useQueryClient()

  const [filters, setFilters] = useState({
    from: '',
    to: '',
    bodyArea: 'all',
  })

  const hasLogs = logs.length > 0
  const bodyAreaOptions = useMemo(() => {
    const seen = new Set(BODY_AREAS)
    for (const l of logs) {
      if (l?.body_area && typeof l.body_area === 'string') seen.add(l.body_area)
    }
    return ['all', ...Array.from(seen)]
  }, [logs])

  const filteredLogs = useMemo(() => {
    const fromTs = filters.from ? new Date(`${filters.from}T00:00:00`).getTime() : null
    const toTs = filters.to ? new Date(`${filters.to}T23:59:59`).getTime() : null

    return logs.filter((l) => {
      if (filters.bodyArea !== 'all' && l.body_area !== filters.bodyArea) return false

      if (fromTs || toTs) {
        const t = l?.logged_at ? new Date(l.logged_at).getTime() : null
        if (!t) return false
        if (fromTs && t < fromTs) return false
        if (toTs && t > toTs) return false
      }

      return true
    })
  }, [logs, filters])

  const sortedLogs = useMemo(() => filteredLogs, [filteredLogs])

  return (
    <main>
      <h1 className="text-xl font-semibold">Symptoms</h1>
      <p className="mt-2 text-sm text-text-mid">
        Log what you’re seeing so you can spot patterns and share clear notes with your vet.
      </p>

      <div className="mt-6">
        <div className="text-sm text-text-mid">
          {!activeBunnyId
            ? 'Choose an active bunny in Settings to see symptom logs.'
            : isLoading
              ? 'Loading…'
                : hasLogs
                  ? ''
                  : ''}
        </div>

          {activeBunnyId && !isLoading && !hasLogs ? (
            <EmptyState
              className="mt-4"
              title="No symptom logs yet"
              description="Log what you’re seeing so you can spot patterns and share clear notes with your vet."
              actionLabel="Log first symptom"
              onAction={() => {
                setEditTarget(null)
                setViewTarget(null)
                setDrawerOpen(true)
              }}
            />
          ) : null}

        {activeBunnyId && hasLogs ? (
          <div className="mt-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="sm:w-52">
                  <div className="text-xs font-semibold text-text-dark">Body area</div>
                  <div className="relative">
                    <select
                      value={filters.bodyArea}
                      onChange={(e) => setFilters((f) => ({ ...f, bodyArea: e.target.value }))}
                      className="mt-1 h-10 w-full appearance-none rounded-xl border border-lavender-mid/30 bg-warm-white px-3 pr-10 text-sm outline-none focus:border-lavender"
                    >
                      {bodyAreaOptions.map((opt) => (
                        <option key={opt} value={opt}>
                        {opt === 'all' ? 'All areas' : toSentenceCase(opt)}
                        </option>
                      ))}
                    </select>
                    <svg
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-mid"
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
                <div className="sm:w-40">
                  <div className="text-xs font-semibold text-text-dark">From</div>
                  <input
                    type="date"
                    value={filters.from}
                    onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-lavender-mid/30 bg-warm-white px-3 text-sm outline-none focus:border-lavender"
                  />
                </div>
                <div className="sm:w-40">
                  <div className="text-xs font-semibold text-text-dark">To</div>
                  <input
                    type="date"
                    value={filters.to}
                    onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
                    className="mt-1 h-10 w-full rounded-xl border border-lavender-mid/30 bg-warm-white px-3 text-sm outline-none focus:border-lavender"
                  />
                </div>

                {/* Intentionally no count indicator here to keep filters minimalist. */}
              </div>

              {filters.bodyArea !== 'all' || filters.from || filters.to ? (
                <button
                  type="button"
                  className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-2 text-xs font-semibold text-text-dark hover:border-lavender"
                  onClick={() => setFilters({ from: '', to: '', bodyArea: 'all' })}
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {urgency ? (
          <div className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold">Urgent</div>
                <div className="mt-1 text-orange-800">
                  Severity {urgency.severity} can be serious. Consider contacting your rabbit-savvy
                  vet as soon as possible.
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-orange-200 bg-warm-white px-3 py-2 text-xs font-semibold text-orange-900"
                onClick={() => setUrgency(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error.message}
          </div>
        ) : null}

        {deleteError ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {deleteError}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2">
          {hasLogs && filteredLogs.length === 0 ? (
            <div className="text-sm text-text-mid">No symptom logs match your filters.</div>
          ) : null}
          {sortedLogs.map((log) => (
            <Card key={log.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-text-dark">
                    {toSentenceCase(log.body_area)} · {toSentenceCase(log.symptom_type)}
                  </div>
                  <div className="mt-1 text-xs font-semibold text-text-mid">
                    {safeDateTimeLabel(log.logged_at)}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-1 text-xs font-semibold text-text-dark hover:border-lavender"
                    onClick={() => {
                      setDeleteError('')
                      setUrgency(null)
                      setViewTarget(log)
                    }}
                  >
                    View
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-1 text-xs font-semibold text-text-dark hover:border-lavender"
                    onClick={() => {
                      setDeleteError('')
                      setUrgency(null)
                      setViewTarget(null)
                      setEditTarget(log)
                      setDrawerOpen(true)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                    onClick={async () => {
                      setDeleteError('')
                      if (!log?.id) return
                      const ok = window.confirm('Delete this symptom log? This cannot be undone.')
                      if (!ok) return
                      const { error: delError } = await supabase
                        .from('symptom_logs')
                        .delete()
                        .eq('id', log.id)
                      if (delError) {
                        setDeleteError(delError.message || 'Failed to delete symptom log.')
                        return
                      }
                      await queryClient.invalidateQueries({
                        queryKey: ['symptom_logs'],
                      })
                      await queryClient.invalidateQueries({ queryKey: ['recent_activity'] })
                      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="mt-1 flex flex-wrap gap-2">
                <Chip className={severityChipClass(log.severity)}>
                  Severity {log.severity ?? '—'}
                </Chip>
                {log.observed_since ? (
                  <Chip>Since {observedSinceLabel(log.observed_since)}</Chip>
                ) : null}
              </div>

              {log.notes ? (
                <div className="mt-2 whitespace-pre-wrap text-xs text-text-mid">{log.notes}</div>
              ) : null}
            </Card>
          ))}
        </div>
      </div>

      <button
        type="button"
        className={cx(
          'fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-lavender text-white shadow-lg',
          !activeBunnyId ? 'opacity-60' : 'hover:brightness-95',
        )}
        onClick={() => {
          setEditTarget(null)
          setViewTarget(null)
          setDrawerOpen(true)
        }}
        disabled={!activeBunnyId}
        aria-label="Add symptom"
      >
        <svg className="mx-auto h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 4a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 10 4Z" />
        </svg>
      </button>

      <Drawer
        title={editTarget ? 'Edit symptom' : 'Add symptom'}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditTarget(null)
          setViewTarget(null)
          if (defaultOpen) navigate('/symptoms', { replace: true })
        }}
      >
        <SymptomLogger
          container="none"
          mode={editTarget ? 'edit' : 'create'}
          initialLog={editTarget}
          hideHeader
          onSaved={(row) => {
            setDrawerOpen(false)
            setEditTarget(null)
            setViewTarget(null)
            if (row?.severity >= 4) setUrgency({ severity: row.severity })
          }}
        />
      </Drawer>

      <SymptomDetailsDrawer
        open={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        log={viewTarget}
        dateLabel={viewTarget ? safeDateTimeLabel(viewTarget.logged_at) : '—'}
        observedSince={
          viewTarget?.observed_since ? observedSinceLabel(viewTarget.observed_since) : ''
        }
        onEdit={() => {
          const log = viewTarget
          if (!log) return
          setViewTarget(null)
          setEditTarget(log)
          setDrawerOpen(true)
        }}
        onDelete={async () => {
          if (!viewTarget) return
          const id = viewTarget.id
          const ok = window.confirm('Delete this symptom log? This cannot be undone.')
          if (!ok) return
          setDeleteError('')
          const { error: delError } = await supabase.from('symptom_logs').delete().eq('id', id)
          if (delError) {
            setDeleteError(delError.message || 'Failed to delete symptom log.')
            return
          }
          setViewTarget(null)
          await queryClient.invalidateQueries({ queryKey: ['symptom_logs'] })
          await queryClient.invalidateQueries({ queryKey: ['recent_activity'] })
          await queryClient.invalidateQueries({ queryKey: ['timeline'] })
        }}
      />
    </main>
  )
}

