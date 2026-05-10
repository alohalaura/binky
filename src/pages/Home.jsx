import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { bunnyAgeLabel, estimatedHumanAgeYears, safeDateLabel } from '../lib/bunnyPresentation.js'
import { useQueryClient } from '@tanstack/react-query'
import { useBunnies } from '../hooks/useBunnies'
import { useBunny } from '../hooks/useBunny'
import { useWeightLogs } from '../hooks/useWeightLogs'
import { useRecentActivity } from '../hooks/useRecentActivity'
import { useExpenses } from '../hooks/useExpenses'
import { Card } from '../components/ui/Card'
import { Drawer } from '../components/ui/Drawer'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { iconClassForType } from '../lib/eventStyles'
import { toSentenceCase } from '../lib/text'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'
import { STORAGE_BUCKETS } from '../lib/storageBuckets'
import {
  IconStethoscope,
  IconPill,
  IconClipboardText,
  IconReceipt2,
  IconScale,
} from '@tabler/icons-react'

const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function gramsToKg(grams) {
  const n = typeof grams === 'number' ? grams : Number(grams)
  if (!Number.isFinite(n)) return null
  return n / 1000
}

function formatKgFromGrams(grams) {
  const kg = gramsToKg(grams)
  if (kg == null) return '—'
  const fixed = kg.toFixed(2)
  const trimmed = fixed.replace(/\.?0+$/, '')
  return `${trimmed} kg`
}

function gramsFromKgInput(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '')
  if (!raw) return null
  const kg = Number.parseFloat(raw)
  if (!Number.isFinite(kg) || kg <= 0) throw new Error('Enter a valid weight in kg.')
  return kg * 1000
}

function currencyFmt(amount, currency = 'PHP') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return '—'
  const cur = String(currency || 'PHP').trim() || 'PHP'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n)
  } catch {
    return `${cur} ${n.toFixed(2)}`
  }
}

function monthKeyFromDateColumn(d) {
  if (!d) return ''
  return String(d).slice(0, 7) // YYYY-MM
}

function relativeLabel(ts) {
  if (!ts) return '—'
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true })
  } catch {
    return '—'
  }
}

function ActivityIcon({ type }) {
  return (
    <span
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-2xl',
        iconClassForType(type),
      )}
      aria-hidden="true"
    >
      {type === 'symptom' ? (
        <IconStethoscope size={20} stroke={2.25} aria-hidden="true" />
      ) : type === 'prescription' ? (
        <IconPill size={20} stroke={2.25} aria-hidden="true" />
      ) : type === 'vet_visit' || type === 'record' ? (
        <IconClipboardText size={20} stroke={2.25} aria-hidden="true" />
      ) : (
        <IconClipboardText size={20} stroke={2.25} aria-hidden="true" />
      )}
    </span>
  )
}

function activityTitle(e) {
  if (e?.type === 'symptom') {
    const a = toSentenceCase(e?.title?.body_area)
    const s = toSentenceCase(e?.title?.symptom_type)
    if (a && s) return `${a} · ${s}`
    return a || s || 'Symptom logged'
  }
  if (e?.type === 'prescription') {
    const drug = String(e?.title?.drug_name ?? '').trim()
    return drug ? `Prescription: ${drug}` : 'Prescription added'
  }
  const t = String(e?.title?.title ?? '').trim()
  if (t) return t
  return 'Vet visit'
}

function QuickActionIcon({ kind, className = '' }) {
  const props = { size: 20, stroke: 2.25, className: cx('h-5 w-5', className), 'aria-hidden': true }

  if (kind === 'symptom') return <IconStethoscope {...props} />
  if (kind === 'record') return <IconClipboardText {...props} />
  if (kind === 'medicine') return <IconPill {...props} />
  if (kind === 'expense') return <IconReceipt2 {...props} />
  return <IconScale {...props} />
}

