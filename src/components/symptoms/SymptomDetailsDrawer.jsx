import { Drawer } from '../ui/Drawer'
import { FileIcon } from '../records/RecordDetailsDrawer'
import { toSentenceCase } from '../../lib/text'

function symptomAttachmentLabel(storagePath) {
  if (!storagePath || typeof storagePath !== 'string') return 'File'
  const base = storagePath.split('/').pop() || storagePath
  return base.length > 56 ? `${base.slice(0, 22)}…${base.slice(-18)}` : base
}

function symptomAttachmentItems(log) {
  const attachments = Array.isArray(log.media_attachments) ? log.media_attachments : []
  const withUrls = attachments.filter((a) => a?.url)
  if (withUrls.length) return withUrls
  const legacy = Array.isArray(log.media_links) ? log.media_links : []
  return legacy.filter(Boolean).map((url) => ({ path: null, url }))
}

function severityLabel(n) {
  if (n === 1) return 'Mild'
  if (n === 2) return 'Low'
  if (n === 3) return 'Moderate'
  if (n === 4) return 'High'
  if (n === 5) return 'Critical'
  return ''
}

export function SymptomDetailsDrawer({
  open,
  onClose,
  log,
  dateLabel,
  observedSince,
  onEdit,
  onDelete,
}) {
  const heading =
    log?.body_area && log?.symptom_type
      ? `${toSentenceCase(log.body_area)} · ${toSentenceCase(log.symptom_type)}`
      : 'Symptom'

  const attachmentItems = log ? symptomAttachmentItems(log) : []

  return (
    <Drawer title="Symptom details" open={open} onClose={onClose}>
      <div className="h-full overflow-y-auto p-5">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="shrink-0 rounded-full bg-lavender-light px-3 py-1 text-xs font-semibold text-lavender-dark">
              Severity {log?.severity ?? '—'}
              {log?.severity ? ` · ${severityLabel(log.severity)}` : ''}
            </div>
            <span className="text-xs font-semibold text-text-mid">{dateLabel || '—'}</span>
          </div>

          <div className="text-base font-semibold text-text-dark">{heading}</div>

          {observedSince ? (
            <div>
              <div className="text-xs font-semibold text-text-mid">Observed since</div>
              <div className="mt-1 text-sm text-text-dark">{observedSince}</div>
            </div>
          ) : null}

          <div>
            <div className="text-xs font-semibold text-text-mid">Notes</div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-text-dark">
              {log?.notes?.trim() ? log.notes.trim() : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-text-mid">Files</div>
            {attachmentItems.length ? (
              <div className="mt-2 space-y-2">
                {attachmentItems.map(({ path, url }, idx) => {
                  const label =
                    path != null && typeof path === 'string'
                      ? symptomAttachmentLabel(path)
                      : symptomAttachmentLabel(url)
                  return (
                    <a
                      key={`${log?.id}-${idx}-${url}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 hover:brightness-95"
                    >
                      <div className="flex items-center gap-3">
                        <FileIcon />
                        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-text-dark">
                          {label}
                        </div>
                      </div>
                    </a>
                  )
                })}
              </div>
            ) : (
              <div className="mt-2 text-sm text-text-mid">No files attached.</div>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              className="rounded-full border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm font-semibold text-text-dark hover:brightness-95"
              onClick={onEdit}
            >
              Edit
            </button>
            <button
              type="button"
              className="rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:brightness-95"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  )
}
