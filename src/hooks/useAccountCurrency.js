import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'
import { useBunnies } from './useBunnies'
import { useProfile } from './useProfile'

async function hasAnyFinancialEntries({ bunnyIds }) {
  if (!bunnyIds.length) return false

  const [expensesRes, recordsRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('id')
      .in('bunny_id', bunnyIds)
      .limit(1),
    supabase
      .from('medical_records')
      .select('id')
      .in('bunny_id', bunnyIds)
      .limit(1),
  ])

  if (expensesRes.error) throw expensesRes.error
  if (recordsRes.error) throw recordsRes.error
  return (expensesRes.data ?? []).length > 0 || (recordsRes.data ?? []).length > 0
}

export function useAccountCurrency() {
  const { user } = useAuth()
  const { data: profile, isLoading: profileLoading, error: profileError } = useProfile()
  const { data: bunnies = [], isLoading: bunniesLoading } = useBunnies()

  const bunnyIds = useMemo(() => bunnies.map((b) => b.id).filter(Boolean), [bunnies])

  const lockQuery = useQuery({
    queryKey: ['currency_lock', user?.id ?? null, bunnyIds],
    queryFn: () => hasAnyFinancialEntries({ bunnyIds }),
    enabled: Boolean(user?.id) && !bunniesLoading && bunnyIds.length > 0,
  })

  const currencyCode = (profile?.currency_code ?? 'PHP').trim() || 'PHP'
  const isLocked = Boolean(lockQuery.data)

  return {
    currencyCode,
    isLocked,
    isLoading: profileLoading || bunniesLoading || lockQuery.isLoading,
    error: profileError || lockQuery.error || null,
    profile,
  }
}

