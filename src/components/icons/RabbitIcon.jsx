export function RabbitIcon({ className = 'h-10 w-10', title = 'Rabbit' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
    >
      <path
        d="M22 22c-3-7-4-16-1-18 4-2 9 7 10 14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M42 22c3-7 4-16 1-18-4-2-9 7-10 14"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M14 36c0-10 8-18 18-18s18 8 18 18c0 12-10 22-18 22S14 48 14 36Z"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M26 35a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm16 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
        fill="currentColor"
      />
      <path
        d="M32 38c2 0 4 1 4 3 0 3-3 5-4 5s-4-2-4-5c0-2 2-3 4-3Z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  )
}

