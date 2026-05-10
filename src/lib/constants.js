export const BODY_AREAS = [
  'Digestive',
  'Respiratory',
  'Eyes',
  'Ears',
  'Skin and Fur',
  'Musculoskeletal',
  'Neurological',
  'Urinary',
  'Behavioral',
]

export const SYMPTOM_TYPES_BY_AREA = {
  Digestive: [
    'Not eating',
    'no droppings',
    'bloated',
    'diarrhea',
    'soft cecotropes',
    'teeth grinding',
  ],
  Respiratory: [
    'Labored breathing',
    'nasal discharge',
    'sneezing',
    'mouth breathing',
  ],
  Eyes: ['Discharge', 'cloudiness', 'squinting', 'swelling around eye'],
  Ears: ['Head tilt', 'scratching at ear', 'discharge', 'dark debris'],
  'Skin and Fur': ['Hair loss', 'lumps', 'sores', 'flaking', 'wet dewlap', 'mites or fleas'],
  Musculoskeletal: ['Limping', 'not hopping', 'favoring a leg', 'paralysis', 'splaying'],
  Neurological: ['Head tilt', 'rolling', 'seizure', 'loss of balance', 'circling'],
  Urinary: ['Blood in urine', 'straining', 'sludge', 'strong smell', 'not urinating'],
  Behavioral: ['Lethargic', 'hiding', 'aggression', 'not grooming', 'pressing belly to floor'],
}

export const RECORD_CATEGORIES = [
  'vet_visit',
  'xray',
  'blood_work',
  'prescription',
  'vaccination',
  'fecal_test',
]

/** File / document types for attachments on a vet visit (not the visit itself). */
export const MEDICAL_ATTACHMENT_KINDS = [
  'xray',
  'blood_work',
  'prescription',
  'vaccination',
  'bill',
  'fecal_test',
]

/** Currency options for visit / consult cost (ISO 4217). Default: PHP. */
export const VISIT_COST_CURRENCIES = [
  { code: 'PHP', label: 'PHP — Philippine peso' },
  { code: 'USD', label: 'USD — US dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British pound' },
  { code: 'AUD', label: 'AUD — Australian dollar' },
  { code: 'CAD', label: 'CAD — Canadian dollar' },
  { code: 'JPY', label: 'JPY — Japanese yen' },
  { code: 'SGD', label: 'SGD — Singapore dollar' },
]

