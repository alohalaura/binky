import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function labelForCategory(category) {
  if (!category) return ''
  return String(category)
    .replaceAll('_', ' ')
    .trim()
    .split(/\s+/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function safeDateLabel(d) {
  if (!d) return ''
  try {
    return format(new Date(`${d}T00:00:00`), 'MMM d, yyyy')
  } catch {
    return String(d)
  }
}

function recordOptionLabel(r) {
  const d = r?.record_date ? safeDateLabel(r.record_date) : ''
  const t = r?.title?.trim() || labelForCategory(r?.category)
  return [d, t].filter(Boolean).join(' · ') || 'Record'
}

export function PrescriptionForm({ activeBunnyId, records = [], busy = false, onSave, onClose }) {
  const [drugName, setDrugName] = useState('')
  const [dosage, setDosage] = useState('')
  const [frequency, setFrequency] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [noEndDate, setNoEndDate] = useState(false)
  const [prescribingVet, setPrescribingVet] = useState('')
  const [notes, setNotes] = useState('')
  const [recordId, setRecordId] = useState('')
  const [error, setError] = useState('')

  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => {
      const ad = a?.record_date ? new Date(`${a.record_date}T00:00:00`).getTime() : 0
      const bd = b?.record_date ? new Date(`${b.record_date}T00:00:00`).getTime() : 0
      return bd - ad
    })
  }, [records])

  const canSave = Boolean(activeBunnyId && drugName.trim())

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSave || busy) return
    setError('')
    try {
      await onSave?.({
        drug_name: drugName.trim(),
        dosage: dosage.trim() || null,
        frequency: frequency.trim() || null,
        start_date: startDate.trim() || null,
        end_date: noEndDate ? null : endDate.trim() || null,
        prescribing_vet: prescribingVet.trim() || null,
        notes: notes.trim() || null,
        record_id: recordId.trim() || null,
      })
    } catch (err) {
      setError(err?.message || 'Failed to save prescription.')
    }
  }

  return (
    <form className="h-full overflow-y-auto p-5" onSubmit={handleSubmit}>
      {!activeBunnyId ? (
        <div className="rounded-2xl border border-lavender-mid/30 bg-warm-white p-4 text-sm text-text-mid">
          Choose an active bunny first.
        </div>
      ) : null}

      <div className="mt-4 space-y-4">
        <div>
          <div className="text-xs font-semibold text-text-mid">Drug name</div>
          <Input
            className="mt-2"
            placeholder="e.g. Enrofloxacin"
            value={drugName}
            onChange={(e) => setDrugName(e.target.value)}
            disabled={busy}
            required
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-text-mid">Dosage</div>
            <Input
              className="mt-2"
              placeholder="e.g. 0.5 ml"
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-text-mid">Frequency</div>
            <Input
              className="mt-2"
              placeholder="e.g. Twice daily"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-text-mid">Start date</div>
            <Input
              className="mt-2"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={busy}
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-text-mid">End date</div>
            <Input
              className="mt-2"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={busy || noEndDate}
            />
            <label className="mt-3 flex items-center gap-2 text-xs font-semibold text-text-mid">
              <input
                type="checkbox"
                className="sr-only"
                checked={noEndDate}
                disabled={busy}
                onChange={(e) => {
                  setNoEndDate(e.target.checked)
                  if (e.target.checked) setEndDate('')
                }}
              />
              <span
                className={cx(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                  noEndDate
                    ? 'border-lavender bg-lavender text-white'
                    : 'border-lavender-mid bg-warm-white',
                )}
                aria-hidden="true"
              >
                {noEndDate ? (
                  <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.32a1 1 0 0 1-1.42.002l-3.75-3.78a1 1 0 1 1 1.42-1.41l3.04 3.064 6.54-6.604a1 1 0 0 1 1.414-.006Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : null}
              </span>
              No end date / ongoing
            </label>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold text-text-mid">Prescribing vet</div>
          <Input
            className="mt-2"
            placeholder="Dr. Name"
            value={prescribingVet}
            onChange={(e) => setPrescribingVet(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-text-mid">Notes</div>
          <textarea
            className={cx(
              'mt-2 w-full resize-none rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm outline-none focus:border-lavender',
              busy ? 'opacity-70' : '',
            )}
            rows={4}
            placeholder="Optional instructions or side effects to watch for."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
        </div>

        <div>
          <div className="text-xs font-semibold text-text-mid">Medical record (optional)</div>
          <div className="relative mt-2">
            <select
              className="h-12 w-full appearance-none rounded-xl border border-lavender-mid/30 bg-warm-white px-4 pr-10 text-sm outline-none focus:border-lavender"
              value={recordId}
              onChange={(e) => setRecordId(e.target.value)}
              disabled={busy}
            >
              <option value="">None</option>
              {sortedRecords.map((r) => (
                <option key={r.id} value={r.id}>
                  {recordOptionLabel(r)}
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

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button type="submit" disabled={!canSave || busy}>
            {busy ? 'Saving…' : 'Save prescription'}
          </Button>
          <button
            type="button"
            className="rounded-full border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm font-semibold text-text-dark hover:brightness-95"
            disabled={busy}
            onClick={() => onClose?.()}
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}
