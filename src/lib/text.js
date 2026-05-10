export function toSentenceCase(input) {
  if (input == null) return ''
  const str = String(input).trim()
  if (!str) return ''

  const lower = str.toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

