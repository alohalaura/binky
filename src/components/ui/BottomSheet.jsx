function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function BottomSheet({ title, open, onClose, children, maxWidthClassName = 'max-w-2xl' }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close sheet"
      />

      <div className="absolute inset-x-0 bottom-0">
        <div className={cx('mx-auto w-full', maxWidthClassName)}>
          <div className="overflow-hidden rounded-t-3xl border border-lavender-mid/30 bg-warm-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-lavender-mid/30 px-5 py-4">
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

            <div className="max-h-[80dvh] overflow-y-auto">{children}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

