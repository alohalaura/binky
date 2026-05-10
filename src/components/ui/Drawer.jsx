export function Drawer({ title, open, onClose, children, widthClassName = 'w-full sm:w-[520px]' }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close drawer"
      />
      <div className={`absolute right-0 top-0 h-full ${widthClassName}`}>
        <div className="flex h-full min-w-0 flex-col border-l border-lavender-mid/30 bg-warm-white shadow-xl">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-lavender-mid/30 px-6 py-4">
            <div className="min-w-0">
              {title ? (
                <div className="truncate text-base font-semibold text-text-dark">{title}</div>
              ) : null}
            </div>
            <button
              type="button"
              className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-2 text-sm font-semibold text-text-dark"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </div>
  )
}

