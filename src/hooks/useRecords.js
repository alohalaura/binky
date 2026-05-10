import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { useBunny } from './useBunny'
import { supabase } from '../lib/supabase'

const SELECT_WITH_VAULT =
  'id, bunny_id, category, visit_type, visit_cost_amount, visit_cost_currency, record_date, title, notes, vet_name, clinic_name, file_urls, created_at, medical_record_files(id, storage_path, file_kind), medical_record_cost_items(id, description, amount)'

const SELECT_LEGACY =
  'id, bunny_id, category, visit_cost_amount, visit_cost_currency, record_date, title, notes, vet_name, clinic_name, file_urls, created_at'

function isVaultSchemaError(err) {
  const msg = err?.message ?? ''
  return (
    msg.includes('visit_type') ||
    msg.includes('visit_cost') ||
    msg.includes('medical_record_cost_items') ||
    msg.includes('medical_record_files') ||
    msg.includes('relationship between') ||
    msg.includes('schema cache')
  )
}

async function fetchRecords({ bunnyId }) {
  const full = await supabase
    .from('medical_records')
    .select(SELECT_WITH_VAULT)
    .eq('bunny_id', bunnyId)
    .order('record_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (!full.error) return full.data ?? []

  if (isVaultSchemaError(full.error)) {
    const legacy = await supabase
      .from('medical_records')
      .select(SELECT_LEGACY)
      .eq('bunny_id', bunnyId)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (legacy.error) throw legacy.error
    return (legacy.data ?? []).map((r) => ({
      ...r,
      visit_type: null,
      visit_cost_amount: r?.visit_cost_amount ?? null,
      visit_cost_currency: r?.visit_cost_currency ?? null,
      medical_record_files: [],
      medical_record_cost_items: [],
    }))
  }

  throw full.error
}

export function useRecords() {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()

  return useQuery({
    queryKey: ['medical_records', user?.id ?? null, activeBunnyId ?? null],
    queryFn: () => fetchRecords({ bunnyId: activeBunnyId }),
    enabled: Boolean(user?.id && activeBunnyId),
  })
}

