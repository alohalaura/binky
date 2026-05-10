import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { BODY_AREAS, SYMPTOM_TYPES_BY_AREA } from '../../lib/constants'
import { toSentenceCase } from '../../lib/text'
import { useAuth } from '../../auth/authContext'
import { useBunny } from '../../hooks/useBunny'
import { useBunhouse } from '../../hooks/useBunhouse'
import { supabase } from '../../lib/supabase'
import { STORAGE_BUCKETS } from '../../lib/storageBuckets'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { FileInput } from '../ui/FileInput'
import { FileIcon } from '../records/RecordDetailsDrawer'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

function formatSeconds(s) {
  if (!Number.isFinite(s)) return ''
  return `${Math.round(s)}s`
}

const MAX_MEDIA_FILE_BYTES = 25 * 1024 * 1024
const SYMPTOM_MEDIA_SIGNED_TTL_SEC = 60 * 60

function newLocalKey() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function guessAttachmentLabel(pathOrFile) {
  if (pathOrFile && typeof pathOrFile === 'object' && pathOrFile.name) {
    return pathOrFile.name
  }
  if (!pathOrFile) return 'File'
  const base = String(pathOrFile).split('/').pop() || String(pathOrFile)
  return base.length > 60 ? `${base.slice(0, 22)}…${base.slice(-18)}` : base
}

async function validateSymptomMediaFile(f) {
  if (typeof f.size === 'number' && f.size > MAX_MEDIA_FILE_BYTES) {
    throw new Error(
      `Too large (${formatBytes(f.size)}). Max is ${formatBytes(MAX_MEDIA_FILE_BYTES)}.`,
    )
  }
  if (f.type?.startsWith('image/')) return
  if (f.type?.startsWith('video/')) {
    const duration = await getVideoDurationSeconds(f)
    if (!Number.isFinite(duration)) {
      throw new Error('Could not verify video duration.')
    }
    if (duration > 60) {
      throw new Error(`Video must be under 60 seconds (${formatSeconds(duration)}).`)
    }
    return
  }
  throw new Error('Only images and videos are allowed.')
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return ''
  const mb = bytes / (1024 * 1024)
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`
  return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`
}

function guessMimeType(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext) return ''
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'heic') return 'image/heic'
  if (ext === 'heif') return 'image/heif'
  if (ext === 'mp4') return 'video/mp4'
  if (ext === 'webm') return 'video/webm'
  if (ext === 'mov' || ext === 'qt') return 'video/quicktime'
  return ''
}

async function getVideoDurationSeconds(file) {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.preload = 'metadata'

    const duration = await new Promise((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', onLoaded)
        video.removeEventListener('error', onError)
      }
      const onLoaded = () => {
        cleanup()
        resolve(video.duration)
      }
      const onError = () => {
        cleanup()
        reject(new Error('Could not read video metadata'))
      }

      video.addEventListener('loadedmetadata', onLoaded)
      video.addEventListener('error', onError)
      video.src = url
    })

    return duration
  } finally {
    URL.revokeObjectURL(url)
  }
}

function makeSeverityOptions() {
  return [
    { value: 1, label: 'Mild', swatch: 'bg-emerald-500' },
    { value: 2, label: 'Low', swatch: 'bg-lime-500' },
    { value: 3, label: 'Moderate', swatch: 'bg-amber-500' },
    { value: 4, label: 'High', swatch: 'bg-orange-500' },
    { value: 5, label: 'Critical', swatch: 'bg-red-600' },
  ]
}

