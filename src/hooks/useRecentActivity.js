import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'
import { useBunny } from './useBunny'

function recordTimestamp(recordDate, createdAt) {
  if (recordDate) {
    const t = new Date(`${recordDate}T12:00:00`).getTime()
    if (Number.isFinite(t)) return t
  }
  const t2 = createdAt ? new Date(createdAt).getTime() : null
  return Number.isFinite(t2) ? t2 : 0
}

async function fetchRecentActivity({ bunnyId }) {
  const [symptomsRes, recordsRes, prescriptionsRes] = await Promise.all([
    supabase
      .from('symptom_logs')
      .select('id, logged_at, body_area, symptom_type')
      .eq('bunny_id', bunnyId)
      .order('logged_at', { ascending: false })
      .limit(5),
    supabase
      .from('medical_records')
      .select('id, record_date, title, created_at, category, visit_type')
      .eq('bunny_id', bunnyId)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('prescriptions')
      .select('id, drug_name, created_at, start_date')
      .eq('bunny_id', bunnyId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (symptomsRes.error) throw symptomsRes.error
  if (recordsRes.error) throw recordsRes.error
  if (prescriptionsRes.error) throw prescriptionsRes.error

  const events = []

  for (const s of symptomsRes.data ?? []) {
    const t = s?.logged_at ? new Date(s.logged_at).getTime() : 0
    events.push({
      id: `symptom:${s.id}`,
      type: 'symptom',
      title: {
        body_area: s?.body_area ?? null,
        symptom_type: s?.symptom_type ?? null,
      },
      ts: Number.isFinite(t) ? t : 0,
      raw: s,
    })
  }

  for (const r of recordsRes.data ?? []) {
    const isVetVisit =
      r?.category === 'vet_visit' || r?.visit_type === 'physical' || r?.visit_type === 'online'
    if (!isVetVisit) continue

    events.push({
      id: `record:${r.id}`,
      type: 'vet_visit',
      title: {
        title: r?.title ?? null,
        category: r?.category ?? null,
        visit_type: r?.visit_type ?? null,
      },
      ts: recordTimestamp(r?.record_date ?? null, r?.created_at ?? null),
      raw: r,
    })
  }

  for (const p of prescriptionsRes.data ?? []) {
    const t = p?.created_at ? new Date(p.created_at).getTime() : 0
    events.push({
      id: `prescription:${p.id}`,
      type: 'prescription',
      title: { drug_name: p?.drug_name ?? null },
      ts: Number.isFinite(t) ? t : 0,
      raw: p,
    })
  }

  events.sort((a, b) => b.ts - a.ts)
  return events.slice(0, 5)
}

export function useRecentActivity() {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()

  return useQuery({
    queryKey: ['recent_activity', user?.id ?? null, activeBunnyId ?? null],
    queryFn: () => fetchRecentActivity({ bunnyId: activeBunnyId }),
    enabled: Boolean(user?.id && activeBunnyId),
  })
}

