import { useEffect, useRef, useState } from 'react'
import { Drawer } from '../ui/Drawer'
import { FileInput } from '../ui/FileInput'
import { supabase } from '../../lib/supabase'
import { useAccountCurrency } from '../../hooks/useAccountCurrency'

const EXPENSE_RECEIPTS_BUCKET = 'expense-receipts'

const CATEGORIES = [
  { value: 'Vet Visit', label: 'Vet visit' },
  { value: 'Medication', label: 'Medication' },
  { value: 'Lab Test', label: 'Lab test' },
  { value: 'Supplies', label: 'Supplies' },
  { value: 'Other', label: 'Other' },
]

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function makeFileId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function todayDateInputValue() {
  const now = new Date()
  const y = String(now.getFullYear())
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function uploadReceipt({ bunhouseId, bunnyId, expenseId, file }) {
  const ext = file.name?.split('.').pop()?.toLowerCase() || 'bin'
  const fileId = makeFileId()
  const path = `${bunhouseId}/${bunnyId}/expenses/${expenseId}/${fileId}.${ext}`

  const { error: uploadError } = await supabase.storage.from(EXPENSE_RECEIPTS_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (uploadError) throw uploadError

  return supabase.storage.from(EXPENSE_RECEIPTS_BUCKET).getPublicUrl(path).data.publicUrl
}

export function AddExpenseDrawer({
  open,
  onClose,
  bunhouseId,
  bunnyId,
  onCreated,
  onSaved,
  mode = 'create', // create | edit
  expenseId = null,
  initialValues = null,
} = {}) {
  const { currencyCode } = useAccountCurrency()

  const [form, setForm] = useState({
    expense_date: todayDateInputValue(),
    amount: '',
    category: 'Other',
    description: '',
  })
  const [receipt, setReceipt] = useState(null)
  const receiptInputRef = useRef(null)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isEdit = mode === 'edit'

  function reset() {
    setForm({
      expense_date: todayDateInputValue(),
      amount: '',
      category: 'Other',
      description: '',
    })
    setReceipt(null)
    if (receiptInputRef.current) receiptInputRef.current.value = ''
    setError('')
  }

  useEffect(() => {
    if (!open) return
    if (!isEdit) return
    if (!initialValues) return
    setForm({
      expense_date: initialValues.expense_date ?? todayDateInputValue(),
      amount: initialValues.amount != null && initialValues.amount !== '' ? String(initialValues.amount) : '',
      category: initialValues.category ?? 'Other',
      description: initialValues.description ?? '',
    })
    setReceipt(null)
    if (receiptInputRef.current) receiptInputRef.current.value = ''
    setError('')
  }, [open, isEdit, initialValues])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!bunhouseId) return
    if (!bunnyId) {
      setError('Please select an active bunny first.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const amount = Number(form.amount)
      if (!form.expense_date) throw new Error('Please choose a date.')
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be a positive number.')

      const payload = {
        bunny_id: bunnyId,
        expense_date: form.expense_date,
        amount,
        currency: currencyCode,
        category: String(form.category ?? 'Other').trim() || 'Other',
        description: form.description?.trim() ? form.description.trim() : null,
      }

      let id = expenseId
      if (isEdit) {
        if (!id) throw new Error('Missing expense id.')
        const { error: updateError } = await supabase.from('expenses').update(payload).eq('id', id)
        if (updateError) throw updateError
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('expenses')
          .insert({ ...payload, receipt_urls: null })
          .select('id')
          .single()
        if (insertError) throw insertError
        id = inserted?.id
      }

      if (receipt && id) {
        const publicUrl = await uploadReceipt({
          bunhouseId,
          bunnyId,
          expenseId: id,
          file: receipt,
        })

        const { error: patchErr } = await supabase
          .from('expenses')
          .update({ receipt_urls: [publicUrl] })
          .eq('id', id)
        if (patchErr) throw patchErr
      }

      if (isEdit) {
        await onSaved?.()
      } else {
        await onCreated?.()
      }
      reset()
      onClose?.()
    } catch (err) {
      setError(err?.message || (isEdit ? 'Failed to update expense.' : 'Failed to add expense.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      title={isEdit ? 'Edit expense' : 'Add expense'}
      open={open}
      onClose={() => {
        if (saving) return
        reset()
        onClose?.()
      }}
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto px-5 py-5">
          {error ? (
            <div className="mb-4 whitespace-pre-wrap rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div>
              <div className="text-sm font-medium text-text-dark">Date</div>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                className="mt-1 box-border h-12 w-full min-w-0 max-w-full rounded-xl border border-lavender-mid/30 bg-warm-white px-4 text-sm outline-none focus:border-lavender"
                disabled={saving}
              />
            </div>

            <div>
              <div className="text-sm font-medium text-text-dark">Amount</div>
              <div className="mt-1">
                <div className="flex items-center gap-2 rounded-xl border border-lavender-mid/30 bg-warm-white px-4">
                  <div className="shrink-0 text-sm font-semibold text-text-mid">{currencyCode}</div>
                  <input
                    inputMode="decimal"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="h-12 w-full bg-transparent text-sm outline-none"
                    placeholder="0.00"
                    disabled={saving}
                    aria-label="Expense amount"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-text-dark">Category</div>
              <div className="relative mt-1">
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="h-12 w-full appearance-none rounded-xl border border-lavender-mid/30 bg-warm-white px-4 pr-10 text-sm outline-none focus:border-lavender"
                  disabled={saving}
                  aria-label="Expense category"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
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

            <div>
              <div className="text-sm font-medium text-text-dark">Description</div>
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="mt-1 h-12 w-full rounded-xl border border-lavender-mid/30 bg-warm-white px-4 text-sm outline-none focus:border-lavender"
                placeholder="e.g., Follow-up consult"
                disabled={saving}
              />
            </div>

            <div>
              <div className="text-sm font-medium text-text-dark">Receipt (optional)</div>
              {isEdit && Array.isArray(initialValues?.receipt_urls) && initialValues.receipt_urls.length ? (
                <a
                  href={initialValues.receipt_urls[0]}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block text-xs font-semibold text-lavender-dark underline"
                >
                  View current receipt
                </a>
              ) : null}
              <FileInput
                ref={receiptInputRef}
                accept="image/*"
                onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
                className="mt-1"
                disabled={saving}
              />
              {receipt?.name ? <div className="mt-1 text-xs text-text-mid">{receipt.name}</div> : null}
            </div>

            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>
        </div>

        <div className="border-t border-lavender-mid/30 bg-warm-white px-5 py-4">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-full border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm font-semibold text-text-dark hover:brightness-95"
              onClick={() => {
                reset()
                onClose?.()
              }}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={cx(
                'rounded-full bg-lavender px-4 py-3 text-sm font-semibold text-white',
                saving ? 'opacity-70' : 'hover:brightness-95',
              )}
              onClick={(e) => handleSubmit(e)}
              disabled={saving || !bunhouseId}
            >
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add expense'}
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}

