import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { useBunny } from './useBunny'
import { supabase } from '../lib/supabase'

async function fetchWeightLogs({ bunnyId }) {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('id, bunny_id, logged_at, weight_g, source_record_id')
    .eq('bunny_id', bunnyId)
    .order('logged_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function useWeightLogs() {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()

  return useQuery({
    queryKey: ['weight_logs', user?.id ?? null, activeBunnyId ?? null],
    queryFn: () => fetchWeightLogs({ bunnyId: activeBunnyId }),
    enabled: Boolean(user?.id && activeBunnyId),
  })
}

