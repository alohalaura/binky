export function LoadingScreen({ message = 'Loading…' }) {
  return (
    <div
      className="flex min-h-dvh w-full flex-col items-center justify-center bg-cream px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{message}</span>

      <div className="relative flex h-[5.75rem] w-[5.75rem] items-center justify-center">
        <div
          className="absolute inset-0 rounded-[1.35rem] border-2 border-lavender-mid/25 border-t-lavender motion-safe:animate-[spin_1.15s_linear_infinite]"
          aria-hidden
        />
        <div
          className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-3xl border border-lavender-mid/35 bg-warm-white shadow-[0_8px_28px_-12px_rgba(60,52,137,0.35)]"
          aria-hidden
        >
          <img
            src="/pwa-192.png"
            alt=""
            className="h-14 w-14 rounded-2xl"
            width="56"
            height="56"
            decoding="async"
          />
        </div>
      </div>

      <p className="mt-10 text-center font-display text-sm font-medium tracking-tight text-text-dark">
        {message}
      </p>

      <div className="mt-4 flex gap-1.5" aria-hidden>
        {[0, 120, 240].map((delayMs) => (
          <span
            key={delayMs}
            className="h-2 w-2 rounded-full bg-lavender-mid motion-safe:animate-bounce"
            style={{ animationDelay: `${delayMs}ms` }}
          />
        ))}
      </div>

      <p className="mt-8 max-w-xs text-center text-xs leading-relaxed text-text-light motion-reduce:opacity-80">
        Binky Labs
      </p>
    </div>
  )
}
