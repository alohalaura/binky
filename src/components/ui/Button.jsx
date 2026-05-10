export function Button({ children, className = '', ...props }) {
  return (
    <button
      className={`rounded-full bg-lavender px-4 py-3 text-sm font-semibold text-white ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

