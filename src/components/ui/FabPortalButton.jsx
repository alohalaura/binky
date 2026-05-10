import { createPortal } from 'react-dom'

/**
 * FAB rendered via portal to document.body so iOS Safari / parents with
 * transforms or overflow can't clip it; z above BottomNav + A2HS banner.
 */
export function FabPortalButton({
  disabled = false,
  className = '',
  children,
  style,
  ...props
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <button
      type="button"
      disabled={disabled}
      className={`pointer-events-auto fixed right-4 z-[100] flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-lavender text-white shadow-lg sm:right-6 ${
        disabled ? 'cursor-not-allowed opacity-55' : 'hover:brightness-95'
      } ${className}`.trim()}
      style={{
        bottom: 'calc(7.5rem + env(safe-area-inset-bottom, 0px))',
        ...style,
      }}
      {...props}
    >
      {children}
    </button>,
    document.body,
  )
}
