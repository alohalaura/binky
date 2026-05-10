import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useBunny } from '../hooks/useBunny'
import { useAuth } from '../auth/authContext'
import { useWeightLogs } from '../hooks/useWeightLogs'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { EmptyState } from '../components/ui/EmptyState'
import { Modal } from '../components/ui/Modal'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function safeDateLabel(ts) {
  if (!ts) return '—'
  try {
    return format(new Date(ts), 'MMM d, yyyy')
  } catch {
    return String(ts).slice(0, 10)
  }
}

function gramsToKg(grams) {
  const n = typeof grams === 'number' ? grams : Number(grams)
  if (!Number.isFinite(n)) return null
  return n / 1000
}

function formatKgFromGrams(grams) {
  const kg = gramsToKg(grams)
  if (kg == null) return '—'
  // Keep 2 decimals but trim trailing zeros (e.g. 2.50 → 2.5, 2.00 → 2)
  const fixed = kg.toFixed(2)
  const trimmed = fixed.replace(/\.?0+$/, '')
  return `${trimmed} kg`
}

function toIsoFromDateInput(dateStr) {
  // Store a stable-ish timestamp for a date-only input.
  // Noon local time avoids most timezone edge cases (DST / offset flip).
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toISOString()
}

function gramsFromKgInput(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '')
  if (!raw) return null
  const kg = Number.parseFloat(raw)
  if (!Number.isFinite(kg) || kg <= 0) throw new Error('Enter a valid weight in kg.')
  return kg * 1000
}

function yAxisDomainFromKg(values) {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v))
  if (!nums.length) return ['auto', 'auto']

  let min = Math.min(...nums)
  let max = Math.max(...nums)

  // Add some breathing room so changes are visually meaningful.
  const range = Math.max(max - min, 0)
  const pad = Math.max(range * 0.15, 0.05) // at least 50g padding
  min -= pad
  max += pad

  // Keep within a sensible lower bound (no negative kg).
  min = Math.max(0, min)

  // If all weights are identical, still show a small window.
  if (min === max) {
    min = Math.max(0, min - 0.1)
    max = max + 0.1
  }

  return [min, max]
}

function kgInputFromGrams(grams) {
  const kg = gramsToKg(grams)
  if (kg == null) return ''
  // For inputs, show up to 3 decimals (grams precision) but trim zeros.
  const fixed = kg.toFixed(3)
  return fixed.replace(/\.?0+$/, '')
}

function dateInputFromTimestamp(ts) {
  if (!ts) return ''
  try {
    return format(new Date(ts), 'yyyy-MM-dd')
  } catch {
    return String(ts).slice(0, 10)
  }
}

