import { Drawer } from '../ui/Drawer'

function labelForCategory(category) {
  if (!category) return ''
  const spaced = String(category).replaceAll('_', ' ').trim()
  return spaced
    .split(/\s+/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function labelForKind(kind) {
  if (!kind) return ''
  const spaced = String(kind).replaceAll('_', ' ').trim()
  return spaced
    .split(/\s+/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** Shared document thumbnail for attachment lists (records, symptoms, etc.). */
export function FileIcon() {
  return (
    <span
      aria-hidden="true"
      className="grid h-10 w-10 place-items-center rounded-xl border border-lavender-mid/30 bg-lavender-light text-lavender-dark"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7l-5-5Z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M14 2v5h5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function formatVisitCost(record) {
  const items = Array.isArray(record?.medical_record_cost_items)
    ? record.medical_record_cost_items
    : []
  if (items.length) {
    const n = items.reduce((sum, it) => sum + (Number(it?.amount) || 0), 0)
    if (!Number.isFinite(n)) return ''
    const cur = record?.visit_cost_currency?.trim() || 'PHP'
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n)
    } catch {
      return `${cur} ${n}`
    }
  }

  if (record?.visit_cost_amount == null || record.visit_cost_amount === '') return ''
  const n = Number(record.visit_cost_amount)
  if (!Number.isFinite(n)) return ''
  const cur = record?.visit_cost_currency?.trim() || 'PHP'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n)
  } catch {
    return `${cur} ${n}`
  }
}

export function RecordDetailsDrawer({
  open,
  onClose,
  record,
  visitPillLabel,
  dateLabel,
  files = [],
  filesLoading = false,
  filesError = '',
  onEdit,
  onDelete,
}) {
  const title =
    record?.title?.trim() ||
    (record?.visit_type || (record?.medical_record_files?.length ?? 0) > 0
      ? 'Vet visit'
      : labelForCategory(record?.category) || 'Record')

  return (
    <Drawer title="Visit details" open={open} onClose={onClose}>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="shrink-0 rounded-full bg-lavender-light px-3 py-1 text-xs font-semibold text-lavender-dark">
                {visitPillLabel || '—'}
              </div>
              <span className="text-xs font-semibold text-text-mid">{dateLabel || '—'}</span>
            </div>

            <div className="text-base font-semibold text-text-dark">{title}</div>

            <div className="grid gap-3 text-sm text-text-mid sm:grid-cols-2">
              <div>
                <div className="text-xs font-semibold text-text-mid">Vet</div>
                <div className="mt-1 text-sm text-text-dark">
                  {record?.vet_name?.trim() ? record.vet_name.trim() : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-text-mid">Clinic</div>
                <div className="mt-1 text-sm text-text-dark">
                  {record?.clinic_name?.trim() ? record.clinic_name.trim() : '—'}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-text-mid">Visit cost</div>
              <div className="mt-1 text-sm text-text-dark">
                {formatVisitCost(record) || '—'}
              </div>
            </div>

            {Array.isArray(record?.medical_record_cost_items) &&
            record.medical_record_cost_items.length ? (
              <div className="rounded-2xl border border-lavender-mid/30 bg-warm-white p-4">
                <div className="text-xs font-semibold text-text-mid">Invoice items</div>
                <div className="mt-2 space-y-2">
                  {record.medical_record_cost_items.map((it) => (
                    <div key={it.id} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0 text-text-dark">
                        {it?.description?.trim() ? it.description.trim() : 'Line item'}
                      </div>
                      <div className="shrink-0 font-semibold text-text-dark">
                        {(() => {
                          const n = Number(it?.amount)
                          const cur = record?.visit_cost_currency?.trim() || 'PHP'
                          if (!Number.isFinite(n)) return '—'
                          try {
                            return new Intl.NumberFormat(undefined, {
                              style: 'currency',
                              currency: cur,
                            }).format(n)
                          } catch {
                            return `${cur} ${n}`
                          }
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <div className="text-xs font-semibold text-text-mid">Notes</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-text-dark">
                {record?.notes?.trim() ? record.notes.trim() : '—'}
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-text-mid">Files</div>
              {filesLoading ? (
                <div className="mt-2 text-sm text-text-mid">Loading file links…</div>
              ) : filesError ? (
                <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {filesError}
                </div>
              ) : files.length ? (
                <div className="mt-2 space-y-2">
                  {files.map((f) => (
                    <a
                      key={f.path}
                      href={f.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 hover:brightness-95"
                    >
                      <div className="flex items-center gap-3">
                        <FileIcon />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-text-dark">
                            {f.kind ? labelForKind(f.kind) : 'File'}
                          </div>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-text-mid">No files attached.</div>
              )}
            </div>
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
