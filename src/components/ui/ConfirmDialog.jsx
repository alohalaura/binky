function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function ConfirmDialog({
  open,
  title = 'Are you sure?',
  description = '',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onClose,
} = {}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={() => {
          if (busy) return
          onClose?.()
        }}
        aria-label="Close dialog"
      />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-3xl border border-lavender-mid/30 bg-warm-white p-6 shadow-2xl">
          <div className="text-lg font-semibold text-text-dark">{title}</div>
          {description ? (
            <div className="mt-2 text-sm text-text-mid">{description}</div>
          ) : null}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className={cx(
                'rounded-full border border-lavender-mid/30 bg-warm-white px-4 py-2 text-sm font-semibold text-text-dark',
                busy ? 'opacity-60' : 'hover:brightness-95',
              )}
              disabled={busy}
              onClick={() => onClose?.()}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className={cx(
                'rounded-full px-4 py-2 text-sm font-semibold text-white',
                danger ? 'bg-red-600' : 'bg-text-dark',
                busy ? 'opacity-60' : 'hover:brightness-95',
              )}
              disabled={busy}
              onClick={() => onConfirm?.()}
            >
              {busy ? 'Working…' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

