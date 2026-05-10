import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { useBunny } from './useBunny'
import { supabase } from '../lib/supabase'

async function fetchPrescriptionAdministrations({ bunnyId }) {
  const { data, error } = await supabase
    .from('prescription_administrations')
    .select(
      'id, prescription_id, bunny_id, administered_on, administered_at, created_at, prescriptions(drug_name, dosage, frequency)',
    )
    .eq('bunny_id', bunnyId)
    .order('administered_at', { ascending: false })
    .limit(60)

  if (error) throw error
  return data ?? []
}

export function usePrescriptionAdministrations() {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()

  return useQuery({
    queryKey: ['prescription_administrations', user?.id ?? null, activeBunnyId ?? null],
    queryFn: () => fetchPrescriptionAdministrations({ bunnyId: activeBunnyId }),
    enabled: Boolean(user?.id && activeBunnyId),
  })
}
