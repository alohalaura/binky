export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-lavender-mid/30 bg-warm-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  )
}

