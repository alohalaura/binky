import { useMemo, useState } from 'react'
import { Drawer } from '../ui/Drawer'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { FileInput } from '../ui/FileInput'
import { MEDICAL_ATTACHMENT_KINDS } from '../../lib/constants'
import { useAccountCurrency } from '../../hooks/useAccountCurrency'

function labelForKind(kind) {
  if (!kind) return ''
  const spaced = String(kind).replaceAll('_', ' ').trim()
  return spaced
    .split(/\s+/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function guessFileName(pathOrFile) {
  if (pathOrFile && typeof pathOrFile === 'object' && pathOrFile.name) {
    return pathOrFile.name
  }
  if (!pathOrFile) return 'File'
  const base = String(pathOrFile).split('/').pop() || String(pathOrFile)
  return base.length > 60 ? `${base.slice(0, 22)}…${base.slice(-18)}` : base
}

function newLocalKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function newInvoiceLine() {
  return {
    localKey: newLocalKey(),
    description: '',
    amount: '',
  }
}

function sanitizeAmount(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '')
  if (!raw) return null
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n < 0) throw new Error('Enter a valid line item amount.')
  return n
}

export function AddRecordDrawer({
  open,
  onClose,
  onSave,
  onRemoveExistingFile,
  busy = false,
  activeBunnyId,
  mode = 'create',
  initialValues = null,
  recordId = null,
}) {
  const kindOptions = useMemo(
    () => MEDICAL_ATTACHMENT_KINDS.map((k) => ({ value: k, label: labelForKind(k) })),
    [],
  )
  const { currencyCode } = useAccountCurrency()

  const defaultKind = MEDICAL_ATTACHMENT_KINDS[0] ?? 'xray'

  const [visitType, setVisitType] = useState(initialValues?.visit_type ?? 'physical')
  const [recordDate, setRecordDate] = useState(initialValues?.record_date ?? '')
  const [title, setTitle] = useState(initialValues?.title ?? '')
  const [vetName, setVetName] = useState(initialValues?.vet_name ?? '')
  const [clinicName, setClinicName] = useState(initialValues?.clinic_name ?? '')
  const [invoiceItems, setInvoiceItems] = useState(() => {
    const items = Array.isArray(initialValues?.cost_items) ? initialValues.cost_items : []
    if (items.length) {
      return items.map((it) => ({
        localKey: it.id ?? newLocalKey(),
        id: it.id ?? null,
        description: it.description ?? '',
        amount: it.amount != null && it.amount !== '' ? String(it.amount) : '',
      }))
    }
    if (initialValues?.visit_cost_amount != null && initialValues?.visit_cost_amount !== '') {
      return [
        {
          localKey: newLocalKey(),
          id: null,
          description: 'Consult / visit',
          amount: String(initialValues.visit_cost_amount),
        },
      ]
    }
    return [newInvoiceLine()]
  })
  const [notes, setNotes] = useState(initialValues?.notes ?? '')
  const [weightKg, setWeightKg] = useState(
    initialValues?.visit_weight_kg != null && initialValues?.visit_weight_kg !== ''
      ? String(initialValues.visit_weight_kg)
      : '',
  )

  const [existingRows, setExistingRows] = useState(() => {
    const rows = Array.isArray(initialValues?.attachments) ? initialValues.attachments : []
    const mapped = rows
      .filter((r) => r?.storage_path)
      .map((r) => ({
        id: r.id ?? null,
        path: r.storage_path,
        file_kind: r.file_kind ?? defaultKind,
        legacy: false,
      }))
    const legacy = Array.isArray(initialValues?.legacy_file_urls)
      ? initialValues.legacy_file_urls.filter(Boolean).map((path) => ({
          id: null,
          path,
          file_kind: null,
          legacy: true,
        }))
      : []
    return [...mapped, ...legacy]
  })

  const [pendingFiles, setPendingFiles] = useState([])
  const [error, setError] = useState('')

  const canSave = Boolean(activeBunnyId && recordDate && visitType)
  const isEdit = mode === 'edit'

  function reset() {
    setVisitType(initialValues?.visit_type ?? 'physical')
    setRecordDate(initialValues?.record_date ?? '')
    setTitle(initialValues?.title ?? '')
    setVetName(initialValues?.vet_name ?? '')
    setClinicName(initialValues?.clinic_name ?? '')
    const items = Array.isArray(initialValues?.cost_items) ? initialValues.cost_items : []
    if (items.length) {
      setInvoiceItems(
        items.map((it) => ({
          localKey: it.id ?? newLocalKey(),
          id: it.id ?? null,
          description: it.description ?? '',
          amount: it.amount != null && it.amount !== '' ? String(it.amount) : '',
        })),
      )
    } else if (initialValues?.visit_cost_amount != null && initialValues?.visit_cost_amount !== '') {
      setInvoiceItems([
        {
          localKey: newLocalKey(),
          id: null,
          description: 'Consult / visit',
          amount: String(initialValues.visit_cost_amount),
        },
      ])
    } else {
      setInvoiceItems([newInvoiceLine()])
    }
    setNotes(initialValues?.notes ?? '')
    setWeightKg(
      initialValues?.visit_weight_kg != null && initialValues?.visit_weight_kg !== ''
        ? String(initialValues.visit_weight_kg)
        : '',
    )
    const rows = Array.isArray(initialValues?.attachments) ? initialValues.attachments : []
    const mapped = rows
      .filter((r) => r?.storage_path)
      .map((r) => ({
        id: r.id ?? null,
        path: r.storage_path,
        file_kind: r.file_kind ?? defaultKind,
        legacy: false,
      }))
    const legacy = Array.isArray(initialValues?.legacy_file_urls)
      ? initialValues.legacy_file_urls.filter(Boolean).map((path) => ({
          id: null,
          path,
          file_kind: null,
          legacy: true,
        }))
      : []
    setExistingRows([...mapped, ...legacy])
    setPendingFiles([])
    setError('')
  }

  function onPickFiles(e) {
    const list = Array.from(e.target.files ?? [])
    if (!list.length) return
    setPendingFiles((prev) => [
      ...prev,
      ...list.map((file) => ({
        localKey: newLocalKey(),
        file,
        file_kind: defaultKind,
      })),
    ])
    e.target.value = ''
  }

  function setPendingKind(localKey, file_kind) {
    setPendingFiles((prev) => prev.map((p) => (p.localKey === localKey ? { ...p, file_kind } : p)))
  }

  async function handleSave() {
    if (!canSave || busy) return
    setError('')

    try {
      const normalizedItems = invoiceItems
        .map((it) => ({
          id: it.id ?? null,
          description: String(it.description ?? '').trim(),
          amount: it.amount,
        }))
        .filter((it) => it.description || String(it.amount ?? '').trim())
        .map((it) => ({
          id: it.id,
          description: it.description || 'Line item',
          amount: sanitizeAmount(it.amount),
        }))
        .filter((it) => it.amount != null)

      await onSave?.({
        id: recordId,
        visit_type: visitType,
        record_date: recordDate,
        title,
        vet_name: vetName,
        clinic_name: clinicName,
        visit_cost_currency: currencyCode,
        cost_items: normalizedItems,
        notes,
        visit_weight_kg: weightKg,
        pending_files: pendingFiles,
        attachment_updates: existingRows
          .filter((r) => !r.legacy && r.id)
          .map((r) => ({ id: r.id, file_kind: r.file_kind })),
      })
      reset()
      onClose?.()
    } catch (err) {
      setError(err?.message || (isEdit ? 'Failed to update visit.' : 'Failed to add visit.'))
    }
  }

  return (
    <Drawer
      title={isEdit ? 'Edit visit' : 'Add visit'}
      open={open}
      onClose={() => {
        if (busy) return
        reset()
        onClose?.()
      }}
    >
      <div className="flex h-full min-w-0 flex-col">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
          {!activeBunnyId ? (
            <div className="rounded-2xl border border-lavender-mid/30 bg-warm-white p-4 text-sm text-text-mid">
              Choose an active bunny in Settings first.
            </div>
          ) : null}

          <div className="space-y-4 pt-1">
          <div>
            <div className="text-xs font-semibold text-text-mid">Visit type</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={cx(
                  'rounded-xl border px-3 py-3 text-sm font-semibold',
                  visitType === 'physical'
                    ? 'border-lavender bg-lavender text-white'
                    : 'border-lavender-mid/30 bg-warm-white text-text-dark hover:brightness-95',
                )}
                onClick={() => setVisitType('physical')}
                disabled={busy}
              >
                Physical visit
              </button>
              <button
                type="button"
                className={cx(
                  'rounded-xl border px-3 py-3 text-sm font-semibold',
                  visitType === 'online'
                    ? 'border-lavender bg-lavender text-white'
                    : 'border-lavender-mid/30 bg-warm-white text-text-dark hover:brightness-95',
                )}
                onClick={() => setVisitType('online')}
                disabled={busy}
              >
                Online consult
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-text-mid">Date</div>
            <Input
              className="mt-2"
              type="date"
              value={recordDate}
              onChange={(e) => setRecordDate(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-text-mid">Title (optional)</div>
            <Input
              className="mt-2"
              placeholder="e.g. Annual checkup"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={busy}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold text-text-mid">Vet</div>
              <Input
                className="mt-2"
                placeholder="Dr. Name"
                value={vetName}
                onChange={(e) => setVetName(e.target.value)}
                disabled={busy}
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-text-mid">Clinic</div>
              <Input
                className="mt-2"
                placeholder="Clinic name"
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-text-mid">Invoice (optional)</div>

            <div className="mt-2 rounded-2xl border border-lavender-mid/30 bg-warm-white p-4">
              <div className="space-y-3">
                {invoiceItems.map((it, idx) => (
                  <div key={it.localKey} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        className="min-w-0 flex-1"
                        type="text"
                        placeholder="Description (e.g. X-ray fee)"
                        value={it.description}
                        onChange={(e) =>
                          setInvoiceItems((items) =>
                            items.map((x) =>
                              x.localKey === it.localKey ? { ...x, description: e.target.value } : x,
                            ),
                          )
                        }
                        disabled={busy}
                        aria-label={`Invoice item ${idx + 1} description`}
                      />
                      <button
                        type="button"
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-lavender-mid/20 text-text-mid hover:border-lavender-mid/40 hover:bg-lavender-light hover:text-text-dark"
                        onClick={() =>
                          setInvoiceItems((items) =>
                            items.length <= 1
                              ? [newInvoiceLine()]
                              : items.filter((x) => x.localKey !== it.localKey),
                          )
                        }
                        disabled={busy}
                        aria-label={`Remove invoice item ${idx + 1}`}
                      >
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-5 w-5"
                          aria-hidden="true"
                        >
                          <path d="M6.28 5.22a.75.75 0 0 1 1.06 0L10 7.88l2.66-2.66a.75.75 0 1 1 1.06 1.06L11.06 8.94l2.66 2.66a.75.75 0 1 1-1.06 1.06L10 10l-2.66 2.66a.75.75 0 1 1-1.06-1.06l2.66-2.66-2.66-2.66a.75.75 0 0 1 0-1.06Z" />
                        </svg>
                      </button>
                    </div>
                    <div className="relative min-w-0 flex-1 sm:max-w-[12rem] sm:flex-initial sm:w-[9.5rem]">
                      <span
                        className="pointer-events-none absolute left-4 top-1/2 z-[1] -translate-y-1/2 text-sm font-semibold tabular-nums text-text-mid"
                        aria-hidden="true"
                      >
                        {currencyCode}
                      </span>
                      <Input
                        className="!pl-[3.25rem]"
                        type="text"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={it.amount}
                        onChange={(e) =>
                          setInvoiceItems((items) =>
                            items.map((x) =>
                              x.localKey === it.localKey ? { ...x, amount: e.target.value } : x,
                            ),
                          )
                        }
                        disabled={busy}
                        aria-label={`Invoice item ${idx + 1} amount (${currencyCode})`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="mt-4 w-full rounded-full border border-lavender-mid/30 bg-warm-white py-3 text-xs font-semibold text-text-dark hover:border-lavender"
                onClick={() => setInvoiceItems((items) => [...items, newInvoiceLine()])}
                disabled={busy}
              >
                Add line item
              </button>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-text-mid">Notes</div>
            <textarea
              className={cx(
                'mt-2 w-full resize-none rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm outline-none focus:border-lavender',
                busy ? 'opacity-70' : '',
              )}
              rows={5}
              placeholder="Optional details you want to remember."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-text-mid">Weight at visit (kg)</div>
            <Input
              className="mt-2"
              type="number"
              inputMode="decimal"
              placeholder="Optional"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              disabled={busy}
              min="0.01"
              step="0.01"
            />
            <div className="mt-2 text-[11px] text-text-mid">
              If provided, we’ll add/update a matching entry in Weight Log for this date.
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-text-mid">Files</div>
            {existingRows.length ? (
              <div className="mt-2 space-y-2 rounded-2xl border border-lavender-mid/30 bg-warm-white p-3">
                <div className="text-xs font-semibold text-text-mid">Existing attachments</div>
                {existingRows.map((row) => (
                  <div
                    key={row.id ?? row.path}
                    className="flex flex-col gap-2 rounded-xl border border-lavender-mid/30 bg-warm-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 text-xs font-semibold text-text-dark">
                      {guessFileName(row.path)}
                      {row.legacy ? (
                        <span className="mt-1 block text-[11px] font-normal text-text-mid">
                          Legacy upload (no type stored)
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!row.legacy ? (
                        <div className="relative">
                          <select
                            className="h-10 min-w-[9.5rem] appearance-none rounded-xl border border-lavender-mid/30 bg-warm-white px-3 pr-8 text-xs font-semibold outline-none focus:border-lavender"
                            value={row.file_kind ?? defaultKind}
                            onChange={(e) =>
                              setExistingRows((list) =>
                                list.map((x) =>
                                  (x.id ?? x.path) === (row.id ?? row.path)
                                    ? { ...x, file_kind: e.target.value }
                                    : x,
                                ),
                              )
                            }
                            disabled={busy}
                          >
                            {kindOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          <svg
                            className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-mid"
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
                      ) : null}
                      <button
                        type="button"
                        className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        onClick={async () => {
                          if (busy) return
                          if (!recordId) return
                          const ok = window.confirm(
                            'Delete this attachment? This cannot be undone.',
                          )
                          if (!ok) return

                          const nextLegacy = existingRows
                            .filter((x) => x.path !== row.path)
                            .filter((x) => x.legacy)
                            .map((x) => x.path)

                          try {
                            setError('')
                            await onRemoveExistingFile?.({
                              recordId,
                              fileRowId: row.id,
                              path: row.path,
                              legacy: row.legacy,
                              nextLegacyFileUrls: nextLegacy,
                            })
                            setExistingRows((list) => list.filter((x) => x.path !== row.path))
                          } catch (err) {
                            setError(err?.message || 'Failed to delete attachment.')
                          }
                        }}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <FileInput
              className="mt-2"
              multiple
              onChange={onPickFiles}
              disabled={busy}
            />

            {pendingFiles.length ? (
              <div className="mt-3 space-y-2">
                {pendingFiles.map((pf) => (
                  <div
                    key={pf.localKey}
                    className="flex flex-col gap-2 rounded-xl border border-lavender-mid/30 bg-warm-white p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 truncate text-xs font-semibold text-text-dark">
                      {guessFileName(pf.file)}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="relative">
                        <select
                          className="h-10 min-w-[9.5rem] appearance-none rounded-xl border border-lavender-mid/30 bg-warm-white px-3 pr-8 text-xs font-semibold outline-none focus:border-lavender"
                          value={pf.file_kind}
                          onChange={(e) => setPendingKind(pf.localKey, e.target.value)}
                          disabled={busy}
                        >
                          {kindOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <svg
                          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-mid"
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
                      <button
                        type="button"
                        className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-1 text-xs font-semibold text-text-dark hover:border-lavender"
                        onClick={() =>
                          setPendingFiles((list) => list.filter((x) => x.localKey !== pf.localKey))
                        }
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>
      </div>

        <div className="shrink-0 border-t border-lavender-mid/30 bg-warm-white p-5">
          <Button
            className={cx(
              'w-full',
              !canSave || busy ? 'opacity-60' : 'hover:brightness-95',
            )}
            type="button"
            onClick={handleSave}
            disabled={!canSave || busy}
          >
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save visit'}
          </Button>
        </div>
      </div>
    </Drawer>
  )
}
