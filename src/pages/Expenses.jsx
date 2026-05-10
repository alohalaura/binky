import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'
import { useBunny } from '../hooks/useBunny'
import { useBunhouse } from '../hooks/useBunhouse'
import { useExpenses } from '../hooks/useExpenses'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { AddExpenseDrawer } from '../components/expenses/AddExpenseDrawer'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function safeDateLabel(d) {
  try {
    return format(new Date(`${d}T00:00:00`), 'MMM d, yyyy')
  } catch {
    return String(d ?? '')
  }
}

function monthKeyFromDateColumn(d) {
  if (!d) return ''
  return String(d).slice(0, 7) // YYYY-MM
}

function monthLabelFromKey(key) {
  if (!key) return ''
  try {
    return format(new Date(`${key}-01T00:00:00`), 'MMMM yyyy')
  } catch {
    return key
  }
}

function currencyFmt(amount, currency = 'PHP') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return ''
  const cur = String(currency || 'PHP').trim() || 'PHP'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n)
  } catch {
    return `${cur} ${n.toFixed(2)}`
  }
}

function phpNumber(amount) {
  const n = Number(amount)
  return Number.isFinite(n) ? n : 0
}

export function Expenses({ defaultOpen = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()
  const { activeBunhouseId } = useBunhouse()
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useExpenses()

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(() => Boolean(defaultOpen))
  const [editTarget, setEditTarget] = useState(null)

  const expenses = useMemo(() => data?.expenses ?? [], [data?.expenses])

  const { totalAllTime, totalThisMonth } = useMemo(() => {
    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    let all = 0
    let month = 0
    for (const e of expenses) {
      const amt = phpNumber(e.amount)
      all += amt
      if (monthKeyFromDateColumn(e.expense_date) === thisMonthKey) month += amt
    }
    return { totalAllTime: all, totalThisMonth: month }
  }, [expenses])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const e of expenses) {
      const key = monthKeyFromDateColumn(e.expense_date)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(e)
    }

    const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a))
    return keys.map((key) => {
      const items = map.get(key) ?? []
      let subtotal = 0
      for (const it of items) {
        subtotal += phpNumber(it.amount)
      }
      return { key, label: monthLabelFromKey(key), items, subtotal }
    })
  }, [expenses])

  async function handleConfirmDelete(target) {
    if (!user?.id) return
    if (!activeBunnyId) return
    if (!target?.id) return

    setSaveError('')
    setSaving(true)
    try {
      if (target.source === 'medical_invoice_item' && target.medical_cost_item_id) {
        const { error: delErr } = await supabase
          .from('medical_record_cost_items')
          .delete()
          .eq('id', target.medical_cost_item_id)
          .eq('medical_record_id', target.medical_record_id)
        if (delErr) throw delErr
      } else {
        const { error: delErr } = await supabase.from('expenses').delete().eq('id', target.id)
        if (delErr) throw delErr
      }

      await queryClient.invalidateQueries({
        queryKey: ['expenses', user?.id ?? null, activeBunnyId ?? null],
      })
      setDeleteTarget(null)
    } catch (err) {
      setSaveError(err?.message || 'Failed to delete expense.')
    } finally {
      setSaving(false)
    }
  }

  const emptyState =
    !activeBunnyId
      ? 'Choose an active bunny in Settings to see expenses.'
      : isLoading
        ? 'Loading…'
        : expenses.length
          ? ''
          : ''

  return (
    <main>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <p className="mt-2 text-sm text-text-mid">
          Track spending for your active bunny, including invoice line items from medical records.
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs font-semibold text-text-mid">Total spend (this month)</div>
          <div className="mt-2 text-2xl font-semibold text-text-dark">
            {currencyFmt(totalThisMonth, expenses[0]?.currency || 'PHP')}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-text-mid">Total spend (all time)</div>
          <div className="mt-2 text-2xl font-semibold text-text-dark">
            {currencyFmt(totalAllTime, expenses[0]?.currency || 'PHP')}
          </div>
        </Card>
      </div>

      <div className="mt-5 text-sm text-text-mid">{emptyState}</div>
      {error ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error?.message || 'Failed to load expenses.'}
        </div>
      ) : null}
      {saveError ? (
        <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {saveError}
        </div>
      ) : null}

      {activeBunnyId && !isLoading && expenses.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No expenses yet"
            description="Add an expense to start tracking spend over time (and keep receipts handy)."
            actionLabel="Add first expense"
            onAction={() => {
              setDrawerOpen(true)
            }}
          />
        </div>
      ) : null}

      {activeBunnyId && grouped.length ? (
        <div className="mt-4 grid gap-5">
          {grouped.map((g) => (
            <div key={g.key}>
              <div className="flex items-end justify-between gap-3">
                <div className="text-sm font-semibold text-text-dark">{g.label}</div>
                <div className="text-xs font-semibold text-text-mid">
                  Subtotal: {currencyFmt(g.subtotal, expenses[0]?.currency || 'PHP')}
                </div>
              </div>

              <div className="mt-3 grid gap-3">
                {g.items.map((ex) => {
                  const thumb = Array.isArray(ex.receipt_urls) && ex.receipt_urls.length ? ex.receipt_urls[0] : ''
                  const isFromMedical = ex.source === 'medical_invoice_item'
                  const canEdit = !isFromMedical && ex.source === 'expense'
                  return (
                    <Card key={ex.id} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{ex.category}</Badge>
                            {isFromMedical ? (
                              <span className="text-xs font-semibold text-text-mid">From medical invoice</span>
                            ) : null}
                          </div>

                          <div className="mt-2 text-sm font-semibold text-text-dark">
                            {ex.description?.trim() ? ex.description.trim() : 'Expense'}
                          </div>
                          <div className="mt-1 text-xs font-semibold text-text-mid">
                            {safeDateLabel(ex.expense_date)}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-2">
                          <div className="text-sm font-semibold text-text-dark">
                            {currencyFmt(ex.amount, ex.currency || 'PHP')}
                          </div>
                          <div className="flex items-center gap-2">
                            {canEdit ? (
                              <button
                                type="button"
                                className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-1 text-xs font-semibold text-text-dark hover:border-lavender"
                                onClick={() => {
                                  setEditTarget(ex)
                                  setDrawerOpen(true)
                                }}
                                disabled={saving}
                              >
                                Edit
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                              onClick={() => setDeleteTarget(ex)}
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>

                      {thumb ? (
                        <div className="mt-3">
                          <div className="text-xs font-semibold text-text-mid">Receipt</div>
                          <a
                            href={thumb}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-flex items-center gap-3 rounded-2xl border border-lavender-mid/30 bg-warm-white p-3 hover:border-lavender"
                          >
                            <img
                              src={thumb}
                              alt="Receipt thumbnail"
                              className="h-14 w-14 rounded-xl object-cover"
                              loading="lazy"
                            />
                            <div className="text-xs font-semibold text-text-dark">Open receipt</div>
                          </a>
                        </div>
                      ) : null}
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => (saving ? null : setDeleteTarget(null))}
            aria-label="Close delete confirmation"
          />
          <div className="relative w-full max-w-lg">
            <Card className="p-5">
              <div className="text-lg font-semibold text-text-dark">Delete expense?</div>
              <div className="mt-2 text-sm text-text-mid">
                This will permanently delete this entry.
              </div>

              <div className="mt-4 flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
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
                  onClick={() => handleConfirmDelete(deleteTarget)}
                >
                  {saving ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={cx(
          'fixed bottom-28 right-6 z-50 h-14 w-14 rounded-full bg-lavender text-white shadow-lg',
          'hover:brightness-95',
        )}
        aria-label="Add expense"
      >
        <svg className="mx-auto h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M10 4a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 10 4Z" />
        </svg>
      </button>

      <AddExpenseDrawer
        key={editTarget?.id ? `edit-${editTarget.id}` : 'create'}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditTarget(null)
          if (defaultOpen) navigate('/expenses', { replace: true })
        }}
        bunhouseId={activeBunhouseId ?? null}
        bunnyId={activeBunnyId ?? null}
        mode={editTarget ? 'edit' : 'create'}
        expenseId={editTarget?.id ?? null}
        initialValues={
          editTarget
            ? {
                expense_date: editTarget.expense_date ?? '',
                amount: editTarget.amount ?? '',
                category: editTarget.category ?? 'Other',
                description: editTarget.description ?? '',
                receipt_urls: Array.isArray(editTarget.receipt_urls) ? editTarget.receipt_urls : [],
              }
            : null
        }
        onCreated={async () => {
          await queryClient.invalidateQueries({
            queryKey: ['expenses', user?.id ?? null, activeBunnyId ?? null],
          })
        }}
        onSaved={async () => {
          await queryClient.invalidateQueries({
            queryKey: ['expenses', user?.id ?? null, activeBunnyId ?? null],
          })
        }}
      />
    </main>
  )
}

