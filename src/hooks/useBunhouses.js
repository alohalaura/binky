import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'

async function fetchBunhouses({ userId }) {
  const { data, error } = await supabase
    .from('bunhouse_members')
    .select('bunhouse_id, bunhouses ( id, name, created_at )')
    .eq('user_id', userId)

  if (error) throw error

  const rows = Array.isArray(data) ? data : []
  return rows
    .map((r) => r?.bunhouses)
    .filter(Boolean)
    .map((b) => ({
      id: b.id,
      name: b.name,
      created_at: b.created_at,
    }))
}

export function useBunhouses() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['bunhouses', user?.id ?? null],
    queryFn: () => fetchBunhouses({ userId: user.id }),
    enabled: Boolean(user?.id),
  })
}

