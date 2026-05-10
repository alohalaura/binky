import { createPortal } from 'react-dom'

let fabPortalHost = null

function getFabPortalHost() {
  if (typeof document === 'undefined') return null
  if (fabPortalHost && document.body.contains(fabPortalHost)) return fabPortalHost
  const el = document.createElement('div')
  el.dataset.fabPortal = ''
  el.style.pointerEvents = 'none'
  document.body.appendChild(el)
  fabPortalHost = el
  return el
}

/**
 * FAB rendered via portal so parents with transforms or overflow can't clip it.
 * Uses a shared body-mounted wrapper (pointer-events: none) plus inline z-index so
 * stacking is reliable vs BottomNav, drawers, and iOS PWAs.
 */
export function FabPortalButton({
  disabled = false,
  className = '',
  children,
  style,
  ...props
}) {
  const host = getFabPortalHost()
  if (!host) return null

  return createPortal(
    <button
      type="button"
      disabled={disabled}
      className={`pointer-events-auto fixed right-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-lavender text-white shadow-lg sm:right-6 ${
        disabled ? 'cursor-not-allowed opacity-55' : 'hover:brightness-95'
      } ${className}`.trim()}
      style={{
        ...style,
        // After spread so stacking/position stay reliable for this control.
        zIndex: 1000,
        bottom: 'calc(7.5rem + env(safe-area-inset-bottom, 0px))',
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
      }}
      {...props}
    >
      {children}
    </button>,
    host,
  )
}