function HomeFab({ disabled, onAddWeight }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={cx(
          'fixed bottom-28 right-6 z-40 h-14 w-14 rounded-full bg-lavender text-white shadow-lg',
          disabled ? 'opacity-60' : 'hover:brightness-95',
        )}
        aria-label="Add entry"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <svg className="mx-auto h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 4a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 10 4Z" />
        </svg>
      </button>

      <Drawer
        title="Add entry"
        open={open}
        onClose={() => setOpen(false)}
      >
        <div className="p-5">
          <div className="grid gap-3">
            <Link
              to="/symptoms/new"
              className="flex items-center gap-4 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 hover:border-lavender"
              onClick={() => setOpen(false)}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-salmon-light text-salmon">
                  <QuickActionIcon kind="symptom" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-text-dark">Symptom</div>
                  <div className="text-xs font-semibold text-text-mid">Log what you’re seeing</div>
                </div>
              </div>
            </Link>

            <Link
              to="/records/new"
              className="flex items-center gap-4 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 hover:border-lavender"
              onClick={() => setOpen(false)}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-lavender-light text-lavender-dark">
                  <QuickActionIcon kind="record" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-text-dark">Record</div>
                  <div className="text-xs font-semibold text-text-mid">Add a vet visit or document</div>
                </div>
              </div>
            </Link>

            <Link
              to="/prescriptions/new"
              className="flex items-center gap-4 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 hover:border-lavender"
              onClick={() => setOpen(false)}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-severity-3/15 text-severity-3">
                  <QuickActionIcon kind="medicine" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-text-dark">Medicine</div>
                  <div className="text-xs font-semibold text-text-mid">Track a prescription</div>
                </div>
              </div>
            </Link>

            <Link
              to="/expenses/new"
              className="flex items-center gap-4 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 hover:border-lavender"
              onClick={() => setOpen(false)}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-cream text-text-dark">
                  <QuickActionIcon kind="expense" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-text-dark">Expense</div>
                  <div className="text-xs font-semibold text-text-mid">Save costs and receipts</div>
                </div>
              </div>
            </Link>

            <button
              type="button"
              className="flex items-center gap-4 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-left hover:border-lavender"
              onClick={() => {
                setOpen(false)
                onAddWeight?.()
              }}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-lavender-light text-lavender">
                  <QuickActionIcon kind="weight" className="text-lavender" />
                </span>
                <div>
                  <div className="text-sm font-semibold text-text-dark">Weight</div>
                  <div className="text-xs font-semibold text-text-mid">Log today’s weight</div>
                </div>
              </div>
            </button>
          </div>
        </div>
      </Drawer>
    </>
  )
}

