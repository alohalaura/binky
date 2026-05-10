export function Input({ className = '', ...props }) {
  return (
    <input
      className={`h-12 w-full rounded-xl border border-lavender-mid/30 bg-warm-white px-4 text-[16px] outline-none focus:border-lavender sm:text-sm ${className}`}
      {...props}
    />
  )
}

