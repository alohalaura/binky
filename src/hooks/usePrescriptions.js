import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { useBunny } from './useBunny'
import { supabase } from '../lib/supabase'

async function fetchPrescriptions({ bunnyId }) {
  const { data, error } = await supabase
    .from('prescriptions')
    .select(
      'id, bunny_id, drug_name, dosage, frequency, start_date, end_date, prescribing_vet, notes, is_active, record_id, completed_at, created_at',
    )
    .eq('bunny_id', bunnyId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export function usePrescriptions() {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()

  return useQuery({
    queryKey: ['prescriptions', user?.id ?? null, activeBunnyId ?? null],
    queryFn: () => fetchPrescriptions({ bunnyId: activeBunnyId }),
    enabled: Boolean(user?.id && activeBunnyId),
  })
}
