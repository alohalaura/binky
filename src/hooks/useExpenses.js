import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { useBunny } from './useBunny'
import { supabase } from '../lib/supabase'

const EXPENSE_SELECT =
  'id, bunny_id, expense_date, category, amount, currency, description, receipt_urls, record_id, created_at'

const MEDICAL_SELECT =
  'id, bunny_id, record_date, category, visit_type, visit_cost_amount, visit_cost_currency, title, clinic_name, vet_name, created_at, medical_record_cost_items(id, description, amount)'

function safeNumber(n) {
  const x = Number(n)
  return Number.isFinite(x) ? x : 0
}

function normalizeCategoryLabel(category) {
  const c = String(category ?? '').trim()
  if (!c) return 'Other'
  const lower = c.toLowerCase()
  if (lower === 'vet_visit' || lower === 'vet visit') return 'Vet Visit'
  if (lower === 'medication') return 'Medication'
  if (lower === 'lab_test' || lower === 'lab test') return 'Lab Test'
  if (lower === 'supplies') return 'Supplies'
  if (lower === 'other') return 'Other'
  return 'Other'
}

function categoryFromMedicalRecord(record) {
  const c = String(record?.category ?? '').trim().toLowerCase()
  if (c === 'vet_visit') return 'Vet Visit'
  if (c === 'blood_work' || c === 'fecal_test' || c === 'xray') return 'Lab Test'
  if (c === 'prescription') return 'Medication'
  if (c === 'vaccination') return 'Vet Visit'
  return 'Other'
}

function makeDerivedExpenseFromCostItem({ record, costItem }) {
  const recordTitle = record?.title?.trim() ? record.title.trim() : 'Medical record'
  return {
    id: `mrci:${record.id}:${costItem.id}`,
    source: 'medical_invoice_item',
    bunny_id: record.bunny_id,
    expense_date: record.record_date,
    category: categoryFromMedicalRecord(record),
    amount: safeNumber(costItem.amount),
    currency: record?.visit_cost_currency?.trim() || 'PHP',
    description: costItem?.description?.trim()
      ? costItem.description.trim()
      : `Invoice item · ${recordTitle}`,
    receipt_urls: [],
    record_id: record.id,
    created_at: record.created_at,
    medical_record_id: record.id,
    medical_cost_item_id: costItem.id,
  }
}

async function fetchExpensesAndMedical({ bunnyId }) {
  const [expensesRes, medicalRes] = await Promise.all([
    supabase
      .from('expenses')
      .select(EXPENSE_SELECT)
      .eq('bunny_id', bunnyId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('medical_records')
      .select(MEDICAL_SELECT)
      .eq('bunny_id', bunnyId)
      .order('record_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (expensesRes.error) throw expensesRes.error
  if (medicalRes.error) throw medicalRes.error

  const fromExpenses = (expensesRes.data ?? []).map((row) => ({
    ...row,
    source: 'expense',
    category: normalizeCategoryLabel(row.category),
    receipt_urls: Array.isArray(row.receipt_urls) ? row.receipt_urls : [],
  }))

  const medical = medicalRes.data ?? []
  const fromMedicalInvoiceItems = []
  const medicalRecordIdsWithInvoiceItems = new Set()
  for (const r of medical) {
    const items = Array.isArray(r?.medical_record_cost_items) ? r.medical_record_cost_items : []
    if (items.length) medicalRecordIdsWithInvoiceItems.add(r.id)
    for (const it of items) {
      if (!it?.id) continue
      fromMedicalInvoiceItems.push(makeDerivedExpenseFromCostItem({ record: r, costItem: it }))
    }
  }

  // De-dupe linked "single expense" rows vs invoice line items.
  // If a medical record has invoice line items, prefer showing the line items and hide
  // any explicit `expenses` rows linked to that same `record_id` to avoid double counting.
  const filteredExplicitExpenses = fromExpenses.filter(
    (e) => !(e.record_id && medicalRecordIdsWithInvoiceItems.has(e.record_id)),
  )

  const merged = [...filteredExplicitExpenses, ...fromMedicalInvoiceItems].sort((a, b) => {
    const ad = String(a.expense_date ?? '')
    const bd = String(b.expense_date ?? '')
    if (ad !== bd) return bd.localeCompare(ad)
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''))
  })

  return { expenses: merged, directExpenses: filteredExplicitExpenses }
}

export function useExpenses() {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()

  return useQuery({
    queryKey: ['expenses', user?.id ?? null, activeBunnyId ?? null],
    queryFn: () => fetchExpensesAndMedical({ bunnyId: activeBunnyId }),
    enabled: Boolean(user?.id && activeBunnyId),
  })
}

