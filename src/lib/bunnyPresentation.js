import { format } from 'date-fns'

export function safeDateLabel(d) {
  if (!d) return '—'
  try {
    return format(new Date(`${String(d).slice(0, 10)}T00:00:00`), 'MMM d, yyyy')
  } catch {
    return String(d).slice(0, 10)
  }
}

function ageInMonths(dateOfBirth) {
  if (!dateOfBirth) return null
  try {
    const dob = new Date(`${String(dateOfBirth).slice(0, 10)}T00:00:00`)
    const now = new Date()
    const months =
      now.getFullYear() * 12 +
      now.getMonth() -
      (dob.getFullYear() * 12 + dob.getMonth()) -
      (now.getDate() < dob.getDate() ? 1 : 0)
    return Number.isFinite(months) && months >= 0 ? months : null
  } catch {
    return null
  }
}

function pluralize(n, singular, plural = `${singular}s`) {
  return n === 1 ? singular : plural
}

export function bunnyAgeLabel(dateOfBirth) {
  const months = ageInMonths(dateOfBirth)
  if (months == null) return '—'
  const years = Math.floor(months / 12)
  if (years <= 0) return `${months} mo old`
  return `${years} ${pluralize(years, 'yr')} old`
}

// Common approximation:
// 1 rabbit year ≈ 15 human years, 2 rabbit years ≈ 24 human years,
// then each additional rabbit year ≈ +4 human years.
export function estimatedHumanAgeYears(dateOfBirth) {
  const months = ageInMonths(dateOfBirth)
  if (months == null) return null
  const years = months / 12
  if (!Number.isFinite(years) || years < 0) return null
  let human
  if (years <= 1) human = years * 15
  else if (years <= 2) human = 15 + (years - 1) * 9
  else human = 24 + (years - 2) * 4
  const rounded = Math.max(0, Math.round(human))
  return Number.isFinite(rounded) ? rounded : null
}
