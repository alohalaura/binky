import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'
import { useBunhouse } from './useBunhouse'

async function fetchBunnies({ bunhouseId }) {
  const { data, error } = await supabase
    .from('bunnies')
    .select(
      'id, bunhouse_id, owner_id, name, breed, date_of_birth, sex, is_neutered, favorite_snack, favorite_hangout, photo_url, created_at',
    )
    .eq('bunhouse_id', bunhouseId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data ?? []
}

export function useBunnies() {
  const { user } = useAuth()
  const { activeBunhouseId } = useBunhouse()

  return useQuery({
    queryKey: ['bunnies', user?.id ?? null, activeBunhouseId ?? null],
    queryFn: () => fetchBunnies({ bunhouseId: activeBunhouseId }),
    enabled: Boolean(user?.id && activeBunhouseId),
  })
}

