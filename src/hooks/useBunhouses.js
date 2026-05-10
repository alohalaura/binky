import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'

async function fetchBunhouses({ userId }) {
  const { data: members, error: mErr } = await supabase
    .from('bunhouse_members')
    .select('bunhouse_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (mErr) throw mErr

  const ids = [
    ...new Set((Array.isArray(members) ? members : []).map((r) => r?.bunhouse_id).filter(Boolean)),
  ]
  if (ids.length === 0) return []

  const { data: houses, error: hErr } = await supabase
    .from('bunhouses')
    .select('id, name, created_at')
    .in('id', ids)

  if (hErr) throw hErr

  const byId = Object.fromEntries((houses ?? []).map((b) => [b.id, b]))
  return ids.map((id) => byId[id]).filter(Boolean)
}

export function useBunhouses() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['bunhouses', user?.id ?? null],
    queryFn: () => fetchBunhouses({ userId: user.id }),
    enabled: Boolean(user?.id),
  })
}

