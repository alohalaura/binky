/**
 * Optional bunny profile “extras” — stored on `bunnies` as short ids so labels can evolve.
 */

export const BUNNY_PROFILE_SELECT_CLASS =
  'h-12 w-full min-w-0 max-w-full rounded-xl border border-lavender-mid/30 bg-warm-white pl-4 pr-11 text-[16px] outline-none focus:border-lavender sm:text-sm appearance-none'

const BUNNY_SELECT_CHEVRON =
  'url("data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8886a3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  ) +
  '")'

/** Custom chevron so spacing from the right edge is consistent (native arrows sit flush). */
export const BUNNY_PROFILE_SELECT_STYLE = {
  backgroundImage: BUNNY_SELECT_CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 0.75rem center',
  backgroundSize: '1.25rem 1.25rem',
}

/** Healthy-ish treats and greens rabbits often go wild for (always follow your vet’s diet advice). */
export const BUNNY_FAVORITE_SNACKS = [
  { id: 'timothy_hay', label: 'Timothy hay (the real MVP)' },
  { id: 'cilantro', label: 'Fresh cilantro' },
  { id: 'italian_parsley', label: 'Italian parsley' },
  { id: 'basil', label: 'Sweet basil leaves' },
  { id: 'dill', label: 'Dill fronds' },
  { id: 'romaine', label: 'Romaine lettuce' },
  { id: 'green_leaf', label: 'Green or red leaf lettuce' },
  { id: 'carrot_tops', label: 'Carrot tops (the greens)' },
  { id: 'dandelion_greens', label: 'Dandelion greens' },
  { id: 'mint', label: 'Fresh mint' },
  { id: 'blueberry', label: 'Blueberries (tiny portions)' },
  { id: 'banana_chip', label: 'Banana (tiny bite)' },
  { id: 'apple_slice', label: 'Apple slice (no seeds)' },
  { id: 'pear', label: 'Pear (tiny bite)' },
  { id: 'willow_stick', label: 'Willow chew sticks' },
  { id: 'oxbow_herb_cookie', label: 'Oxbow hay-based treats' },
]

/** Things buns love to do / nap near. */
export const BUNNY_FAVORITE_HANGOUTS = [
  { id: 'sunny_window', label: 'Sunny window loaf spot' },
  { id: 'under_furniture', label: 'Under the couch or bed' },
  { id: 'tunnel', label: 'Inside a play tunnel' },
  { id: 'cardboard_fort', label: 'Cardboard box fort' },
  { id: 'dig_box', label: 'Dig box with hay or paper' },
  { id: 'plush_mat', label: 'Soft mat or rug' },
  { id: 'litter_palace', label: 'Their litter box (no judgment)' },
  { id: 'human_feet', label: 'Right at your feet' },
  { id: 'binky_corridor', label: 'Hallway binky runway' },
  { id: 'pen_corner', label: 'Favorite corner of the pen' },
]

function labelMap(list) {
  const m = {}
  for (const row of list) m[row.id] = row.label
  return m
}

const SNACK_LABELS = labelMap(BUNNY_FAVORITE_SNACKS)
const HANGOUT_LABELS = labelMap(BUNNY_FAVORITE_HANGOUTS)

const SNACK_KNOWN_IDS = new Set(BUNNY_FAVORITE_SNACKS.map((x) => x.id))

/** Select sentinel for “Other (custom treat)”; not persisted as-is. */
export const FAVORITE_SNACK_SELECT_OTHER = 'other'

/**
 * Map DB value → form `{ select, custom }`.
 * Unknown non-empty strings are treated as a custom treat (select = other).
 */
export function splitFavoriteSnackForForm(stored) {
  if (!stored || typeof stored !== 'string') return { select: '', custom: '' }
  const s = stored.trim()
  if (!s) return { select: '', custom: '' }
  if (SNACK_KNOWN_IDS.has(s)) return { select: s, custom: '' }
  return { select: FAVORITE_SNACK_SELECT_OTHER, custom: s }
}

export function labelForFavoriteSnack(stored) {
  if (!stored || typeof stored !== 'string') return ''
  const key = stored.trim()
  if (!key) return ''
  return SNACK_LABELS[key] || key
}

export function labelForFavoriteHangout(stored) {
  if (!stored || typeof stored !== 'string') return ''
  const key = stored.trim()
  if (!key) return ''
  return HANGOUT_LABELS[key] || key
}
