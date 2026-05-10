export function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-lavender-light px-3 py-1 text-xs font-semibold text-lavender-dark ${className}`}
    >
      {children}
    </span>
  )
}

