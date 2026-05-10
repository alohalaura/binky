import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAuth } from '../auth/authContext'
import { useBunny } from './useBunny'
import { supabase } from '../lib/supabase'

function toTs(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  const t = d.getTime()
  return Number.isFinite(t) ? t : null
}

function dateFromDateColumn(dateStr) {
  if (!dateStr) return null
  const t = toTs(new Date(`${dateStr}T00:00:00`))
  return t ? new Date(t) : null
}

function humanDateFromDateColumn(dateStr) {
  const d = dateFromDateColumn(dateStr)
  if (!d) return null
  try {
    return format(d, 'MMM d, yyyy')
  } catch {
    return null
  }
}

async function fetchTimelineEvents({ bunnyId }) {
  const [symptomsRes, recordsRes, prescriptionsRes] = await Promise.all([
    supabase
      .from('symptom_logs')
      .select('id, bunny_id, logged_at, body_area, symptom_type, severity, notes')
      .eq('bunny_id', bunnyId)
      .order('logged_at', { ascending: false }),
    supabase
      .from('medical_records')
      .select(
        'id, bunny_id, category, record_date, title, notes, vet_name, clinic_name, created_at',
      )
      .eq('bunny_id', bunnyId)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('prescriptions')
      .select(
        'id, bunny_id, drug_name, dosage, frequency, start_date, end_date, prescribing_vet, notes, is_active, completed_at, created_at',
      )
      .eq('bunny_id', bunnyId)
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
  ])

  if (symptomsRes.error) throw symptomsRes.error
  if (recordsRes.error) throw recordsRes.error
  if (prescriptionsRes.error) throw prescriptionsRes.error

  const symptomEvents = (symptomsRes.data ?? []).map((row) => ({
    id: row.id,
    type: 'symptom',
    occurredAt: row.logged_at ? new Date(row.logged_at) : null,
    sortTs: toTs(row.logged_at) ?? 0,
    badge: 'Symptoms',
    title: [row.body_area, row.symptom_type].filter(Boolean).join(' · '),
    meta: row.severity ? `Severity ${row.severity}` : null,
    notes: row.notes ?? null,
    raw: row,
  }))

  const recordEvents = (recordsRes.data ?? []).map((row) => {
    const isVetVisit =
      row?.category === 'vet_visit' || row?.visit_type === 'physical' || row?.visit_type === 'online'
    if (!isVetVisit) return null

    const occurredAt = dateFromDateColumn(row.record_date)
    return {
      id: row.id,
      type: 'vet_visit',
      occurredAt,
      sortTs: toTs(occurredAt) ?? toTs(row.created_at) ?? 0,
      badge: 'Vet Visit',
      title: row.title?.trim() ? row.title.trim() : 'Vet visit',
      meta: [row.clinic_name, row.vet_name].filter((x) => x?.trim?.()).join(' · ') || null,
      notes: row.notes ?? null,
      raw: row,
    }
  })

  const prescriptionEvents = (prescriptionsRes.data ?? []).map((row) => {
    const occurredAt =
      dateFromDateColumn(row.start_date) ?? (row.created_at ? new Date(row.created_at) : null)

    const startLabel = humanDateFromDateColumn(row.start_date)
    const endLabel = humanDateFromDateColumn(row.end_date)
    const range =
      startLabel || endLabel ? `${startLabel ?? '—'} → ${endLabel ?? '—'}` : null

    const metaBits = [row.dosage, row.frequency, row.prescribing_vet, range].filter((x) =>
      x?.trim?.(),
    )

    return {
      id: row.id,
      type: 'prescription',
      occurredAt,
      sortTs: toTs(occurredAt) ?? toTs(row.created_at) ?? 0,
      badge: 'Medicine',
      title: row.drug_name?.trim() ? row.drug_name.trim() : 'Medicine',
      meta: metaBits.length ? metaBits.join(' · ') : row.is_active ? 'Active' : 'Inactive',
      notes: row.notes ?? null,
      raw: row,
    }
  })

  const merged = [...symptomEvents, ...(recordEvents.filter(Boolean) ?? []), ...prescriptionEvents]
    .filter((e) => e.sortTs)
    .sort((a, b) => b.sortTs - a.sortTs)

  return merged
}

export function useTimelineEvents() {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()

  return useQuery({
    queryKey: ['timeline', user?.id ?? null, activeBunnyId ?? null],
    queryFn: () => fetchTimelineEvents({ bunnyId: activeBunnyId }),
    enabled: Boolean(user?.id && activeBunnyId),
  })
}

