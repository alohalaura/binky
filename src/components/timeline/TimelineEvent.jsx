import { format } from 'date-fns'
import { Badge } from '../ui/Badge'
import { badgeClassForType, iconClassForType } from '../../lib/eventStyles'
import { IconClipboardText, IconPill, IconStethoscope } from '@tabler/icons-react'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function safeWhenLabel(d) {
  if (!d) return '—'
  try {
    return format(d, 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

function metaParts(meta) {
  if (!meta || typeof meta !== 'string') return []
  return meta
    .split(' · ')
    .map((p) => p.trim())
    .filter(Boolean)
}

function DetailChip({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-cream px-3 py-1 text-[11px] font-semibold text-text-dark">
      {children}
    </span>
  )
}

function Icon({ type }) {
  if (type === 'symptom') {
    return <IconStethoscope className="h-6 w-6" stroke={2.25} aria-hidden="true" />
  }
  if (type === 'prescription') {
    return <IconPill className="h-6 w-6" stroke={2.25} aria-hidden="true" />
  }
  return <IconClipboardText className="h-6 w-6" stroke={2.25} aria-hidden="true" />
}

export function TimelineEvent({ event, showConnector = true }) {
  const iconWrap = iconClassForType(event.type)
  const badgeClass = badgeClassForType(event.type)

  return (
    <div className="relative flex gap-4">
      <div className="relative flex w-9 shrink-0 justify-center">
        {showConnector ? (
          <div className="absolute bottom-0 top-0 w-px bg-lavender-mid/30" aria-hidden="true" />
        ) : null}
        <div
          className={cx(
            'relative z-10 mt-1 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-cream',
            iconWrap,
          )}
          aria-hidden="true"
        >
          <Icon type={event.type} />
        </div>
      </div>

      <div className="min-w-0 flex-1 pb-4">
        <div className="rounded-2xl border border-lavender-mid/30 bg-warm-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Badge className={badgeClass}>{event.badge}</Badge>
            <span className="shrink-0 text-xs font-semibold text-text-mid">
              {safeWhenLabel(event.occurredAt)}
            </span>
          </div>

          <div className="mt-2 text-sm font-semibold text-text-dark">{event.title}</div>

          {event.meta ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {metaParts(event.meta).map((part) => (
                <DetailChip key={part}>{part}</DetailChip>
              ))}
            </div>
          ) : null}

          {event.notes?.trim() ? (
            <div className="mt-2 whitespace-pre-wrap text-xs text-text-mid">{event.notes.trim()}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

