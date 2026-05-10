export const EVENT_TYPE_STYLES = {
  symptom: {
    badge: 'bg-salmon-light text-text-dark',
    icon: 'bg-salmon text-white',
  },
  vet_visit: {
    badge: 'bg-lavender-light text-lavender-dark',
    icon: 'bg-lavender text-white',
  },
  prescription: {
    // "Medicine" events
    badge: 'bg-severity-3/15 text-text-dark',
    icon: 'bg-severity-3 text-white',
  },
}

export function badgeClassForType(type) {
  return EVENT_TYPE_STYLES[type]?.badge ?? 'bg-cream text-text-dark'
}

export function iconClassForType(type) {
  return EVENT_TYPE_STYLES[type]?.icon ?? 'bg-lavender-mid text-text-dark'
}

