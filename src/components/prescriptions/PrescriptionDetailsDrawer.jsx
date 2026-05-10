import { format } from 'date-fns'
import { Drawer } from '../ui/Drawer'

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

function safeDateTimeLabel(ts) {
  if (!ts) return '—'
  try {
    return format(new Date(ts), 'MMM d, yyyy, h:mm a')
  } catch {
    return String(ts)
  }
}

function formatVetLabel(value) {
  const v = value?.trim?.() ? value.trim() : ''
  if (!v) return null
  if (/^dr\.?\s/i.test(v)) return v
  return `Dr. ${v}`
}

export function PrescriptionDetailsDrawer({
  open,
  onClose,
  prescription,
  linkedRecordLabel,
  onEdit,
  onDelete,
}) {
  const isActive = Boolean(prescription?.is_active)
  const vetLabel = formatVetLabel(prescription?.prescribing_vet)

  return (
    <Drawer title="Medicine details" open={open} onClose={onClose}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cx(
                  'shrink-0 rounded-full px-3 py-1 text-xs font-semibold',
                  isActive ? 'bg-lavender text-white' : 'bg-lavender-mid/25 text-lavender-dark',
                )}
              >
                {isActive ? 'Active' : 'Completed'}
              </span>
              {prescription?.completed_at ? (
                <span className="text-xs font-semibold text-text-mid">
                  Completed {safeDateTimeLabel(prescription.completed_at)}
                </span>
              ) : null}
            </div>

            <div className="text-base font-semibold text-text-dark">
              {prescription?.drug_name?.trim() || 'Medicine'}
            </div>

            <div className="grid gap-3 text-sm text-text-mid sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-text-mid">Dosage</div>
                <div className="mt-1 text-sm text-text-dark">
                  {prescription?.dosage?.trim() || '—'}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-text-mid">Frequency</div>
                <div className="mt-1 text-sm text-text-dark">
                  {prescription?.frequency?.trim() || '—'}
                </div>
              </div>
            </div>

            {vetLabel ? (
              <div>
                <div className="text-xs font-semibold text-text-mid">Prescribing vet</div>
                <div className="mt-1 text-sm text-text-dark">{vetLabel}</div>
              </div>
            ) : null}

            <div className="grid gap-3 text-sm text-text-mid sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-text-mid">Start</div>
                <div className="mt-1 text-sm text-text-dark">
                  {safeDateLabel(prescription?.start_date)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-text-mid">End</div>
                <div className="mt-1 text-sm text-text-dark">
                  {prescription?.end_date ? safeDateLabel(prescription.end_date) : 'Ongoing'}
                </div>
              </div>
            </div>

            {linkedRecordLabel ? (
              <div>
                <div className="text-xs font-semibold text-text-mid">Medical record</div>
                <div className="mt-1 text-sm text-text-dark">{linkedRecordLabel}</div>
              </div>
            ) : null}

            <div>
              <div className="text-xs font-semibold text-text-mid">Notes</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-text-dark">
                {prescription?.notes?.trim() ? prescription.notes.trim() : '—'}
              </div>
            </div>

            {prescription?.created_at ? (
              <div className="text-xs font-semibold text-text-mid">
                Created {safeDateTimeLabel(prescription.created_at)}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center justify-end gap-2 border-t border-lavender-mid/30 bg-warm-white px-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-4 sm:gap-3">
          <button
            type="button"
            className="shrink-0 rounded-full border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm font-semibold text-text-dark hover:brightness-95"
            onClick={onEdit}
          >
            Edit
          </button>
          <button
            type="button"
            className="shrink-0 rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:brightness-95"
            onClick={onDelete}
          >
            Delete
          </button>
        </div>
      </div>
    </Drawer>
  )
}