export function Home() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { data: bunnies = [] } = useBunnies()
  const { activeBunnyId } = useBunny()
  const { data: weightLogs = [] } = useWeightLogs()
  const { data: recent = [], isLoading: activityLoading, error: activityError } = useRecentActivity()
  const { data: expensesData, isLoading: expensesLoading } = useExpenses()

  const activeBunny = useMemo(() => {
    if (!activeBunnyId) return null
    return bunnies.find((b) => b.id === activeBunnyId) ?? null
  }, [bunnies, activeBunnyId])

  const [bunnyPhotoUrl, setBunnyPhotoUrl] = useState('')

  useEffect(() => {
    let active = true
    async function run() {
      const value = activeBunny?.photo_url
      if (!value || typeof value !== 'string') {
        if (active) setBunnyPhotoUrl('')
        return
      }
      const trimmed = value.trim()
      if (!trimmed) {
        if (active) setBunnyPhotoUrl('')
        return
      }
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (active) setBunnyPhotoUrl(trimmed)
        return
      }

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKETS.bunnyProfilePhotos)
        .createSignedUrl(trimmed, SIGNED_URL_TTL_SECONDS)

      if (!active) return
      if (error) {
        setBunnyPhotoUrl('')
        return
      }
      setBunnyPhotoUrl(data?.signedUrl ?? '')
    }

    run()
    return () => {
      active = false
    }
  }, [activeBunny?.photo_url])

  const latestWeight = useMemo(() => {
    if (!weightLogs.length) return null
    return weightLogs[weightLogs.length - 1]
  }, [weightLogs])

  const expenses = useMemo(() => expensesData?.expenses ?? [], [expensesData?.expenses])
  const last5Expenses = useMemo(() => expenses.slice(0, 5), [expenses])
  const { totalAllTimePhp, totalThisMonthPhp } = useMemo(() => {
    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let n = 0
    let m = 0
    for (const e of expenses) {
      const amt = Number(e.amount)
      if (!Number.isFinite(amt)) continue
      n += amt
      if (monthKeyFromDateColumn(e.expense_date) === thisMonthKey) m += amt
    }
    return { totalAllTimePhp: n, totalThisMonthPhp: m }
  }, [expenses])

  const [weightSheetOpen, setWeightSheetOpen] = useState(false)
  const [kg, setKg] = useState('')
  const [dateLogged, setDateLogged] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [savingWeight, setSavingWeight] = useState(false)
  const [weightError, setWeightError] = useState('')

  async function saveWeight() {
    if (savingWeight) return
    setWeightError('')

    if (!user?.id) {
      setWeightError('You must be signed in.')
      return
    }
    if (!activeBunnyId) {
      setWeightError('Please choose an active bunny first.')
      return
    }

    let parsedGrams
    try {
      parsedGrams = gramsFromKgInput(kg)
    } catch (err) {
      setWeightError(err?.message || 'Enter a valid weight in kg.')
      return
    }
    if (parsedGrams == null) {
      setWeightError('Enter a valid weight in kg.')
      return
    }
    if (!dateLogged) {
      setWeightError('Choose a date.')
      return
    }

    setSavingWeight(true)
    try {
      const iso = new Date(`${dateLogged}T12:00:00`).toISOString()
      const payload = { bunny_id: activeBunnyId, logged_at: iso, weight_g: parsedGrams }
      const { error } = await supabase.from('weight_logs').insert(payload)
      if (error) throw error
      await queryClient.invalidateQueries({
        queryKey: ['weight_logs', user?.id ?? null, activeBunnyId ?? null],
      })
      setKg('')
      setDateLogged(format(new Date(), 'yyyy-MM-dd'))
      setWeightSheetOpen(false)
    } catch (err) {
      setWeightError(err?.message || 'Failed to save weight entry.')
    } finally {
      setSavingWeight(false)
    }
  }

  return (
    <main>
      <div className="mt-5">
        <div className="grid gap-4 md:grid-cols-[1fr_17.25rem] md:items-stretch">
          <div className="min-w-0 h-full rounded-2xl border border-lavender/30 bg-warm-white px-4 py-3">
            <div className="flex h-full items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-2xl border border-lavender/30 bg-warm-white">
                {bunnyPhotoUrl ? (
                  <img
                    src={bunnyPhotoUrl}
                    alt={activeBunny?.name?.trim() ? `${activeBunny.name.trim()} photo` : 'Bunny photo'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lavender">
                    <span className="text-xs font-semibold">No photo</span>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <div className="truncate font-display text-xl font-semibold text-text-dark">
                  {activeBunny?.name?.trim() ? activeBunny.name.trim() : 'Your bunny'}
                </div>
                <div className="mt-1 text-sm font-semibold text-text-mid">
                  {(activeBunny?.breed?.trim() ? activeBunny.breed.trim() : 'Breed') +
                    ' · ' +
                    bunnyAgeLabel(activeBunny?.date_of_birth) +
                    (() => {
                      const human = estimatedHumanAgeYears(activeBunny?.date_of_birth)
                      return human != null ? ` (Human age: ${human} yrs old)` : ''
                    })()}
                </div>
              </div>
            </div>
          </div>

          <div className="flex h-full w-full flex-col justify-center rounded-2xl border border-lavender/30 bg-warm-white px-4 py-3">
            <div className="flex items-center justify-between gap-6">
              <div className="text-sm font-semibold text-text-dark">Current weight</div>
              <Link
                to="/weight"
                className="shrink-0 text-xs font-semibold text-lavender-dark hover:text-lavender"
              >
                View log
              </Link>
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="font-display text-2xl font-semibold text-text-dark">
                {formatKgFromGrams(latestWeight?.weight_g)}
              </div>
              <div className="text-xs font-semibold text-text-mid">
                {latestWeight?.logged_at ? `as of ${format(new Date(latestWeight.logged_at), 'MMM d')}` : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section>
          <div className="flex items-end justify-between gap-4">
            <div className="text-base font-semibold text-text-dark">Expenses</div>
            <Link
              to="/expenses"
              className="text-xs font-semibold text-text-mid hover:text-text-dark"
            >
              View all
            </Link>
          </div>

          {!activeBunnyId ? (
            <div className="mt-4 text-sm text-text-mid">Choose an active bunny in the header.</div>
          ) : expensesLoading ? (
            <div className="mt-4 text-sm text-text-mid">Loading…</div>
          ) : (
            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 xl:grid-cols-2">
                <Card className="px-4 py-3">
                  <div className="text-sm font-semibold text-text-dark">Total expenses</div>
                  <div className="mt-2 text-2xl font-semibold text-text-dark">
                    {currencyFmt(totalAllTimePhp, 'PHP')}
                  </div>
                </Card>

                <Card className="px-4 py-3">
                  <div className="text-sm font-semibold text-text-dark">This month</div>
                  <div className="mt-2 text-2xl font-semibold text-text-dark">
                    {currencyFmt(totalThisMonthPhp, 'PHP')}
                  </div>
                </Card>
              </div>

              {last5Expenses.length ? (
                <div className="grid gap-2">
                  {last5Expenses.map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text-dark">
                          {ex.description?.trim() ? ex.description.trim() : 'Expense'}
                        </div>
                        <div className="mt-0.5 text-xs font-semibold text-text-mid">
                          {safeDateLabel(ex.expense_date)} · {ex.category}
                        </div>
                      </div>
                      <div className="shrink-0 text-sm font-semibold text-text-dark">
                        {currencyFmt(ex.amount, ex.currency || 'PHP')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No expenses yet"
                  description="Start tracking costs—food, litter, toys, and vet visits."
                  actionLabel="Add first expense"
                  onAction={() => {
                    navigate('/expenses/new')
                  }}
                />
              )}
            </div>
          )}
        </section>

        <section className="flex h-full flex-col">
          <div className="flex items-end justify-between gap-4">
            <div className="text-base font-semibold text-text-dark">Recent activity</div>
            <Link
              to="/timeline"
              className="text-xs font-semibold text-text-mid hover:text-text-dark"
            >
              View all
            </Link>
          </div>

          {!activeBunnyId ? (
            <div className="mt-4 text-sm text-text-mid">Choose an active bunny in the header.</div>
          ) : activityLoading ? (
            <div className="mt-4 text-sm text-text-mid">Loading…</div>
          ) : activityError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {activityError?.message || 'Failed to load recent activity.'}
            </div>
          ) : recent.length === 0 ? (
            <div className="mt-4 flex-1">
              <EmptyState
                className="h-full"
                title="No activity yet"
                description="Start building your bunny’s health timeline."
                actionLabel="Log first symptom"
                onAction={() => {
                  navigate('/symptoms/new')
                }}
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-2">
              {recent.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ActivityIcon type={e.type} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-text-dark">
                        {activityTitle(e)}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-text-mid">
                        {relativeLabel(e.ts)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <HomeFab
        disabled={!activeBunnyId}
        onAddWeight={() => {
          setWeightError('')
          setKg('')
          setDateLogged(format(new Date(), 'yyyy-MM-dd'))
          setWeightSheetOpen(true)
        }}
      />

      <Drawer
        title="Log weight"
        open={weightSheetOpen}
        onClose={() => {
          if (savingWeight) return
          setWeightSheetOpen(false)
        }}
      >
        <div className="flex h-full flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="grid gap-4">
              <div>
                <div className="text-xs font-semibold text-text-mid">Weight (kg)</div>
                <Input
                  className="mt-2"
                  type="number"
                  inputMode="decimal"
                  placeholder="e.g. 1.9"
                  step="0.01"
                  value={kg}
                  onChange={(e) => setKg(e.target.value)}
                  disabled={savingWeight}
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
                  disabled={savingWeight}
                />
              </div>
              {weightError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {weightError}
                </div>
              ) : null}
            </div>
          </div>
          <div className="shrink-0 border-t border-lavender-mid/30 bg-warm-white p-5">
            <Button
              type="button"
              className={cx('w-full', !activeBunnyId || savingWeight ? 'opacity-60' : 'hover:brightness-95')}
              disabled={!activeBunnyId || savingWeight}
              onClick={saveWeight}
            >
              {savingWeight ? 'Saving…' : 'Save weight'}
            </Button>
          </div>
        </div>
      </Drawer>
    </main>
  )
}
