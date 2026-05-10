export function Modal({ title, children }) {
  return (
    <div className="rounded-3xl border border-lavender-mid/30 bg-warm-white p-6 shadow-sm">
      {title ? <h2 className="text-lg font-semibold">{title}</h2> : null}
      <div className={title ? 'mt-3' : ''}>{children}</div>
    </div>
  )
}

