import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useBunny } from '../hooks/useBunny'
import { usePrescriptions } from '../hooks/usePrescriptions'
import { usePrescriptionAdministrations } from '../hooks/usePrescriptionAdministrations'
import { useRecords } from '../hooks/useRecords'
import { useAuth } from '../auth/authContext'
import { Drawer } from '../components/ui/Drawer'
import { PrescriptionCard } from '../components/prescriptions/PrescriptionCard'
import { PrescriptionForm } from '../components/prescriptions/PrescriptionForm'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { EmptyState } from '../components/ui/EmptyState'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function todayDateKey() {
  return format(new Date(), 'yyyy-MM-dd')
}

function isDueOnDate(prescription, dateKey) {
  if (!prescription?.is_active) return false
  if (prescription.start_date && prescription.start_date > dateKey) return false
  if (prescription.end_date && prescription.end_date < dateKey) return false
  return true
}

function safeDateTimeLabel(ts) {
  if (!ts) return ''
  try {
    return format(new Date(ts), 'MMM d, h:mm a')
  } catch {
    return String(ts)
  }
}

export function Prescriptions({ defaultOpen = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()
  const { data: prescriptions = [], isLoading, error } = usePrescriptions()
  const {
    data: administrations = [],
    isLoading: administrationsLoading,
    error: administrationsError,
  } = usePrescriptionAdministrations()
  const { data: records = [] } = useRecords()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('today')
  const [drawerOpen, setDrawerOpen] = useState(() => Boolean(defaultOpen))
  const [addFormKey, setAddFormKey] = useState(() => (defaultOpen ? 1 : 0))
  const [saving, setSaving] = useState(false)
  const [completeError, setCompleteError] = useState('')
  const [completingId, setCompletingId] = useState(null)
  const [checkError, setCheckError] = useState('')
  const [checkingId, setCheckingId] = useState(null)

  const recordById = useMemo(() => {
    const m = new Map()
    for (const r of records) {
      if (r?.id) m.set(r.id, r)
    }
    return m
  }, [records])

  const { activeList, pastList } = useMemo(() => {
    const active = []
    const past = []
    for (const p of prescriptions) {
      if (p?.is_active) active.push(p)
      else past.push(p)
    }

    function endTs(p) {
      if (!p?.end_date) return null
      const t = new Date(`${p.end_date}T00:00:00`).getTime()
      return Number.isFinite(t) ? t : null
    }

    active.sort((a, b) => {
      const ae = endTs(a)
      const be = endTs(b)
      if (ae == null && be == null) return 0
      if (ae == null) return 1
      if (be == null) return -1
      return ae - be
    })

    past.sort((a, b) => {
      const ac = a?.completed_at ? new Date(a.completed_at).getTime() : 0
      const bc = b?.completed_at ? new Date(b.completed_at).getTime() : 0
      if (bc !== ac) return bc - ac
      const acr = a?.created_at ? new Date(a.created_at).getTime() : 0
      const bcr = b?.created_at ? new Date(b.created_at).getTime() : 0
      return bcr - acr
    })

    return { activeList: active, pastList: past }
  }, [prescriptions])

  const todayKey = todayDateKey()

  const todaysList = useMemo(() => {
    return activeList.filter((p) => isDueOnDate(p, todayKey))
  }, [activeList, todayKey])

  const todayLogByPrescriptionId = useMemo(() => {
    const m = new Map()
    for (const row of administrations) {
      if (row?.administered_on === todayKey && row?.prescription_id) {
        m.set(row.prescription_id, row)
      }
    }
    return m
  }, [administrations, todayKey])

  const completedTodayCount = useMemo(() => {
    return todaysList.filter((p) => todayLogByPrescriptionId.has(p.id)).length
  }, [todaysList, todayLogByPrescriptionId])

  function linkedLabel(recordId) {
    const r = recordById.get(recordId)
    if (!r) return null
    const title = r.title?.trim()
    if (title) return title
    return String(r.category || 'Record').replaceAll('_', ' ')
  }

  async function handleAdd(form) {
    if (!user?.id) throw new Error('You must be signed in.')
    if (!activeBunnyId) throw new Error('Please choose an active bunny first.')

    setSaving(true)
    try {
      const insertPayload = {
        bunny_id: activeBunnyId,
        drug_name: form.drug_name,
        dosage: form.dosage,
        frequency: form.frequency,
        start_date: form.start_date,
        end_date: form.end_date,
        prescribing_vet: form.prescribing_vet,
        notes: form.notes,
        record_id: form.record_id,
        is_active: true,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('prescriptions')
        .insert(insertPayload)
        .select('id, drug_name, created_at, bunny_id')
        .single()
      if (insertError) throw insertError

      await queryClient.invalidateQueries({
        queryKey: ['prescriptions', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['recent_activity', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['timeline', user?.id ?? null, activeBunnyId ?? null],
      })

      // Make Home -> Recent activity update immediately (staleTime is 5m + persisted cache).
      if (inserted?.id) {
        const nowTs = inserted?.created_at ? new Date(inserted.created_at).getTime() : Date.now()
        const ev = {
          id: `prescription:${inserted.id}`,
          type: 'prescription',
          title: { drug_name: inserted?.drug_name ?? null },
          ts: Number.isFinite(nowTs) ? nowTs : Date.now(),
          raw: inserted,
        }
        queryClient.setQueryData(
          ['recent_activity', user?.id ?? null, activeBunnyId ?? null],
          (prev) => {
            const list = Array.isArray(prev) ? prev : []
            const next = [ev, ...list.filter((x) => x?.id !== ev.id)]
            next.sort((a, b) => (b?.ts ?? 0) - (a?.ts ?? 0))
            return next.slice(0, 5)
          },
        )
      }

      setDrawerOpen(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleMarkComplete(id) {
    if (!id || !user?.id) return
    setCompleteError('')
    setCompletingId(id)
    try {
      const { error: upError } = await supabase
        .from('prescriptions')
        .update({
          is_active: false,
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (upError) throw upError

      await queryClient.invalidateQueries({
        queryKey: ['prescriptions', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['recent_activity', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['timeline', user?.id ?? null, activeBunnyId ?? null],
      })
    } catch (err) {
      setCompleteError(err?.message || 'Could not update prescription.')
    } finally {
      setCompletingId(null)
    }
  }

  async function handleToggleToday(prescription) {
    if (!prescription?.id || !user?.id || !activeBunnyId) return
    if (checkingId) return

    const existing = todayLogByPrescriptionId.get(prescription.id)
    setCheckError('')
    setCheckingId(prescription.id)
    try {
      if (existing?.id) {
        const { error: deleteError } = await supabase
          .from('prescription_administrations')
          .delete()
          .eq('id', existing.id)
        if (deleteError) throw deleteError
      } else {
        const { error: insertError } = await supabase
          .from('prescription_administrations')
          .upsert(
            {
              prescription_id: prescription.id,
              bunny_id: activeBunnyId,
              administered_on: todayKey,
              administered_at: new Date().toISOString(),
            },
            { onConflict: 'prescription_id,administered_on' },
          )
        if (insertError) throw insertError
      }

      await queryClient.invalidateQueries({
        queryKey: ['prescription_administrations', user?.id ?? null, activeBunnyId ?? null],
      })
    } catch (err) {
      setCheckError(err?.message || 'Could not update today’s checklist.')
    } finally {
      setCheckingId(null)
    }
  }

  const hasAny = prescriptions.length > 0

  return (
    <main>
      <h1 className="text-xl font-semibold">Medicine tracker</h1>

      <div className="mt-4 inline-flex rounded-full border border-lavender-mid/30 bg-warm-white p-1 shadow-sm">
        {[
          { id: 'today', label: 'Today' },
          { id: 'list', label: 'Ongoing/active medicines' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={cx(
              'rounded-full px-4 py-2 text-sm font-semibold transition',
              activeTab === tab.id
                ? 'bg-lavender text-white shadow-sm'
                : 'text-text-mid hover:bg-lavender-light hover:text-text-dark',
            )}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <div className="text-sm text-text-mid">
          {!activeBunnyId
            ? 'Choose an active bunny in the header to see prescriptions.'
            : isLoading
              ? 'Loading…'
              : hasAny
                ? ''
                : ''}
        </div>

        {activeBunnyId && !isLoading && !hasAny ? (
          <EmptyState
            className="mt-4"
            title="No medicine courses yet"
            description="Track meds, dates, and notes so you can stay consistent and share a clean history with your vet."
            actionLabel="Add medicine"
            onAction={() => {
              setAddFormKey((k) => k + 1)
              setDrawerOpen(true)
            }}
          />
        ) : null}

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error.message}
          </div>
        ) : null}

        {administrationsError ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {administrationsError.message}
          </div>
        ) : null}

        {completeError ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {completeError}
          </div>
        ) : null}

        {checkError ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {checkError}
          </div>
        ) : null}

        {activeBunnyId && hasAny && activeTab === 'today' ? (
          <div className="mt-4 space-y-5">
            <section className="rounded-2xl border border-lavender-mid/30 bg-warm-white p-4 shadow-sm">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-mid">
                    Today
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-text-dark">
                    Medicine checklist
                  </h2>
                  <p className="mt-1 text-sm text-text-mid">
                    {format(new Date(), 'EEEE, MMM d')} · {completedTodayCount} of{' '}
                    {todaysList.length} checked
                  </p>
                </div>
                {administrationsLoading ? (
                  <div className="text-xs font-semibold text-text-mid">Loading history…</div>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3">
                {todaysList.length ? (
                  todaysList.map((p) => {
                    const checked = todayLogByPrescriptionId.has(p.id)
                    return (
                      <label
                        key={p.id}
                        className={cx(
                          'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition',
                          checked
                            ? 'border-emerald-200 bg-emerald-50'
                            : 'border-lavender-mid/30 bg-cream hover:border-lavender',
                          checkingId === p.id ? 'opacity-70' : '',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={checkingId === p.id}
                          onChange={() => handleToggleToday(p)}
                        />
                        <span
                          className={cx(
                            'mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border',
                            checked
                              ? 'border-lavender bg-lavender text-white'
                              : 'border-lavender-mid bg-warm-white',
                          )}
                          aria-hidden="true"
                        >
                          {checked ? (
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path
                                fillRule="evenodd"
                                d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.32a1 1 0 0 1-1.42.002l-3.75-3.78a1 1 0 1 1 1.42-1.41l3.04 3.064 6.54-6.604a1 1 0 0 1 1.414-.006Z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : null}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-text-dark">
                            {p.drug_name?.trim() || 'Medicine'}
                          </span>
                          <span className="mt-1 block text-xs text-text-mid">
                            {[p.dosage, p.frequency].filter(Boolean).join(' · ') || 'No dosage set'}
                          </span>
                          {checked ? (
                            <span className="mt-2 block text-xs font-semibold text-emerald-700">
                              Given today
                            </span>
                          ) : null}
                        </span>
                      </label>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-lavender-mid/30 bg-cream p-4 text-sm text-text-mid">
                    No active medicines are due today.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-lavender-mid/30 bg-warm-white p-4 shadow-sm">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-text-mid">
                    History log
                  </div>
                  <h2 className="mt-1 text-lg font-semibold text-text-dark">Recent checks</h2>
                </div>
                <div className="text-xs text-text-mid">{administrations.length} saved</div>
              </div>

              <div className="mt-4 grid gap-2">
                {administrations.length ? (
                  administrations.slice(0, 12).map((row) => {
                    const med = row.prescriptions ?? {}
                    return (
                      <div
                        key={row.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-lavender-mid/30 bg-cream px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-text-dark">
                            {med.drug_name?.trim() || 'Medicine'}
                          </div>
                          <div className="mt-1 text-xs text-text-mid">
                            {[med.dosage, med.frequency].filter(Boolean).join(' · ') || 'Dose checked'}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs font-semibold text-text-mid">
                          {safeDateTimeLabel(row.administered_at)}
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="rounded-2xl border border-lavender-mid/30 bg-cream p-4 text-sm text-text-mid">
                    No medicine checks logged yet.
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {activeBunnyId && hasAny && activeTab === 'list' ? (
          <div className="mt-4 space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-text-mid">
                Medicine list
              </div>
              <p className="mt-1 text-sm text-text-mid">
                Ongoing, active, past, and completed medicines.
              </p>
            </div>

            {activeList.length ? (
              <>
                <div className="text-xs font-semibold uppercase tracking-wide text-text-mid">
                  Active
                </div>
                <div className="grid gap-3">
                  {activeList.map((p) => (
                    <PrescriptionCard
                      key={p.id}
                      prescription={p}
                      variant="active"
                      linkedRecordLabel={p.record_id ? linkedLabel(p.record_id) : null}
                      onMarkComplete={handleMarkComplete}
                      completing={completingId === p.id}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-text-mid">No active prescriptions.</div>
            )}

            {pastList.length ? (
              <>
                <div
                  className="flex items-center gap-4 py-8"
                  role="separator"
                  aria-label="Past or completed prescriptions"
                >
                  <div className="h-px flex-1 bg-lavender-mid/30" />
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-text-mid">
                    Past or completed
                  </span>
                  <div className="h-px flex-1 bg-lavender-mid/30" />
                </div>
                <div className="grid gap-3">
                  {pastList.map((p) => (
                    <PrescriptionCard
                      key={p.id}
                      prescription={p}
                      variant="completed"
                      linkedRecordLabel={p.record_id ? linkedLabel(p.record_id) : null}
                    />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={cx(
          'fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-lavender text-white shadow-lg',
          !activeBunnyId ? 'opacity-60' : 'hover:brightness-95',
        )}
        onClick={() => {
          setAddFormKey((k) => k + 1)
          setDrawerOpen(true)
        }}
        disabled={!activeBunnyId}
        aria-label="Add prescription"
      >
        <svg className="mx-auto h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 4a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 10 4Z" />
        </svg>
      </button>

      <Drawer
        title="Add prescription"
        open={drawerOpen}
        onClose={() => {
          if (saving) return
          setDrawerOpen(false)
          if (defaultOpen) navigate('/prescriptions', { replace: true })
        }}
      >
        <PrescriptionForm
          key={addFormKey}
          activeBunnyId={activeBunnyId}
          records={records}
          busy={saving}
          onSave={handleAdd}
          onClose={() => {
            if (saving) return
            setDrawerOpen(false)
          }}
        />
      </Drawer>
    </main>
  )
}
