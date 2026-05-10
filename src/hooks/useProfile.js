import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'

async function fetchProfile({ userId }) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, currency_code, created_at')
    .eq('id', userId)
    .single()

  if (error) throw error
  return data
}

export function useProfile() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['profile', user?.id ?? null],
    queryFn: () => fetchProfile({ userId: user.id }),
    enabled: Boolean(user?.id),
  })
}

