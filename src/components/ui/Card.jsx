export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-lavender-mid/30 bg-warm-white p-4 shadow-sm sm:p-5 ${className}`}
    >
      {children}
    </div>
  )
}

