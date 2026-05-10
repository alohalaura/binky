import { format, differenceInCalendarDays, startOfToday, parseISO, isValid } from 'date-fns'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function safeDateLabel(d) {
  if (!d) return '—'
  try {
    return format(new Date(`${d}T00:00:00`), 'MMM d, yyyy')
  } catch {
    return String(d)
  }
}

function safeCreatedLabel(ts) {
  if (!ts) return null
  try {
    return format(new Date(ts), 'MMM d, yyyy')
  } catch {
    return new Date(ts).toLocaleDateString()
  }
}

function parseEndDate(ymd) {
  if (!ymd || typeof ymd !== 'string') return null
  const d = parseISO(`${ymd}T12:00:00`)
  return isValid(d) ? d : null
}

function daysRemainingMeta(endDateStr) {
  const end = parseEndDate(endDateStr)
  if (!end) {
    return { text: 'Ongoing', className: 'bg-lavender-mid/25 text-lavender-dark' }
  }
  const n = differenceInCalendarDays(end, startOfToday())
  if (n > 1) {
    return { text: `${n} days left`, className: 'bg-lavender text-white' }
  }
  if (n === 1) {
    return { text: '1 day left', className: 'bg-lavender text-white' }
  }
  if (n === 0) {
    return { text: 'Ends today', className: 'bg-salmon text-white' }
  }
  if (n === -1) {
    return {
      text: '1 day overdue',
      className: 'border border-amber-300 bg-amber-50 text-amber-900',
    }
  }
  return {
    text: `${Math.abs(n)} days overdue`,
    className: 'border border-amber-300 bg-amber-50 text-amber-900',
  }
}

function formatVetLabel(value) {
  const v = value?.trim?.() ? value.trim() : ''
  if (!v) return null
  // Avoid "Dr. Dr. Steph" when user already typed Dr.
  if (/^dr\.?\s/i.test(v)) return v
  return `Dr. ${v}`
}

export function PrescriptionCard({
  prescription,
  variant,
  linkedRecordLabel,
  onMarkComplete,
  completing = false,
}) {
  const isActive = variant === 'active'
  const wrapClass = isActive
    ? 'rounded-2xl border border-lavender bg-lavender-light p-4 shadow-sm'
    : 'rounded-2xl border border-lavender-mid/30 bg-warm-white p-4 shadow-sm'

  const daysMeta = isActive ? daysRemainingMeta(prescription.end_date) : null
  const vetLabel = formatVetLabel(prescription.prescribing_vet)
  const createdLabel = safeCreatedLabel(prescription.created_at)

  return (
    <div className={wrapClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="truncate text-base font-semibold text-text-dark">
              {prescription.drug_name?.trim() || 'Medicine'}
            </div>
            {isActive && daysMeta ? (
              <span
                className={cx(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                  daysMeta.className,
                )}
              >
                {daysMeta.text}
              </span>
            ) : null}
          </div>
          {createdLabel ? (
            <div className="mt-1 text-xs font-semibold text-text-mid">Created {createdLabel}</div>
          ) : null}
          <div className={createdLabel ? 'mt-1 text-xs text-text-mid' : 'mt-1 text-xs text-text-mid'}>
            {[prescription.dosage, prescription.frequency, vetLabel].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {isActive ? (
            <button
              type="button"
              disabled={completing}
              className="rounded-full border border-lavender-mid/40 bg-warm-white px-3 py-2 text-xs font-semibold text-lavender-dark hover:bg-white disabled:opacity-50"
              onClick={() => onMarkComplete?.(prescription.id)}
            >
              {completing ? 'Saving…' : 'Mark as completed'}
            </button>
          ) : (
            <span className="shrink-0 text-xs font-semibold text-text-mid">Completed</span>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-1 text-xs text-text-mid sm:grid-cols-2">
        <div>
          <span className="font-semibold text-text-dark">Start: </span>
          {safeDateLabel(prescription.start_date)}
        </div>
        <div>
          <span className="font-semibold text-text-dark">End: </span>
          {safeDateLabel(prescription.end_date)}
        </div>
        {linkedRecordLabel ? (
          <div className="sm:col-span-2">
            <span className="font-semibold text-text-dark">Record: </span>
            {linkedRecordLabel}
          </div>
        ) : null}
      </div>

      {prescription.notes ? (
        <div className="mt-3 whitespace-pre-wrap text-xs text-text-mid">{prescription.notes}</div>
      ) : null}
    </div>
  )
}
