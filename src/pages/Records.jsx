import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { useBunny } from '../hooks/useBunny'
import { useBunhouse } from '../hooks/useBunhouse'
import { useRecords } from '../hooks/useRecords'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { AddRecordDrawer } from '../components/records/AddRecordDrawer'
import { RECORD_CATEGORIES } from '../lib/constants'
import { supabase } from '../lib/supabase'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '../components/ui/Modal'
import { badgeClassForType } from '../lib/eventStyles'
import { RecordDetailsDrawer } from '../components/records/RecordDetailsDrawer'
import { EmptyState } from '../components/ui/EmptyState'
import { FabPortalButton } from '../components/ui/FabPortalButton'
import { useWeightLogs } from '../hooks/useWeightLogs'

const MEDICAL_RECORDS_BUCKET = 'medical-records'
const SIGNED_URL_TTL_SECONDS = 60 * 15

function isMissingTableError(err, tableName) {
  const msg = String(err?.message ?? '')
  return (
    msg.includes(`Could not find the table 'public.${tableName}'`) ||
    msg.includes(`Could not find the table "public.${tableName}"`) ||
    (msg.includes(tableName) && msg.includes('schema cache'))
  )
}

function labelForCategory(category) {
  if (!category) return ''
  const spaced = String(category).replaceAll('_', ' ').trim()
  return spaced
    .split(/\s+/g)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function safeDateLabel(d) {
  try {
    return format(new Date(`${d}T00:00:00`), 'MMM d, yyyy')
  } catch {
    return String(d ?? '')
  }
}

function toIsoFromDateInput(dateStr) {
  // Keep consistent with Weight Log: store a stable timestamp for a date-only value.
  const d = new Date(`${dateStr}T12:00:00`)
  return d.toISOString()
}

function gramsToKg(grams) {
  const n = typeof grams === 'number' ? grams : Number(grams)
  if (!Number.isFinite(n)) return null
  return n / 1000
}

function kgInputFromGrams(grams) {
  const kg = gramsToKg(grams)
  if (kg == null) return ''
  const fixed = kg.toFixed(3)
  return fixed.replace(/\.?0+$/, '')
}

function sanitizeWeightKg(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '')
  if (!raw) return null
  const n = Number.parseFloat(raw)
  if (!Number.isFinite(n) || n <= 0) throw new Error('Enter a valid weight in kg.')
  return n * 1000
}

function attachmentRows(r) {
  return Array.isArray(r?.medical_record_files) ? r.medical_record_files : []
}

function legacyPaths(r) {
  const fromRows = new Set(attachmentRows(r).map((x) => x.storage_path).filter(Boolean))
  const urls = Array.isArray(r?.file_urls) ? r.file_urls.filter(Boolean) : []
  return urls.filter((p) => !fromRows.has(p))
}

function allStoragePaths(r) {
  const fromRows = attachmentRows(r).map((x) => x.storage_path).filter(Boolean)
  return [...fromRows, ...legacyPaths(r)]
}

function recordFileCount(r) {
  return allStoragePaths(r).length
}

function visitPillLabel(r) {
  if (r?.visit_type === 'physical') return 'Physical visit'
  if (r?.visit_type === 'online') return 'Online consult'
  return labelForCategory(r?.category)
}

function displayTitle(r) {
  const t = r?.title?.trim()
  if (t) return t
  if (r?.visit_type || attachmentRows(r).length > 0) return 'Vet visit'
  return labelForCategory(r?.category) || 'Record'
}

function recordMatchesTab(r, tab) {
  if (tab === 'all') return true
  if (tab === 'vet_visit') {
    if (r?.visit_type === 'physical' || r?.visit_type === 'online') return true
    if (r?.category === 'vet_visit') return true
    return false
  }
  const kinds = attachmentRows(r).map((x) => x.file_kind)
  if (kinds.includes(tab)) return true
  if (r?.category === tab) return true
  return false
}

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function Chip({ children, className = '' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full bg-cream px-3 py-1 text-[11px] font-semibold text-text-dark',
        className,
      )}
    >
      {children}
    </span>
  )
}