function DeltaBadge({ delta }) {
  if (delta == null || !Number.isFinite(delta) || delta === 0) {
    return <Badge className="bg-cream text-text-dark">±0 kg</Badge>
  }

  const positive = delta > 0
  return (
    <Badge
      className={cx(
        positive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
      )}
    >
      {positive ? '+' : '−'}
      {Math.abs(delta).toFixed(2).replace(/\.?0+$/, '')} kg
    </Badge>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  return (
    <div className="rounded-2xl border border-lavender-mid/30 bg-warm-white px-3 py-2 text-xs shadow-sm">
      <div className="font-semibold text-text-dark">{label}</div>
      <div className="mt-1 text-text-mid">{formatKgFromGrams(p?.weight_g)}</div>
    </div>
  )
}

function deltaAt(logs, idx) {
  if (idx <= 0) return null
  const prev = logs[idx - 1]
  const cur = logs[idx]
  if (!prev || !cur) return null
  if (prev.weight_g == null || cur.weight_g == null) return null
  const d = Number(cur.weight_g) - Number(prev.weight_g)
  return Number.isFinite(d) ? d : null
}

export function WeightLog() {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()
  const { data: logs = [], isLoading, error } = useWeightLogs()
  const queryClient = useQueryClient()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [kg, setKg] = useState('')
  const [dateLogged, setDateLogged] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const hasLogs = logs.length > 0

  const { latest, previous, latestDelta } = useMemo(() => {
    if (!logs.length) return { latest: null, previous: null, latestDelta: null }
    const latestRow = logs[logs.length - 1]
    const prevRow = logs.length >= 2 ? logs[logs.length - 2] : null
    const delta =
      prevRow?.weight_g != null && latestRow?.weight_g != null
        ? gramsToKg(Number(latestRow.weight_g) - Number(prevRow.weight_g))
        : null
    return { latest: latestRow, previous: prevRow, latestDelta: delta }
  }, [logs])

  const chartData = useMemo(() => {
    return logs
      .filter((l) => l?.logged_at && l?.weight_g != null)
      .map((l) => {
        const dateLabel = safeDateLabel(l.logged_at)
        const weight = Number(l.weight_g)
        return {
          id: l.id,
          label: dateLabel,
          logged_at: l.logged_at,
          // Keep the original grams value for the hover tooltip formatting.
          weight_g: Number.isFinite(weight) ? weight : null,
          weight_kg: Number.isFinite(weight) ? gramsToKg(weight) : null,
        }
      })
      .filter((d) => d.weight_kg != null)
  }, [logs])

  const yDomain = useMemo(() => yAxisDomainFromKg(chartData.map((d) => d.weight_kg)), [chartData])

  async function handleSave() {
    if (saving) return
    setSaveError('')

    if (!user?.id) {
      setSaveError('You must be signed in.')
      return
    }
    if (!activeBunnyId) {
      setSaveError('Please choose an active bunny first.')
      return
    }

    let parsedGrams
    try {
      parsedGrams = gramsFromKgInput(kg)
    } catch (err) {
      setSaveError(err?.message || 'Enter a valid weight in kg.')
      return
    }
    if (parsedGrams == null) {
      setSaveError('Enter a valid weight in kg.')
      return
    }
    if (!dateLogged) {
      setSaveError('Choose a date.')
      return
    }

    setSaving(true)
    try {
      if (editTarget?.id) {
        const payload = {
          logged_at: toIsoFromDateInput(dateLogged),
          weight_g: parsedGrams,
        }
        const { error: upErr } = await supabase.from('weight_logs').update(payload).eq('id', editTarget.id)
        if (upErr) throw upErr
      } else {
        const payload = {
          bunny_id: activeBunnyId,
          logged_at: toIsoFromDateInput(dateLogged),
          weight_g: parsedGrams,
        }
        const { error: insertError } = await supabase.from('weight_logs').insert(payload)
        if (insertError) throw insertError
      }

      await queryClient.invalidateQueries({
        queryKey: ['weight_logs', user?.id ?? null, activeBunnyId ?? null],
      })

      setKg('')
      setDateLogged(format(new Date(), 'yyyy-MM-dd'))
      setSheetOpen(false)
      setEditTarget(null)
    } catch (err) {
      setSaveError(err?.message || (editTarget ? 'Failed to update weight entry.' : 'Failed to save weight entry.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDelete() {
    if (saving) return
    if (!deleteTarget?.id) return
    if (!user?.id) return
    if (!activeBunnyId) return

    setSaveError('')
    setSaving(true)
    try {
      const { error: delErr } = await supabase.from('weight_logs').delete().eq('id', deleteTarget.id)
      if (delErr) throw delErr
      await queryClient.invalidateQueries({
        queryKey: ['weight_logs', user?.id ?? null, activeBunnyId ?? null],
      })
      setDeleteTarget(null)
      if (editTarget?.id === deleteTarget.id) {
        setEditTarget(null)
        setSheetOpen(false)
      }
    } catch (err) {
      setSaveError(err?.message || 'Failed to delete weight entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">Weight Log</h1>
          <p className="mt-2 text-sm text-text-mid">
            Track weight in kg over time for your active bunny.
          </p>
        </div>
        <Button
          type="button"
          className={cx(!activeBunnyId ? 'opacity-60' : 'hover:brightness-95')}
          disabled={!activeBunnyId}
          onClick={() => {
            setSaveError('')
            setEditTarget(null)
            setKg('')
            setDateLogged(format(new Date(), 'yyyy-MM-dd'))
            setSheetOpen(true)
          }}
        >
          Log Weight
        </Button>
      </div>

      <div className="mt-6">
        {!activeBunnyId ? (
          <div className="text-sm text-text-mid">
            Choose an active bunny in the header to see weight entries.
          </div>
        ) : isLoading ? (
          <div className="text-sm text-text-mid">Loading…</div>
        ) : null}

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error.message}
          </div>
        ) : null}

        {activeBunnyId && !isLoading && !hasLogs ? (
          <EmptyState
            className="mt-4"
            title="No weight entries yet"
            description="Log your bunny’s weight to see trends over time."
            actionLabel="Log first weight"
            onAction={() => {
              setSaveError('')
              setSheetOpen(true)
            }}
          />
        ) : null}

        {activeBunnyId && hasLogs ? (
          <div className="mt-4 space-y-3">
            <Card>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-mid">
                    Most recent
                  </div>
                  <div className="mt-2 font-display text-3xl font-semibold text-text-dark">
                    {formatKgFromGrams(latest?.weight_g)}
                  </div>
                  <div className="mt-1 text-sm text-text-mid">{safeDateLabel(latest?.logged_at)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <DeltaBadge delta={latestDelta} />
                  <div className="text-xs text-text-mid">
                    vs {previous ? safeDateLabel(previous.logged_at) : 'previous'}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-mid">
                Trend
              </div>
              <div className="mt-3 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(139, 129, 171, 0.20)" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: '#6B6476' }}
                      axisLine={{ stroke: 'rgba(139, 129, 171, 0.30)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#6B6476' }}
                      axisLine={{ stroke: 'rgba(139, 129, 171, 0.30)' }}
                      tickLine={false}
                      width={48}
                      domain={yDomain}
                      tickCount={6}
                      tickFormatter={(v) => `${Number(v).toFixed(2).replace(/\\.?0+$/, '')}`}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="weight_kg"
                      stroke="#8B5CF6"
                      strokeWidth={2.5}
                      dot={{ r: 2.5 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-end justify-between gap-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-text-mid">
                  All entries
                </div>
                <div className="text-xs text-text-mid">{logs.length} total</div>
              </div>

              <div className="mt-3 grid gap-2">
                {[...logs]
                  .slice()
                  .reverse()
                  .map((row, revIdx) => {
                    const idx = logs.length - 1 - revIdx
                    const d = gramsToKg(deltaAt(logs, idx))
                    return (
                      <div
                        key={row.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-text-dark">
                              {formatKgFromGrams(row.weight_g)}
                            </div>
                            {idx > 0 ? <DeltaBadge delta={d} /> : null}
                          </div>
                          <div className="mt-0.5 text-xs text-text-mid">
                            {safeDateLabel(row.logged_at)}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-1 text-xs font-semibold text-text-dark hover:border-lavender"
                            onClick={() => {
                              setSaveError('')
                              setEditTarget(row)
                              setKg(kgInputFromGrams(row?.weight_g))
                              setDateLogged(dateInputFromTimestamp(row?.logged_at) || format(new Date(), 'yyyy-MM-dd'))
                              setSheetOpen(true)
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                            onClick={() => setDeleteTarget(row)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      <Drawer
        title={editTarget ? 'Edit weight' : 'Log weight'}
        open={sheetOpen}
        onClose={() => {
          if (saving) return
          setSheetOpen(false)
          setEditTarget(null)
        }}
      >
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {!activeBunnyId ? (
              <div className="rounded-2xl border border-lavender-mid/30 bg-warm-white p-4 text-sm text-text-mid">
                Choose an active bunny in the header first.
              </div>
            ) : null}

            <div className="grid gap-4">
              <div>
                <div className="text-xs font-semibold text-text-mid">Weight (kg)</div>
                <Input
                  className="mt-2"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 2.85"
                  step="0.01"
                  value={kg}
                  onChange={(e) => setKg(e.target.value)}
                  disabled={saving}
                  min="0.01"
                />
              </div>

              <div>
                <div className="text-xs font-semibold text-text-mid">Date</div>
                <Input
                  className="mt-2"
                  type="date"
                  value={dateLogged}
                  onChange={(e) => setDateLogged(e.target.value)}
                  disabled={saving}
                />
              </div>

              {saveError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {saveError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0 border-t border-lavender-mid/30 bg-warm-white p-5">
            <Button
              type="button"
              className={cx(
                'w-full',
                !activeBunnyId || saving ? 'opacity-60' : 'hover:brightness-95',
              )}
              disabled={!activeBunnyId || saving}
              onClick={handleSave}
            >
              {saving ? 'Saving…' : editTarget ? 'Save changes' : 'Save weight'}
            </Button>
          </div>
        </div>
      </Drawer>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => (saving ? null : setDeleteTarget(null))}
            aria-label="Close delete confirmation"
          />
          <div className="relative w-full max-w-lg">
            <Modal title="Delete weight entry?">
              <div className="space-y-4">
                <div className="text-sm text-text-mid">
                  This will permanently delete:
                  <div className="mt-2 text-sm font-semibold text-text-dark">
                    {formatKgFromGrams(deleteTarget.weight_g)} on {safeDateLabel(deleteTarget.logged_at)}
                  </div>
                </div>

                {saveError ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {saveError}
                  </div>
                ) : null}

                <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
                  <button
                    type="button"
                    className="rounded-full border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm font-semibold text-text-dark hover:brightness-95"
                    onClick={() => setDeleteTarget(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={cx(
                      'rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700',
                      saving ? 'opacity-60' : 'hover:brightness-95',
                    )}
                    disabled={saving}
                    onClick={handleConfirmDelete}
                  >
                    {saving ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        </div>
      ) : null}
    </main>
  )
}

