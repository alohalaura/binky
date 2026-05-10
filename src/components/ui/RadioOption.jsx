function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function RadioOption({ children, className = '', ...inputProps }) {
  return (
    <label className={cx('flex items-center gap-2', className)}>
      <input {...inputProps} type="radio" className="peer sr-only" />
      <span
        className={cx(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
          inputProps.checked
            ? 'border-lavender bg-lavender-light'
            : 'border-text-mid bg-warm-white',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-lavender-mid peer-focus-visible:ring-offset-2',
        )}
        aria-hidden="true"
      >
        {inputProps.checked ? <span className="h-2 w-2 rounded-full bg-lavender" /> : null}
      </span>
      {children}
    </label>
  )
}