function formatVisitCostLine(r) {
  const items = Array.isArray(r?.medical_record_cost_items) ? r.medical_record_cost_items : []
  if (items.length) {
    const n = items.reduce((sum, it) => sum + (Number(it?.amount) || 0), 0)
    if (!Number.isFinite(n)) return ''
    const cur = r?.visit_cost_currency?.trim() || 'PHP'
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n)
    } catch {
      return `${cur} ${n}`
    }
  }

  if (r?.visit_cost_amount == null || r.visit_cost_amount === '') return ''
  const n = Number(r.visit_cost_amount)
  if (!Number.isFinite(n)) return ''
  const cur = r?.visit_cost_currency?.trim() || 'PHP'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n)
  } catch {
    return `${cur} ${n}`
  }
}

export function Records({ defaultOpen = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()
  const { activeBunhouseId } = useBunhouse()
  const { data: records = [], isLoading, error } = useRecords()
  const { data: weights = [] } = useWeightLogs()
  const queryClient = useQueryClient()

  const [tab, setTab] = useState('all')
  const [drawerOpen, setDrawerOpen] = useState(() => Boolean(defaultOpen))
  const [editTarget, setEditTarget] = useState(null)
  const [viewTarget, setViewTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [viewFiles, setViewFiles] = useState([])
  const [viewFilesLoading, setViewFilesLoading] = useState(false)
  const [viewFilesError, setViewFilesError] = useState('')

  const tabs = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...RECORD_CATEGORIES.map((c) => ({ value: c, label: labelForCategory(c) })),
    ],
    [],
  )

  const filteredRecords = useMemo(() => {
    if (tab === 'all') return records
    return records.filter((r) => recordMatchesTab(r, tab))
  }, [records, tab])

  const weightByRecordId = useMemo(() => {
    const m = new Map()
    for (const w of weights) {
      if (w?.source_record_id) {
        m.set(w.source_record_id, w)
      }
    }
    return m
  }, [weights])

  async function uploadFileToRecord({ recordId, file }) {
    const ext = file.name?.split('.').pop()?.toLowerCase() || 'bin'
    const fileId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    const path = `${activeBunhouseId}/${activeBunnyId}/medical/${recordId}/${fileId}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from(MEDICAL_RECORDS_BUCKET)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })
    if (uploadError) throw uploadError
    return path
  }

  const recordSelect =
    'id, bunny_id, category, visit_type, visit_cost_amount, visit_cost_currency, record_date, title, notes, vet_name, clinic_name, file_urls, created_at, medical_record_files(id, storage_path, file_kind), medical_record_cost_items(id, description, amount)'

  async function handleSaveRecord(form) {
    if (!user?.id) throw new Error('You must be signed in.')
    if (!activeBunnyId) throw new Error('Please choose an active bunny first.')

    setSaveError('')
    setSaving(true)

    try {
      const costItems = Array.isArray(form?.cost_items) ? form.cost_items : []
      const hasInvoice = costItems.length > 0
      const currency = String(form?.visit_cost_currency ?? 'PHP').trim() || 'PHP'
      const total = hasInvoice
        ? costItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
        : null
      const insertPayload = {
        bunny_id: activeBunnyId,
        category: 'vet_visit',
        visit_type: form.visit_type,
        record_date: form.record_date,
        title: form.title?.trim() ? form.title.trim() : null,
        vet_name: form.vet_name?.trim() ? form.vet_name.trim() : null,
        clinic_name: form.clinic_name?.trim() ? form.clinic_name.trim() : null,
        notes: form.notes?.trim() ? form.notes.trim() : null,
        visit_cost_amount: hasInvoice ? total : null,
        visit_cost_currency: hasInvoice ? currency : null,
        file_urls: null,
      }

      const { data: inserted, error: insertError } = await supabase
        .from('medical_records')
        .insert(insertPayload)
        .select(recordSelect)
        .single()
      if (insertError) throw insertError

      const recordId = inserted?.id

      // Optional: also add weight log entry tied to this visit.
      {
        const weight_g = sanitizeWeightKg(form?.visit_weight_kg)
        if (weight_g != null && recordId && form?.record_date) {
          const { error: wErr } = await supabase.from('weight_logs').upsert(
            {
              bunny_id: activeBunnyId,
              logged_at: toIsoFromDateInput(form.record_date),
              weight_g,
              source_record_id: recordId,
            },
            { onConflict: 'source_record_id' },
          )
          if (wErr) throw wErr
        }
      }

      if (hasInvoice) {
        const payload = costItems.map((it) => ({
          medical_record_id: recordId,
          description: it.description,
          amount: it.amount,
        }))
        const { error: invErr } = await supabase.from('medical_record_cost_items').insert(payload)
        if (invErr) {
          if (isMissingTableError(invErr, 'medical_record_cost_items')) {
            // DB isn't migrated yet: keep the total on medical_records, but skip invoice rows.
          } else {
            throw invErr
          }
        }
      }

      for (const pf of form.pending_files ?? []) {
        if (!pf?.file) continue
        const path = await uploadFileToRecord({ recordId, file: pf.file })
        const { error: rowErr } = await supabase.from('medical_record_files').insert({
          medical_record_id: recordId,
          storage_path: path,
          file_kind: pf.file_kind,
        })
        if (rowErr) throw rowErr
      }

      await queryClient.invalidateQueries({
        queryKey: ['medical_records', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['expenses', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['weight_logs', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['recent_activity', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['timeline', user?.id ?? null, activeBunnyId ?? null],
      })

      // Ensure Home -> Recent activity updates immediately.
      if (inserted?.id) {
        const dateStr = inserted?.record_date ?? form?.record_date ?? null
        const ts = dateStr
          ? new Date(`${dateStr}T12:00:00`).getTime()
          : inserted?.created_at
            ? new Date(inserted.created_at).getTime()
            : Date.now()
        const ev = {
          id: `record:${inserted.id}`,
          type: 'vet_visit',
          title: {
            title: inserted?.title ?? null,
            category: inserted?.category ?? null,
            visit_type: inserted?.visit_type ?? null,
          },
          ts: Number.isFinite(ts) ? ts : Date.now(),
          raw: inserted,
        }
        queryClient.setQueryData(
          ['recent_activity', user?.id ?? null, activeBunnyId ?? null],
          (prev) => {
            const list = Array.isArray(prev) ? prev : []
            const next = [ev, ...list.filter((x) => x?.id !== ev.id)]
            next.sort((a, b) => (b?.ts ?? 0) - (a?.ts ?? 0))
            return next.slice(0, 5)
          },
        )
      }
    } catch (err) {
      setSaveError(err?.message || 'Failed to add visit.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateRecord(form) {
    if (!user?.id) throw new Error('You must be signed in.')
    if (!activeBunnyId) throw new Error('Please choose an active bunny first.')
    if (!form?.id) throw new Error('Missing record id.')

    setSaveError('')
    setSaving(true)

    try {
      const hadVisitModel =
        Boolean(editTarget?.visit_type) || attachmentRows(editTarget).length > 0
      const addingTyped = (form.pending_files?.length ?? 0) > 0
      const costItems = Array.isArray(form?.cost_items) ? form.cost_items : []
      const hasInvoice = costItems.length > 0
      const currency = String(form?.visit_cost_currency ?? 'PHP').trim() || 'PHP'
      const total = hasInvoice
        ? costItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0)
        : null

      const updatePayload = {
        record_date: form.record_date,
        title: form.title?.trim() ? form.title.trim() : null,
        vet_name: form.vet_name?.trim() ? form.vet_name.trim() : null,
        clinic_name: form.clinic_name?.trim() ? form.clinic_name.trim() : null,
        notes: form.notes?.trim() ? form.notes.trim() : null,
        visit_cost_amount: hasInvoice ? total : null,
        visit_cost_currency: hasInvoice ? currency : null,
      }

      if (hadVisitModel || addingTyped) {
        updatePayload.visit_type = form.visit_type
        updatePayload.category = 'vet_visit'
      }

      const { error: updateError } = await supabase
        .from('medical_records')
        .update(updatePayload)
        .eq('id', form.id)
      if (updateError) throw updateError

      // Optional: upsert weight log entry tied to this visit.
      {
        const weight_g = sanitizeWeightKg(form?.visit_weight_kg)
        if (weight_g == null) {
          const { error: delWErr } = await supabase
            .from('weight_logs')
            .delete()
            .eq('source_record_id', form.id)
          if (delWErr) throw delWErr
        } else if (form?.record_date) {
          const { error: wErr } = await supabase.from('weight_logs').upsert(
            {
              bunny_id: activeBunnyId,
              logged_at: toIsoFromDateInput(form.record_date),
              weight_g,
              source_record_id: form.id,
            },
            { onConflict: 'source_record_id' },
          )
          if (wErr) throw wErr
        }
      }

      // Invoice items: replace all line items for simplicity.
      {
        const { error: delInvErr } = await supabase
          .from('medical_record_cost_items')
          .delete()
          .eq('medical_record_id', form.id)
        if (delInvErr) {
          if (!isMissingTableError(delInvErr, 'medical_record_cost_items')) {
            throw delInvErr
          }
        } else if (hasInvoice) {
          const payload = costItems.map((it) => ({
            medical_record_id: form.id,
            description: it.description,
            amount: it.amount,
          }))
          const { error: invErr } = await supabase.from('medical_record_cost_items').insert(payload)
          if (invErr) {
            if (!isMissingTableError(invErr, 'medical_record_cost_items')) {
              throw invErr
            }
          }
        }
      }

      for (const u of form.attachment_updates ?? []) {
        if (!u?.id || !u?.file_kind) continue
        const { error: kindErr } = await supabase
          .from('medical_record_files')
          .update({ file_kind: u.file_kind })
          .eq('id', u.id)
          .eq('medical_record_id', form.id)
        if (kindErr) throw kindErr
      }

      for (const pf of form.pending_files ?? []) {
        if (!pf?.file) continue
        const path = await uploadFileToRecord({ recordId: form.id, file: pf.file })
        const { error: rowErr } = await supabase.from('medical_record_files').insert({
          medical_record_id: form.id,
          storage_path: path,
          file_kind: pf.file_kind,
        })
        if (rowErr) throw rowErr
      }

      await queryClient.invalidateQueries({
        queryKey: ['medical_records', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['expenses', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['weight_logs', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['recent_activity', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['timeline', user?.id ?? null, activeBunnyId ?? null],
      })
    } catch (err) {
      setSaveError(err?.message || 'Failed to update visit.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function removeRecordFolder({ recordId }) {
    const prefix = `${activeBunhouseId}/${activeBunnyId}/medical/${recordId}`

    let offset = 0
    const fullPaths = []
    while (true) {
      const { data, error: listError } = await supabase.storage
        .from(MEDICAL_RECORDS_BUCKET)
        .list(prefix, { limit: 100, offset })
      if (listError) throw listError

      const batch = (data ?? []).filter((x) => x?.name).map((x) => `${prefix}/${x.name}`)
      fullPaths.push(...batch)
      if ((data ?? []).length < 100) break
      offset += 100
    }

    if (fullPaths.length) {
      const { error: removeError } = await supabase.storage
        .from(MEDICAL_RECORDS_BUCKET)
        .remove(fullPaths)
      if (removeError) throw removeError
    }
  }

  async function handleDeleteRecord(record) {
    if (!user?.id) throw new Error('You must be signed in.')
    if (!activeBunnyId) throw new Error('Please choose an active bunny first.')
    if (!record?.id) throw new Error('Missing record id.')

    setSaveError('')
    setSaving(true)

    try {
      // Unlink dependent rows that reference this medical record.
      // (FKs on prescriptions/expenses use default RESTRICT, so deletes would fail otherwise.)
      const { error: unlinkRxErr } = await supabase
        .from('prescriptions')
        .update({ record_id: null })
        .eq('record_id', record.id)
      if (unlinkRxErr) throw unlinkRxErr

      const { error: unlinkExpenseErr } = await supabase
        .from('expenses')
        .update({ record_id: null })
        .eq('record_id', record.id)
      if (unlinkExpenseErr) throw unlinkExpenseErr

      await removeRecordFolder({ recordId: record.id })

      // If this record contributed a weight entry, delete it too.
      const { error: delWeightErr } = await supabase
        .from('weight_logs')
        .delete()
        .eq('source_record_id', record.id)
      if (delWeightErr) throw delWeightErr

      const { error: deleteError } = await supabase
        .from('medical_records')
        .delete()
        .eq('id', record.id)
      if (deleteError) throw deleteError

      await queryClient.invalidateQueries({
        queryKey: ['medical_records', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['weight_logs', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['recent_activity', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({
        queryKey: ['timeline', user?.id ?? null, activeBunnyId ?? null],
      })
    } catch (err) {
      setSaveError(err?.message || 'Failed to delete record.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveExistingFile({
    recordId,
    fileRowId,
    path,
    legacy,
    nextLegacyFileUrls,
  }) {
    if (!user?.id) throw new Error('You must be signed in.')
    if (!activeBunnyId) throw new Error('Please choose an active bunny first.')
    if (!recordId) throw new Error('Missing record id.')
    if (!path) throw new Error('Missing file path.')

    setSaveError('')
    setSaving(true)

    try {
      const { error: removeErr } = await supabase.storage
        .from(MEDICAL_RECORDS_BUCKET)
        .remove([path])
      if (removeErr) throw removeErr

      if (legacy) {
        const { error: patchErr } = await supabase
          .from('medical_records')
          .update({ file_urls: nextLegacyFileUrls?.length ? nextLegacyFileUrls : null })
          .eq('id', recordId)
        if (patchErr) throw patchErr

        setEditTarget((prev) =>
          prev?.id === recordId ? { ...prev, file_urls: nextLegacyFileUrls ?? [] } : prev,
        )
        setViewTarget((prev) =>
          prev?.id === recordId ? { ...prev, file_urls: nextLegacyFileUrls ?? [] } : prev,
        )
      } else if (fileRowId) {
        const { error: delErr } = await supabase
          .from('medical_record_files')
          .delete()
          .eq('id', fileRowId)
          .eq('medical_record_id', recordId)
        if (delErr) throw delErr

        setEditTarget((prev) => {
          if (prev?.id !== recordId) return prev
          const nextFiles = (prev.medical_record_files ?? []).filter((f) => f.id !== fileRowId)
          return { ...prev, medical_record_files: nextFiles }
        })
        setViewTarget((prev) => {
          if (prev?.id !== recordId) return prev
          const nextFiles = (prev.medical_record_files ?? []).filter((f) => f.id !== fileRowId)
          return { ...prev, medical_record_files: nextFiles }
        })
      }

      await queryClient.invalidateQueries({
        queryKey: ['medical_records', user?.id ?? null, activeBunnyId ?? null],
      })
    } catch (err) {
      setSaveError(err?.message || 'Failed to delete attachment.')
      throw err
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    let active = true

    async function loadSignedUrls() {
      if (!viewTarget?.id) return
      if (!user?.id) return
      if (!activeBunnyId) return

      setViewFiles([])
      setViewFilesError('')
      setViewFilesLoading(true)

      try {
        const paths = allStoragePaths(viewTarget)
        const kindByPath = new Map(
          attachmentRows(viewTarget).map((f) => [f.storage_path, f.file_kind]),
        )
        const results = []
        for (const path of paths) {
          if (!path) continue
          const { data, error: signedErr } = await supabase.storage
            .from(MEDICAL_RECORDS_BUCKET)
            .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
          if (signedErr) throw signedErr
          if (data?.signedUrl) {
            results.push({
              path,
              url: data.signedUrl,
              kind: kindByPath.get(path) ?? null,
            })
          }
        }
        if (!active) return
        setViewFiles(results)
      } catch (err) {
        if (!active) return
        setViewFilesError(err?.message || 'Failed to load file links.')
      } finally {
        if (active) setViewFilesLoading(false)
      }
    }

    if (viewTarget) loadSignedUrls()

    return () => {
      active = false
    }
  }, [viewTarget, user?.id, activeBunnyId])

  const emptyState =
    !activeBunnyId
      ? 'Choose an active bunny in Settings to see records.'
      : isLoading
        ? 'Loading…'
        : records.length
          ? ''
          : ''

  return (
    <main>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Medical Records Vault</h1>
          <p className="mt-2 text-sm text-text-mid">
            Keep vet visits, labs, and documents organized in one place.
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <div className="flex min-w-max gap-2 pb-4 sm:pb-0">
          {tabs.map((t) => {
            const active = tab === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cx(
                  'rounded-full border px-4 py-2 text-sm font-semibold',
                  active
                    ? 'border-lavender bg-lavender text-white'
                    : 'border-lavender-mid/30 bg-warm-white text-text-dark hover:brightness-95',
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-5 text-sm text-text-mid">{emptyState}</div>
      {error ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error?.message || 'Failed to load records.'}
        </div>
      ) : null}
      {saveError ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {saveError}
        </div>
      ) : null}

      {activeBunnyId && !isLoading && records.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No records yet"
            description="Save vet visits, lab results, and documents so everything stays easy to find."
            actionLabel="Add first visit"
            onAction={() => setDrawerOpen(true)}
          />
        </div>
      ) : null}

      {activeBunnyId && !isLoading && records.length > 0 && filteredRecords.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Nothing in this category yet"
            description="Try another tab, or add a new record to start building your vault."
            actionLabel="Add a record"
            onAction={() => setDrawerOpen(true)}
          />
        </div>
      ) : null}

      {activeBunnyId && filteredRecords.length ? (
        <div className="mt-4 grid gap-3">
          {filteredRecords.map((r) => {
            const title = displayTitle(r)
            const costLine = formatVisitCostLine({
              ...r,
              medical_record_cost_items: Array.isArray(r?.medical_record_cost_items)
                ? r.medical_record_cost_items
                : [],
            })
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={badgeClassForType('vet_visit')}
                        >
                          {visitPillLabel(r)}
                        </Badge>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-1 text-xs font-semibold text-text-dark hover:border-lavender"
                          onClick={() => setViewTarget(r)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-1 text-xs font-semibold text-text-dark hover:border-lavender"
                          onClick={() => {
                            setEditTarget(r)
                            setDrawerOpen(true)
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 text-sm font-semibold text-text-dark">{title}</div>
                    <div className="mt-1 text-xs font-semibold text-text-mid">
                      {safeDateLabel(r?.record_date)}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {r?.vet_name?.trim() ? <Chip>Dr. {r.vet_name.trim()}</Chip> : null}
                      {r?.clinic_name?.trim() ? <Chip>{r.clinic_name.trim()}</Chip> : null}
                      {costLine ? <Chip>{costLine}</Chip> : null}
                    </div>

                    {r?.notes?.trim() ? (
                      <div className="mt-2 whitespace-pre-wrap text-xs text-text-mid">{r.notes.trim()}</div>
                    ) : null}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : null}

      {!drawerOpen && !viewTarget ? (
        <FabPortalButton onClick={() => setDrawerOpen(true)} aria-label="Add new record">
          <svg className="mx-auto h-6 w-6" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10 4a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 10 4Z" />
          </svg>
        </FabPortalButton>
      ) : null}

      <AddRecordDrawer
        key={editTarget?.id ? `edit-${editTarget.id}` : 'create'}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setEditTarget(null)
          if (defaultOpen) navigate('/records', { replace: true })
        }}
        onSave={editTarget ? handleUpdateRecord : handleSaveRecord}
        onRemoveExistingFile={handleRemoveExistingFile}
        busy={saving}
        activeBunnyId={activeBunnyId}
        mode={editTarget ? 'edit' : 'create'}
        recordId={editTarget?.id ?? null}
        initialValues={
          editTarget
            ? {
                visit_type: editTarget.visit_type ?? 'physical',
                record_date: editTarget.record_date ?? '',
                title: editTarget.title ?? '',
                vet_name: editTarget.vet_name ?? '',
                clinic_name: editTarget.clinic_name ?? '',
                notes: editTarget.notes ?? '',
                visit_weight_kg: kgInputFromGrams(weightByRecordId.get(editTarget.id)?.weight_g),
                visit_cost_currency: editTarget.visit_cost_currency?.trim() || 'PHP',
                visit_cost_amount: editTarget.visit_cost_amount ?? null,
                cost_items: Array.isArray(editTarget.medical_record_cost_items)
                  ? editTarget.medical_record_cost_items
                  : [],
                attachments: attachmentRows(editTarget),
                legacy_file_urls: legacyPaths(editTarget),
              }
            : null
        }
      />

      <RecordDetailsDrawer
        open={Boolean(viewTarget)}
        onClose={() => setViewTarget(null)}
        record={viewTarget}
        visitPillLabel={viewTarget ? visitPillLabel(viewTarget) : '—'}
        dateLabel={viewTarget?.record_date ? safeDateLabel(viewTarget.record_date) : '—'}
        files={viewFiles}
        filesLoading={viewFilesLoading}
        filesError={viewFilesError}
        onEdit={() => {
          if (!viewTarget) return
          setViewTarget(null)
          setEditTarget(viewTarget)
          setDrawerOpen(true)
        }}
        onDelete={() => {
          if (!viewTarget) return
          setDeleteTarget(viewTarget)
          setViewTarget(null)
        }}
      />

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => (saving ? null : setDeleteTarget(null))}
            aria-label="Close delete confirmation"
          />
          <div className="relative w-full max-w-lg">
            <Modal title="Delete record?">
              <div className="space-y-4">
                <div className="text-sm text-text-mid">
                  This permanently deletes the record and any files attached to it. You’re removing:
                  <div className="mt-2 rounded-2xl border border-lavender-mid/30 bg-warm-white p-4">
                    <div className="text-base font-semibold text-text-dark">
                      {deleteTarget ? displayTitle(deleteTarget) : 'Record'}
                    </div>
                    <div className="mt-1 text-xs font-semibold text-text-mid">
                      {deleteTarget ? visitPillLabel(deleteTarget) : '—'}
                      {deleteTarget?.record_date
                        ? ` · ${safeDateLabel(deleteTarget.record_date)}`
                        : ''}
                    </div>
                  </div>
                </div>

                <div className="flex flex-row flex-wrap items-center justify-end gap-2 sm:gap-3">
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm font-semibold text-text-dark hover:brightness-95"
                    onClick={() => setDeleteTarget(null)}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={cx(
                      'shrink-0 rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700',
                      saving ? 'opacity-60' : 'hover:brightness-95',
                    )}
                    disabled={saving}
                    onClick={async () => {
                      try {
                        await handleDeleteRecord(deleteTarget)
                        setDeleteTarget(null)
                      } catch {
                        // error surfaced in banner
                      }
                    }}
                  >
                    {saving ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            </Modal>
          </div>
        </div>
      ) : null}
    </main>
  )
}

