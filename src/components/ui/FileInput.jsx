export function FileInput({ className = '', ...props }) {
  return (
    <input
      type="file"
      className={[
        'block w-full text-sm text-text-mid',
        'file:mr-3 file:rounded-full file:border file:border-lavender-mid/30 file:bg-warm-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-text-dark',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )
}