export function SymptomLogger({
  onSaved,
  container = 'card',
  initialLog = null,
  mode: modeProp = 'create',
  hideHeader = false,
} = {}) {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()
  const { activeBunhouseId } = useBunhouse()
  const queryClient = useQueryClient()

  const severityOptions = useMemo(() => makeSeverityOptions(), [])
  const [step, setStep] = useState(1)

  const [bodyArea, setBodyArea] = useState('')
  const [customBodyArea, setCustomBodyArea] = useState('')
  const [symptomType, setSymptomType] = useState('')
  const [customSymptom, setCustomSymptom] = useState('')
  const [severity, setSeverity] = useState(0)
  const [observedSince, setObservedSince] = useState('')
  const [notes, setNotes] = useState('')
  const [pendingFiles, setPendingFiles] = useState([])
  const [existingMediaSigned, setExistingMediaSigned] = useState([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({
    customBodyArea: '',
    customSymptom: '',
  })
  const [saved, setSaved] = useState(null)

  const [mode, setMode] = useState(modeProp) // create | edit
  const [editingId, setEditingId] = useState(initialLog?.id ?? null)
  const [existingMediaUrls, setExistingMediaUrls] = useState([])

  function startCreate() {
    setMode('create')
    setEditingId(null)
    setExistingMediaUrls([])
    setSaved(null)
    setError('')
    setFieldErrors({ customBodyArea: '', customSymptom: '' })
    setStep(1)
    setBodyArea('')
    setCustomBodyArea('')
    setSymptomType('')
    setCustomSymptom('')
    setSeverity(0)
    setObservedSince('')
    setNotes('')
    setPendingFiles([])
  }

  function startEdit(row) {
    if (!row?.id) return
    setMode('edit')
    setEditingId(row.id)
    setExistingMediaUrls(Array.isArray(row.media_urls) ? row.media_urls : [])
    setSaved(null)
    setError('')
    setFieldErrors({ customBodyArea: '', customSymptom: '' })
    setStep(1)

    const nextBodyArea = row.body_area ?? ''
    const isKnownBodyArea = BODY_AREAS.includes(nextBodyArea)
    setBodyArea(isKnownBodyArea ? nextBodyArea : '__custom__')
    setCustomBodyArea(isKnownBodyArea ? '' : nextBodyArea)

    const symptomList = SYMPTOM_TYPES_BY_AREA?.[nextBodyArea] ?? []
    const nextSymptomType = row.symptom_type ?? ''
    const isKnownSymptom =
      Array.isArray(symptomList) && symptomList.includes(nextSymptomType)
    setSymptomType(isKnownSymptom ? nextSymptomType : '__custom__')
    setCustomSymptom(isKnownSymptom ? '' : nextSymptomType)

    setSeverity(Number.isFinite(row.severity) ? row.severity : 0)
    setObservedSince(
      typeof row.observed_since === 'string' && row.observed_since
        ? row.observed_since.slice(0, 10)
        : '',
    )
    setNotes(row.notes ?? '')
    setPendingFiles([])
  }

  useEffect(() => {
    if (modeProp === 'edit' && initialLog?.id) {
      const t = setTimeout(() => startEdit(initialLog), 0)
      return () => clearTimeout(t)
    } else if (modeProp === 'create') {
      const t = setTimeout(() => startCreate(), 0)
      return () => clearTimeout(t)
    }
    // startEdit/startCreate intentionally not dependencies
    // to keep initialization stable for the drawer lifecycle.
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeProp, initialLog?.id])

  useEffect(() => {
    let cancelled = false
    const paths = existingMediaUrls.filter((p) => typeof p === 'string' && p.length)
    if (!paths.length) {
      setExistingMediaSigned([])
      return
    }

    const bucket = STORAGE_BUCKETS.symptomMedia
    ;(async () => {
      const results = await Promise.all(
        paths.map(async (path) => {
          const { data, error } = await supabase.storage
            .from(bucket)
            .createSignedUrl(path, SYMPTOM_MEDIA_SIGNED_TTL_SEC)
          if (error || !data?.signedUrl) return { path, url: null }
          return { path, url: data.signedUrl }
        }),
      )
      if (!cancelled) {
        setExistingMediaSigned(results.filter((x) => x.url))
      }
    })()

    return () => {
      cancelled = true
    }
  }, [existingMediaUrls])

  const symptomOptions = useMemo(() => {
    if (!bodyArea) return []
    const items = SYMPTOM_TYPES_BY_AREA?.[bodyArea] ?? []
    return Array.isArray(items) ? items : []
  }, [bodyArea])

  const bodyAreaToSave = useMemo(() => {
    if (bodyArea === '__custom__') return customBodyArea.trim()
    return bodyArea
  }, [bodyArea, customBodyArea])

  const symptomTypeToSave = useMemo(() => {
    if (symptomType === '__custom__') return customSymptom.trim()
    return symptomType
  }, [symptomType, customSymptom])

  const canNext = useMemo(() => {
    if (step === 1) {
      if (!bodyArea) return false
      if (bodyArea === '__custom__') return Boolean(customBodyArea.trim())
      return true
    }
    if (step === 2) {
      if (!symptomType) return false
      if (symptomType === '__custom__') return Boolean(customSymptom.trim())
      return true
    }
    if (step === 3) return severity >= 1 && severity <= 5
    return true
  }, [step, bodyArea, customBodyArea, symptomType, customSymptom, severity])

  async function onPickFiles(nextFiles) {
    setError('')
    setFieldErrors({ customBodyArea: '', customSymptom: '' })
    setSaved(null)

    const list = Array.from(nextFiles ?? [])
    if (list.length === 0) return

    const toAdd = []
    const skipped = []
    for (const f of list) {
      try {
        await validateSymptomMediaFile(f)
        toAdd.push({ localKey: newLocalKey(), file: f })
      } catch (e) {
        const name = f?.name ? `"${f.name}"` : 'A file'
        skipped.push(`${name}: ${e?.message || 'Not allowed.'}`)
      }
    }

    if (skipped.length && !toAdd.length) {
      setError(skipped.join('\n'))
      return
    }
    if (skipped.length) {
      setError(`Some files were skipped:\n${skipped.join('\n')}`)
    }

    if (toAdd.length) {
      setPendingFiles((prev) => [...prev, ...toAdd])
    }
  }

  async function onSave() {
    if (!user?.id) return
    if (!activeBunhouseId) {
      setError('Please select a bunhouse first.')
      return
    }
    if (!activeBunnyId) {
      setError('Please select a bunny first.')
      return
    }

    setError('')
    setFieldErrors({ customBodyArea: '', customSymptom: '' })
    setSaved(null)
    setSaving(true)

    try {
      // Preflight: ensure the active bunny is accessible in the selected bunhouse.
      // If this fails, inserts will violate the symptom_logs RLS policy.
      const { data: bunnyRow, error: bunnyError } = await supabase
        .from('bunnies')
        .select('id, bunhouse_id')
        .eq('id', activeBunnyId)
        .maybeSingle()
      if (bunnyError) throw bunnyError
      if (!bunnyRow?.id) {
        throw new Error(
          'Your active bunny could not be found for this account. Go to Settings and re-select your bunny.',
        )
      }
      if (bunnyRow.bunhouse_id !== activeBunhouseId) {
        throw new Error(
          `Your active bunny isn’t in the selected bunhouse. (bunny.id=${activeBunnyId}, bunny.bunhouse_id=${bunnyRow.bunhouse_id ?? 'null'}, activeBunhouseId=${activeBunhouseId})`,
        )
      }

      const mediaUrls = [...existingMediaUrls]
      const bucket = STORAGE_BUCKETS.symptomMedia

      for (const pf of pendingFiles) {
        const file = pf.file
        if (!file) continue
        const ext = file.name?.split('.').pop()?.toLowerCase() || 'bin'
        const contentType = file.type || guessMimeType(file.name) || undefined
        const fileId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`
        const path = `${activeBunhouseId}/${activeBunnyId}/${fileId}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType,
          })
        if (uploadError) {
          const upMsg = uploadError?.message || 'Upload failed'
          if (/row-level security/i.test(upMsg)) {
            throw new Error(
              [
                'Upload blocked by Supabase Storage security (RLS).',
                '',
                `Bucket: ${bucket} (private)`,
                `Path: ${path}`,
                '',
                'Fix: add Storage policies on `storage.objects` to allow authenticated users to insert/select their own objects in this bucket.',
              ].join('\n'),
            )
          }
          throw uploadError
        }

        mediaUrls.push(path)
      }

      const payload = {
        bunny_id: activeBunnyId,
        observed_since: observedSince ? observedSince : null,
        body_area: bodyAreaToSave,
        symptom_type: symptomTypeToSave,
        severity,
        notes: notes.trim() ? notes.trim() : null,
        media_urls: mediaUrls.length ? mediaUrls : null,
      }

      let data = null
      if (mode === 'edit') {
        const { data: updated, error: updateError } = await supabase
          .from('symptom_logs')
          .update(payload)
          .eq('id', editingId)
          .select(
            'id, bunny_id, logged_at, observed_since, body_area, symptom_type, severity, notes, media_urls',
          )
          .single()
        if (updateError) throw updateError
        data = updated
      } else {
        const { data: inserted, error: insertError } = await supabase
          .from('symptom_logs')
          .insert(payload)
          .select(
            'id, bunny_id, logged_at, observed_since, body_area, symptom_type, severity, notes, media_urls',
          )
          .single()
        if (insertError) throw insertError
        data = inserted
      }

      await queryClient.invalidateQueries({
        queryKey: ['symptom_logs', user?.id ?? null, activeBunnyId ?? null],
      })
      await queryClient.invalidateQueries({ queryKey: ['recent_activity'] })
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })

      // Ensure Home -> Recent activity updates immediately (staleTime is 5m + persisted cache).
      if (data?.id) {
        const t = data?.logged_at ? new Date(data.logged_at).getTime() : Date.now()
        const ev = {
          id: `symptom:${data.id}`,
          type: 'symptom',
          title: {
            body_area: data?.body_area ?? null,
            symptom_type: data?.symptom_type ?? null,
          },
          ts: Number.isFinite(t) ? t : Date.now(),
          raw: data,
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

      if (typeof onSaved === 'function') {
        onSaved(data)
      }

      setSaved(data)
      startCreate()
    } catch (err) {
      const msg = err?.message || 'Failed to save symptom log.'
      if (/mime/i.test(msg) || /content[- ]type/i.test(msg) || /Bad Request/i.test(msg)) {
        setError(
          [
            msg,
            '',
            'Upload was rejected by Supabase Storage. If your bucket has “Restrict MIME types” enabled, make sure it allows common types like:',
            '- image/jpeg, image/png, image/webp',
            '- video/mp4, video/quicktime',
            '',
            `Also confirm the bucket max file size is ≥ ${formatBytes(MAX_MEDIA_FILE_BYTES)}.`,
          ].join('\n'),
        )
        return
      }
      if (/row-level security/i.test(msg)) {
        try {
          const [{ data: authUserData }, { data: bunnyOwnerCheck }] = await Promise.all([
            supabase.auth.getUser(),
            supabase
              .from('bunnies')
              .select('id, bunhouse_id')
              .eq('id', activeBunnyId)
              .eq('bunhouse_id', activeBunhouseId)
              .maybeSingle(),
          ])

          const actualUserId = authUserData?.user?.id ?? null
          const bunnyInActiveBunhouse = Boolean(bunnyOwnerCheck?.id)

          setError(
            [
              'Save blocked by Supabase security (RLS).',
              '',
              `Debug: activeBunnyId=${activeBunnyId}`,
              `Debug: activeBunhouseId=${activeBunhouseId}`,
              `Debug: authContextUserId=${user.id}`,
              `Debug: supabaseAuthUserId=${actualUserId ?? 'null'}`,
              `Debug: bunnyInActiveBunhouse=${bunnyInActiveBunhouse ? 'true' : 'false'}`,
              '',
              'If `supabaseAuthUserId` is null, you’re not authenticated in this tab.',
              'If `bunnyInActiveBunhouse` is false, the bunny row is not in your selected bunhouse.',
              'If both look correct, re-check that the INSERT policy is on `public.symptom_logs` and enabled for role `authenticated` (or `public`).',
            ].join('\n'),
          )
        } catch {
          setError(
            'Save blocked by Supabase security (RLS). Go to Settings and re-select your bunhouse/bunny, then retry. If it still fails, check `bunhouse_members` and `symptom_logs` RLS policies.',
          )
        }
        return
      }
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  function onBack() {
    setError('')
    setFieldErrors({ customBodyArea: '', customSymptom: '' })
    setSaved(null)
    setStep((s) => Math.max(1, s - 1))
  }

  function onNext() {
    if (!canNext) {
      setError('')
      setSaved(null)

      if (step === 1) {
        if (!bodyArea) {
          setError('Please choose a body area to continue.')
          return
        }
        if (bodyArea === '__custom__' && !customBodyArea.trim()) {
          setFieldErrors((fe) => ({
            ...fe,
            customBodyArea: 'Please enter a custom body area.',
          }))
          return
        }
      }

      if (step === 2) {
        if (!symptomType) {
          setError('Please choose a symptom type to continue.')
          return
        }
        if (symptomType === '__custom__' && !customSymptom.trim()) {
          setFieldErrors((fe) => ({
            ...fe,
            customSymptom: 'Please enter a custom symptom.',
          }))
          return
        }
      }

      if (step === 3) {
        setError('Please choose a severity (1–5) to continue.')
        return
      }

      return
    }
    setError('')
    setFieldErrors({ customBodyArea: '', customSymptom: '' })
    setSaved(null)
    setStep((s) => Math.min(4, s + 1))
  }

  const Wrapper = container === 'none' ? 'div' : Card
  const inDrawer = container === 'none'

  const header = hideHeader ? null : (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-lg font-semibold text-text-dark">
          {mode === 'edit' ? 'Edit symptom' : 'Symptom Logger'}
        </div>
        <div className="mt-1 text-sm text-text-mid" />
      </div>
    </div>
  )

  const stepOnlyHeader = null

  const topMessages = (
    <>
      {!activeBunnyId ? (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Choose an active bunny before logging symptoms.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {saved ? (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Saved symptom log: <span className="font-semibold">{saved.body_area}</span> →{' '}
          <span className="font-semibold">{saved.symptom_type}</span> (severity{' '}
          <span className="font-semibold">{saved.severity}</span>).
        </div>
      ) : null}

      {saved && saved.severity >= 4 ? (
        <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
          <div className="font-semibold">Urgent</div>
          <div className="mt-1 text-orange-800">
            Severity {saved.severity} can be serious. Consider contacting your rabbit-savvy vet as
            soon as possible.
          </div>
        </div>
      ) : null}
    </>
  )

  const stepContent = (
    <div className={cx('min-w-0 max-w-full', hideHeader ? '' : 'mt-5')}>
        {step === 1 ? (
          <div>
            <div className="text-lg font-medium text-text-dark">Where is it happening?</div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {BODY_AREAS.map((area) => {
                const selected = area === bodyArea
                return (
                  <button
                    key={area}
                    type="button"
                    className={cx(
                      'rounded-2xl border px-3 py-4 text-sm font-semibold',
                      selected
                        ? 'border-lavender bg-lavender-light text-lavender-dark'
                        : 'border-lavender-mid/30 bg-warm-white text-text-dark hover:border-lavender',
                    )}
                    onClick={() => {
                      setSaved(null)
                      setError('')
                      setBodyArea(area)
                      setCustomBodyArea('')
                      setSymptomType('')
                      setCustomSymptom('')
                    }}
                  >
                    {toSentenceCase(area)}
                  </button>
                )
              })}

              <div />
              <button
                type="button"
                className={cx(
                  'rounded-2xl border px-3 py-4 text-sm font-semibold',
                  bodyArea === '__custom__'
                    ? 'border-lavender bg-lavender-light text-lavender-dark'
                    : 'border-lavender-mid/30 bg-warm-white text-text-dark hover:border-lavender',
                )}
                onClick={() => {
                  setSaved(null)
                  setError('')
                  setBodyArea('__custom__')
                  setSymptomType('')
                  setCustomSymptom('')
                }}
              >
                Other / custom…
              </button>
              <div />
            </div>

            {bodyArea === '__custom__' ? (
              <div className="mt-3">
                <div className="text-sm font-medium text-text-dark">Custom body area</div>
                <div className="mt-1">
                  <input
                    value={customBodyArea}
                    onChange={(e) => {
                      setCustomBodyArea(e.target.value)
                      if (fieldErrors.customBodyArea) {
                        setFieldErrors((fe) => ({ ...fe, customBodyArea: '' }))
                      }
                    }}
                    className="h-12 w-full rounded-xl border border-lavender-mid/30 bg-warm-white px-4 text-sm outline-none focus:border-lavender"
                    placeholder="e.g., mouth / teeth"
                    autoComplete="off"
                  />
                </div>
                {fieldErrors.customBodyArea ? (
                  <div className="mt-2 text-sm text-red-700">{fieldErrors.customBodyArea}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div>
            <div className="text-lg font-medium text-text-dark">
              What symptom are you seeing?
            </div>
            <div className="mt-1 text-xs text-text-mid">
              Filtered by: {toSentenceCase(bodyAreaToSave)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {symptomOptions.map((s) => {
                const selected = s === symptomType
                return (
                  <button
                    key={s}
                    type="button"
                    className={cx(
                      'rounded-full border px-3 py-2 text-sm font-semibold',
                      selected
                        ? 'border-lavender bg-lavender-light text-lavender-dark'
                        : 'border-lavender-mid/30 bg-warm-white text-text-dark hover:border-lavender',
                    )}
                    onClick={() => {
                      setSaved(null)
                      setError('')
                      setSymptomType(s)
                      setCustomSymptom('')
                    }}
                  >
                    {toSentenceCase(s)}
                  </button>
                )
              })}

              <button
                type="button"
                className={cx(
                  'rounded-full border px-3 py-2 text-sm font-semibold',
                  symptomType === '__custom__'
                    ? 'border-lavender bg-lavender-light text-lavender-dark'
                    : 'border-lavender-mid/30 bg-warm-white text-text-dark hover:border-lavender',
                )}
                onClick={() => {
                  setSaved(null)
                  setError('')
                  setSymptomType('__custom__')
                }}
              >
                Other / custom…
              </button>
            </div>

            {symptomType === '__custom__' ? (
              <div className="mt-3">
                <div className="text-sm font-medium text-text-dark">Custom symptom</div>
                <div className="mt-1">
                  <input
                    value={customSymptom}
                    onChange={(e) => {
                      setCustomSymptom(e.target.value)
                      if (fieldErrors.customSymptom) {
                        setFieldErrors((fe) => ({ ...fe, customSymptom: '' }))
                      }
                    }}
                    className="h-12 w-full rounded-xl border border-lavender-mid/30 bg-warm-white px-4 text-sm outline-none focus:border-lavender"
                    placeholder="e.g., grinding teeth after eating"
                    autoComplete="off"
                  />
                </div>
                {fieldErrors.customSymptom ? (
                  <div className="mt-2 text-sm text-red-700">{fieldErrors.customSymptom}</div>
                ) : null}
                <div className="mt-2 text-xs text-text-mid">
                  This will be saved as the symptom type for this entry.
                </div>
              </div>
            ) : null}

            {symptomOptions.length === 0 ? (
              <div className="mt-3 text-sm text-text-mid">No symptom types found for this area.</div>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div>
            <div className="text-lg font-medium text-text-dark">How severe is it?</div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {severityOptions.map((opt) => {
                const selected = opt.value === severity
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={cx(
                      'flex items-center justify-start gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold',
                      selected
                        ? 'border-lavender bg-lavender-light text-lavender-dark'
                        : 'border-lavender-mid/30 bg-warm-white text-text-dark hover:border-lavender',
                    )}
                    onClick={() => {
                      setSaved(null)
                      setError('')
                      setSeverity(opt.value)
                    }}
                  >
                    <span className={cx('h-4 w-4 shrink-0 rounded-full', opt.swatch)} />
                    <span className="whitespace-nowrap">
                      {opt.value} · {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid min-w-0 gap-4">
            <div className="min-w-0">
              <div className="text-lg font-medium text-text-dark">
                Since when did you observe your bunny’s symptom?
              </div>
              <div className="mt-1 min-w-0">
                <input
                  type="date"
                  value={observedSince}
                  onChange={(e) => setObservedSince(e.target.value)}
                  className="box-border h-12 w-full min-w-0 max-w-full rounded-xl border border-lavender-mid/30 bg-warm-white px-4 text-sm outline-none focus:border-lavender"
                />
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-lg font-medium text-text-dark">Notes</div>
              <div className="mt-1 min-w-0">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  className="box-border w-full min-w-0 max-w-full resize-none rounded-xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm outline-none focus:border-lavender"
                  placeholder="Anything else you want to remember (time, triggers, appetite, poop, meds, etc.)"
                />
              </div>
            </div>

            <div className="min-w-0">
              <div className="text-lg font-medium text-text-dark">
                Photos or videos (optional)
              </div>
              <div className="mt-1 text-xs text-text-mid">
                Add multiple files—the same way as vet visit attachments. Max{' '}
                {formatBytes(MAX_MEDIA_FILE_BYTES)} each; videos under 60 seconds.
              </div>

              <div className="mt-3 min-w-0">
                <div className="text-xs font-semibold text-text-mid">Files</div>

                {mode === 'edit' && existingMediaUrls.length ? (
                  <div className="mt-2 space-y-2">
                    {existingMediaUrls.map((path) => {
                      const signed = existingMediaSigned.find((x) => x.path === path)
                      const label = guessAttachmentLabel(path)
                      return (
                        <div
                          key={path}
                          className="flex min-w-0 flex-col gap-3 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <FileIcon />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-text-dark">
                                {label}
                              </div>
                            </div>
                          </div>
                          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
                            {signed?.url ? (
                              <a
                                href={signed.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-1 text-xs font-semibold text-text-dark hover:border-lavender"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="text-xs text-text-mid">Loading link…</span>
                            )}
                            <button
                              type="button"
                              className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                              onClick={() =>
                                setExistingMediaUrls((prev) => prev.filter((p) => p !== path))
                              }
                              disabled={saving}
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                <FileInput
                  className="mt-2 min-w-0 max-w-full"
                  accept="image/*,video/*"
                  multiple
                  onChange={async (e) => {
                    try {
                      await onPickFiles(e.target.files)
                    } catch (err) {
                      setError(err?.message || 'Invalid file.')
                    } finally {
                      e.target.value = ''
                    }
                  }}
                />

                {pendingFiles.length ? (
                  <div className="mt-3 space-y-2">
                    {pendingFiles.map((pf) => (
                      <div
                        key={pf.localKey}
                        className="flex min-w-0 flex-col gap-3 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <FileIcon />
                          <div className="min-w-0 flex-1 truncate text-sm font-semibold text-text-dark">
                            {guessAttachmentLabel(pf.file)}
                          </div>
                        </div>
                        <button
                          type="button"
                          className="self-end rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-1 text-xs font-semibold text-text-dark hover:border-lavender"
                          onClick={() =>
                            setPendingFiles((list) =>
                              list.filter((x) => x.localKey !== pf.localKey),
                            )
                          }
                          disabled={saving}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
    </div>
  )

  const footer = (
    <div
      className={
        inDrawer
          ? 'flex min-w-0 items-center justify-between gap-3'
          : 'mt-6 flex items-center justify-between gap-3'
      }
    >
        <button
          type="button"
          className={cx(
            'rounded-full px-4 py-3 text-sm font-semibold',
            step === 1
              ? 'cursor-not-allowed text-text-mid/50'
              : 'text-lavender-dark hover:bg-lavender-light',
          )}
          onClick={onBack}
          disabled={step === 1 || saving}
        >
          Back
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {step < 4 ? (
            <Button type="button" onClick={onNext} disabled={saving}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={onSave} disabled={saving || !user?.id}>
              {saving ? 'Saving…' : 'Save symptom'}
            </Button>
          )}
        </div>
      </div>
  )

  if (inDrawer) {
    return (
      <div className="flex h-full min-w-0 flex-col">
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
          {header ?? stepOnlyHeader}
          {topMessages}
          {stepContent}
        </div>
        <div className="shrink-0 border-t border-lavender-mid/30 bg-warm-white px-6 py-4">
          {footer}
        </div>
      </div>
    )
  }

  return (
    <Wrapper>
      {header}
      {topMessages}
      {stepContent}
      {footer}
    </Wrapper>
  )
}

