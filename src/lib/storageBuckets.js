function envString(key) {
  try {
    const v = import.meta?.env?.[key]
    return typeof v === 'string' ? v.trim() : ''
  } catch {
    return ''
  }
}

export const STORAGE_BUCKETS = {
  bunnyProfilePhotos:
    envString('VITE_BUNNY_PROFILE_BUCKET') || 'bunny-profile-photos',
  symptomMedia: envString('VITE_SYMPTOM_MEDIA_BUCKET') || 'symptom-media',
  medicalRecords: envString('VITE_MEDICAL_RECORDS_BUCKET') || 'medical-records',
  expenseReceipts: envString('VITE_EXPENSE_RECEIPTS_BUCKET') || 'expense-receipts',
}

