import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'
import { useBunnies } from '../hooks/useBunnies'
import { useBunny } from '../hooks/useBunny'
import { useBunhouse } from '../hooks/useBunhouse'
import { useUpload } from '../hooks/useUpload'
import { useAccountCurrency } from '../hooks/useAccountCurrency'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { FileInput } from '../components/ui/FileInput'
import { Drawer } from '../components/ui/Drawer'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { RadioOption } from '../components/ui/RadioOption'
import {
  FavoriteHangoutSelect,
  FavoriteSnackSelect,
} from '../components/bunny/BunnyProfileExtraSelects'
import {
  FAVORITE_SNACK_SELECT_OTHER,
  splitFavoriteSnackForForm,
} from '../lib/bunnyProfileExtras'
import { STORAGE_BUCKETS } from '../lib/storageBuckets'
import { exportAllDataToPdf } from '../lib/exportAllDataPdf'
import { VISIT_COST_CURRENCIES } from '../lib/constants'
import { IconEye, IconLock, IconX } from '@tabler/icons-react'

const BUNNY_PROFILE_BUCKET = STORAGE_BUCKETS.bunnyProfilePhotos
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

async function ensureProfileExists({ user }) {
  const { error } = await supabase.from('profiles').upsert(
    {
      id: user.id,
      email: user.email ?? null,
      full_name: user.user_metadata?.full_name ?? null,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

async function ensureDefaultBunhouse({ userId }) {
  const { data, error } = await supabase
    .from('bunhouse_members')
    .select('bunhouse_id')
    .eq('user_id', userId)
    .limit(1)

  if (error) throw error

  const existingId = data?.[0]?.bunhouse_id ?? null
  if (existingId) return existingId

  const { data: created, error: createErr } = await supabase
    .from('bunhouses')
    .insert({ name: 'My Bunhouse' })
    .select('id')
    .single()
  if (createErr) throw createErr

  const bunhouseId = created?.id
  if (!bunhouseId) throw new Error('Failed to create bunhouse')

  const { error: memberErr } = await supabase
    .from('bunhouse_members')
    .insert({ bunhouse_id: bunhouseId, user_id: userId })
  if (memberErr) throw memberErr

  return bunhouseId
}

function getProfileValidation(state) {
  const name = state.name.trim()
  const breed = state.breed.trim()
  const date_of_birth = state.date_of_birth
  const sex = state.sex
  const neuteredChoice = state.is_neutered

  const snackSelect = String(state.favorite_snack ?? '').trim()
  const snackCustom = String(state.favorite_snack_custom ?? '').trim()
  let favorite_snack = null
  if (snackSelect === FAVORITE_SNACK_SELECT_OTHER) {
    favorite_snack = snackCustom || null
  } else if (snackSelect) {
    favorite_snack = snackSelect
  }
  const snackOtherError =
    snackSelect === FAVORITE_SNACK_SELECT_OTHER && !snackCustom
      ? 'Please describe their favorite treat.'
      : ''

  const favorite_hangout = String(state.favorite_hangout ?? '').trim() || null

  const missing = []
  if (!name) missing.push('Name')
  if (!breed) missing.push('Breed')
  if (!date_of_birth) missing.push('Birthday')
  if (sex !== 'male' && sex !== 'female') missing.push('Sex')
  if (neuteredChoice !== 'yes' && neuteredChoice !== 'no')
    missing.push('Neutered / spayed')

  return {
    ok: missing.length === 0 && !snackOtherError,
    missing,
    snackOtherError,
    payload: {
      name,
      breed,
      date_of_birth,
      sex,
      is_neutered: neuteredChoice === 'yes',
      favorite_snack,
      favorite_hangout,
    },
  }
}

function formatDateInput(value) {
  if (!value) return ''
  if (typeof value === 'string') return value.slice(0, 10)
  return ''
}

function editStateFor(bunny) {
  if (!bunny) {
    return {
      name: '',
      breed: '',
      date_of_birth: '',
      sex: '',
      is_neutered: '',
      favorite_snack: '',
      favorite_snack_custom: '',
      favorite_hangout: '',
    }
  }

  const snack = splitFavoriteSnackForForm(bunny.favorite_snack)

  return {
    name: bunny.name ?? '',
    breed: bunny.breed ?? '',
    date_of_birth: formatDateInput(bunny.date_of_birth),
    sex: bunny.sex ?? '',
    is_neutered:
      bunny.is_neutered === true ? 'yes' : bunny.is_neutered === false ? 'no' : '',
    favorite_snack: snack.select,
    favorite_snack_custom: snack.custom,
    favorite_hangout: bunny.favorite_hangout ?? '',
  }
}

function PencilIcon({ className = '' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M12 20h9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Settings() {
  const { user, signOut } = useAuth()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: bunnies = [], isLoading, error } = useBunnies()
  const { activeBunnyId, setActiveBunnyId } = useBunny()
  const { activeBunhouseId, setActiveBunhouseId } = useBunhouse()
  const { uploadFile } = useUpload()
  const { currencyCode, isLocked: currencyLocked } = useAccountCurrency()
  const currencyOptions = useMemo(() => VISIT_COST_CURRENCIES, [])
  const [currencySaving, setCurrencySaving] = useState(false)
  const [currencyError, setCurrencyError] = useState('')
  const [bunnyPhotoUrls, setBunnyPhotoUrls] = useState({})

  const {
    data: bunhouseMembers = [],
    isLoading: bunhouseMembersLoading,
    error: bunhouseMembersError,
  } = useQuery({
    queryKey: ['bunhouse_members', activeBunhouseId ?? null],
    enabled: Boolean(activeBunhouseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bunhouse_members')
        .select('user_id, created_at, profiles ( id, email, full_name )')
        .eq('bunhouse_id', activeBunhouseId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return (data ?? []).map((row) => ({
        user_id: row.user_id,
        created_at: row.created_at,
        profile: row.profiles ?? null,
      }))
    },
  })

  const {
    data: bunhouseInvites = [],
    isLoading: bunhouseInvitesLoading,
    error: bunhouseInvitesError,
  } = useQuery({
    queryKey: ['bunhouse_invites', activeBunhouseId ?? null],
    enabled: Boolean(activeBunhouseId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bunhouse_invites')
        .select('id, bunhouse_id, email, invited_by, created_at, accepted_at, accepted_by')
        .eq('bunhouse_id', activeBunhouseId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  const [memberDraftEmail, setMemberDraftEmail] = useState('')
  const [memberSaving, setMemberSaving] = useState(false)
  const [memberError, setMemberError] = useState('')

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createState, setCreateState] = useState({
    name: '',
    breed: '',
    date_of_birth: '',
    sex: '',
    is_neutered: '',
    favorite_snack: '',
    favorite_snack_custom: '',
    favorite_hangout: '',
  })
  const [createPhotoFile, setCreatePhotoFile] = useState(null)
  const [createError, setCreateError] = useState('')
  const [createFieldErrors, setCreateFieldErrors] = useState({})
  const [createSaving, setCreateSaving] = useState(false)
  const createPhotoPreviewUrl = useMemo(() => {
    if (!createPhotoFile) return ''
    return URL.createObjectURL(createPhotoFile)
  }, [createPhotoFile])

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editTargetId, setEditTargetId] = useState(null)
  const editTarget = useMemo(
    () => bunnies.find((b) => b.id === editTargetId) ?? null,
    [bunnies, editTargetId],
  )
  const [editState, setEditState] = useState({
    name: '',
    breed: '',
    date_of_birth: '',
    sex: '',
    is_neutered: '',
    favorite_snack: '',
    favorite_snack_custom: '',
    favorite_hangout: '',
  })
  const [editPhotoFile, setEditPhotoFile] = useState(null)
  const [editError, setEditError] = useState('')
  const [editSnackOtherError, setEditSnackOtherError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const editPhotoPreviewUrl = useMemo(() => {
    if (!editPhotoFile) return ''
    return URL.createObjectURL(editPhotoFile)
  }, [editPhotoFile])
  const [editPhotoSignedUrl, setEditPhotoSignedUrl] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)

  const [accountNotice, setAccountNotice] = useState('')
  const [accountError, setAccountError] = useState('')
  const [exportBusy, setExportBusy] = useState(false)

  // Initialize once; avoid setState-in-effect lint rule.
  const [currencyDraft, setCurrencyDraft] = useState(currencyCode || 'PHP')

  useEffect(() => {
    if (!createPhotoPreviewUrl) return
    return () => URL.revokeObjectURL(createPhotoPreviewUrl)
  }, [createPhotoPreviewUrl])

  useEffect(() => {
    let active = true
    async function run() {
      const next = {}
      for (const bunny of bunnies) {
        const value = bunny?.photo_url
        if (!value || typeof value !== 'string') {
          next[bunny.id] = ''
          continue
        }
        const trimmed = value.trim()
        if (!trimmed) {
          next[bunny.id] = ''
          continue
        }
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          next[bunny.id] = trimmed
          continue
        }
        const { data, error: signedError } = await supabase.storage
          .from(BUNNY_PROFILE_BUCKET)
          .createSignedUrl(trimmed, SIGNED_URL_TTL_SECONDS)
        if (!active) return
        if (signedError) {
          next[bunny.id] = ''
          continue
        }
        next[bunny.id] = data?.signedUrl ?? ''
      }
      if (!active) return
      setBunnyPhotoUrls(next)
    }
    run()
    return () => {
      active = false
    }
  }, [bunnies])

  useEffect(() => {
    if (!editPhotoPreviewUrl) return
    return () => URL.revokeObjectURL(editPhotoPreviewUrl)
  }, [editPhotoPreviewUrl])

  useEffect(() => {
    let active = true
    async function run() {
      const value = editTarget?.photo_url
      if (!value || typeof value !== 'string') {
        if (active) setEditPhotoSignedUrl('')
        return
      }
      const trimmed = value.trim()
      if (!trimmed) {
        if (active) setEditPhotoSignedUrl('')
        return
      }
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (active) setEditPhotoSignedUrl(trimmed)
        return
      }
      const { data, error: signedError } = await supabase.storage
        .from(BUNNY_PROFILE_BUCKET)
        .createSignedUrl(trimmed, SIGNED_URL_TTL_SECONDS)
      if (!active) return
      if (signedError) {
        setEditPhotoSignedUrl('')
        return
      }
      setEditPhotoSignedUrl(data?.signedUrl ?? '')
    }
    run()
    return () => {
      active = false
    }
  }, [editTarget?.photo_url])

  useEffect(() => {
    const id = location.state?.editBunnyId
    if (!id || typeof id !== 'string') return

    const target = bunnies.find((b) => b.id === id)
    const t = window.setTimeout(() => {
      if (!target) {
        navigate('/settings', { replace: true, state: {} })
        return
      }
      setEditError('')
      setEditSnackOtherError('')
      setEditPhotoFile(null)
      setEditState(editStateFor(target))
      setEditTargetId(target.id)
      setEditModalOpen(true)
      navigate('/settings', { replace: true, state: {} })
    }, 0)
    return () => window.clearTimeout(t)
  }, [location.state, bunnies, navigate])

  function resetCreate() {
    setCreateState({
      name: '',
      breed: '',
      date_of_birth: '',
      sex: '',
      is_neutered: '',
      favorite_snack: '',
      favorite_snack_custom: '',
      favorite_hangout: '',
    })
    setCreatePhotoFile(null)
    setCreateFieldErrors({})
    setCreateError('')
  }

  function resetEdit() {
    setEditTargetId(null)
    setEditState(editStateFor(null))
    setEditPhotoFile(null)
    setEditPhotoSignedUrl('')
    setEditError('')
    setEditSnackOtherError('')
  }

  async function createBunny({ state, photoFile }) {
    const validation = getProfileValidation(state)
    const bunhouseId =
      activeBunhouseId || (await ensureDefaultBunhouse({ userId: user.id }))
    if (!activeBunhouseId) setActiveBunhouseId(bunhouseId)

    const { data, error: insertError } = await supabase
      .from('bunnies')
      .insert({ bunhouse_id: bunhouseId, ...validation.payload })
      .select(
        'id, bunhouse_id, owner_id, name, breed, date_of_birth, sex, is_neutered, favorite_snack, favorite_hangout, photo_url, created_at',
      )
      .single()
    if (insertError) throw insertError

    if (photoFile) {
      const path = `${bunhouseId}/${data.id}/profile.jpg`
      await uploadFile({
        bucket: BUNNY_PROFILE_BUCKET,
        path,
        file: photoFile,
        options: {
          upsert: true,
          contentType: photoFile.type || 'image/jpeg',
        },
      })

      const { error: photoUpdateError } = await supabase
        .from('bunnies')
        .update({ photo_url: path })
        .eq('id', data.id)
      if (photoUpdateError) throw photoUpdateError
    }

    await queryClient.invalidateQueries({ queryKey: ['bunnies', user.id, bunhouseId] })
    return data
  }

  async function onCreateBunny(e) {
    e.preventDefault()
    if (!user?.id) return

    setCreateError('')
    const validation = getProfileValidation(createState)
    const nextFieldErrors = {
      name: validation.payload.name ? '' : 'Please enter your bunny’s name.',
      breed: validation.payload.breed ? '' : 'Please enter the breed.',
      date_of_birth: validation.payload.date_of_birth
        ? ''
        : 'Please choose a birthday.',
      sex:
        validation.payload.sex === 'male' || validation.payload.sex === 'female'
          ? ''
          : 'Please select a sex.',
      is_neutered:
        createState.is_neutered === 'yes' || createState.is_neutered === 'no'
          ? ''
          : 'Please choose yes or no.',
      favorite_snack_other: validation.snackOtherError || '',
    }
    setCreateFieldErrors(nextFieldErrors)
    if (Object.values(nextFieldErrors).some(Boolean)) return

    setCreateSaving(true)
    try {
      await ensureProfileExists({ user })
      const data = await createBunny({ state: createState, photoFile: createPhotoFile })
      if (data?.id) setActiveBunnyId(data.id)
      resetCreate()
      setCreateModalOpen(false)
    } catch (err) {
      setCreateError(err?.message || 'Failed to create bunny')
    } finally {
      setCreateSaving(false)
    }
  }

  async function onSaveBunny(e) {
    e.preventDefault()
    if (!user?.id || !editTargetId) return

    setEditError('')
    setEditSnackOtherError('')
    const validation = getProfileValidation(editState)
    if (!validation.ok) {
      if (validation.snackOtherError) setEditSnackOtherError(validation.snackOtherError)
      if (validation.missing.length) {
        setEditError(`Please complete: ${validation.missing.join(', ')}`)
      }
      return
    }

    setEditSaving(true)
    try {
      const { error: updateError } = await supabase
        .from('bunnies')
        .update(validation.payload)
        .eq('id', editTargetId)
      if (updateError) throw updateError

      if (editPhotoFile) {
        const bunhouseId =
          activeBunhouseId || (await ensureDefaultBunhouse({ userId: user.id }))
        if (!activeBunhouseId) setActiveBunhouseId(bunhouseId)

        const path = `${bunhouseId}/${editTargetId}/profile.jpg`
        await uploadFile({
          bucket: BUNNY_PROFILE_BUCKET,
          path,
          file: editPhotoFile,
          options: {
            upsert: true,
            contentType: editPhotoFile.type || 'image/jpeg',
          },
        })
        const { error: photoUpdateError } = await supabase
          .from('bunnies')
          .update({ photo_url: path })
          .eq('id', editTargetId)
        if (photoUpdateError) throw photoUpdateError
      }

      await queryClient.invalidateQueries({
        queryKey: ['bunnies', user.id, activeBunhouseId ?? null],
      })
      setEditPhotoFile(null)
      setEditSnackOtherError('')
      setEditModalOpen(false)
    } catch (err) {
      setEditError(err?.message || 'Failed to save bunny')
    } finally {
      setEditSaving(false)
    }
  }

  async function onDeleteBunny() {
    if (!user?.id || !editTargetId) return
    if (deleteBusy) return

    setDeleteBusy(true)
    setEditError('')
    try {
      const { error: deleteError } = await supabase.from('bunnies').delete().eq('id', editTargetId)
      if (deleteError) throw deleteError

      await queryClient.invalidateQueries({
        queryKey: ['bunnies', user.id, activeBunhouseId ?? null],
      })
      if (activeBunnyId === editTargetId) {
        setActiveBunnyId(null)
      }

      setDeleteConfirmOpen(false)
      resetEdit()
      setEditModalOpen(false)
    } catch (err) {
      setEditError(err?.message || 'Failed to delete bunny')
      setDeleteConfirmOpen(false)
    } finally {
      setDeleteBusy(false)
    }
  }

  async function onInviteMemberByEmail(e) {
    e?.preventDefault?.()
    if (!activeBunhouseId) return
    const nextEmail = String(memberDraftEmail ?? '').trim().toLowerCase()
    if (!nextEmail) return

    setMemberSaving(true)
    setMemberError('')
    try {
      const { error: insertError } = await supabase.from('bunhouse_invites').insert({
        bunhouse_id: activeBunhouseId,
        email: nextEmail,
        invited_by: user?.id ?? null,
      })
      if (insertError) throw insertError

      setMemberDraftEmail('')
      await queryClient.invalidateQueries({
        queryKey: ['bunhouse_members', activeBunhouseId],
      })
      await queryClient.invalidateQueries({
        queryKey: ['bunhouse_invites', activeBunhouseId],
      })
    } catch (err) {
      setMemberError(err?.message || 'Failed to send invite.')
    } finally {
      setMemberSaving(false)
    }
  }

  async function onRemoveBunhouseMember(userId) {
    if (!activeBunhouseId) return
    const uid = String(userId ?? '').trim()
    if (!uid) return

    setMemberSaving(true)
    setMemberError('')
    try {
      const { error: delError } = await supabase
        .from('bunhouse_members')
        .delete()
        .eq('bunhouse_id', activeBunhouseId)
        .eq('user_id', uid)
      if (delError) throw delError

      await queryClient.invalidateQueries({
        queryKey: ['bunhouse_members', activeBunhouseId],
      })
    } catch (err) {
      setMemberError(err?.message || 'Failed to remove member.')
    } finally {
      setMemberSaving(false)
    }
  }

  async function onExportAllData() {
    if (!user?.id) return
    if (exportBusy) return

    setAccountNotice('')
    setAccountError('')
    setExportBusy(true)
    try {
      await exportAllDataToPdf({ userId: user.id, email: user.email ?? '' })
      setAccountNotice('Export opened in a new tab. Use “Save as PDF” from the print dialog.')
    } catch (err) {
      setAccountError(err?.message || 'Failed to export data')
    } finally {
      setExportBusy(false)
    }
  }

  async function onSignOut() {
    setAccountNotice('')
    setAccountError('')
    try {
      const { error: signOutError } = await signOut()
      if (signOutError) throw signOutError
    } catch (err) {
      setAccountError(err?.message || 'Failed to sign out')
    }
  }

  return (
    <main className="min-w-0">
      <h1 className="text-xl font-semibold">Settings</h1>
      <p className="mt-2 text-sm text-text-mid">
        Manage your bunny profiles and account.
      </p>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error.message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        <Card>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Bunny Management</div>
              <div className="mt-1 text-sm text-text-mid">
                {isLoading
                  ? 'Loading…'
                  : bunnies.length === 0
                    ? 'No bunnies yet.'
                    : `${bunnies.length} ${bunnies.length === 1 ? 'bunny' : 'bunnies'}.`}
              </div>
            </div>
            <Button
              type="button"
              className="shrink-0 whitespace-nowrap hover:brightness-95 sm:self-start"
              onClick={() => {
                resetCreate()
                setCreateModalOpen(true)
              }}
            >
              Add bunny
            </Button>
          </div>

          <div className="mt-4 grid gap-2">
            {bunnies.map((bunny) => (
              <div
                key={bunny.id}
                className={`flex min-w-0 flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${
                  bunny.id === activeBunnyId
                    ? 'border-lavender bg-lavender/10'
                    : 'border-lavender-mid/30 bg-warm-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveBunnyId(bunny.id)}
                  className="flex min-w-0 w-full items-center gap-3 text-left sm:flex-1"
                >
                  {bunnyPhotoUrls?.[bunny.id] ? (
                    <img
                      src={bunnyPhotoUrls[bunny.id]}
                      alt={`${bunny.name} profile`}
                      className="h-10 w-10 shrink-0 rounded-full border border-lavender-mid/30 object-cover"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 shrink-0 rounded-full bg-lavender-mid/40"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="truncate text-sm font-semibold text-text-dark">{bunny.name}</div>
                    <div className="truncate text-xs text-text-mid">{bunny.breed || '—'}</div>
                  </div>
                </button>

                <div className="flex shrink-0 items-center justify-end gap-2 sm:justify-start">
                  {bunny.id === activeBunnyId ? (
                    <div className="text-xs font-semibold text-text-mid">Active</div>
                  ) : null}
                  <Link
                    to={`/settings/bunny/${bunny.id}`}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-lavender-mid/30 bg-warm-white text-text-dark hover:brightness-95"
                    aria-label={`View ${bunny.name} profile`}
                  >
                    <IconEye className="h-5 w-5" aria-hidden />
                  </Link>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-lavender-mid/30 bg-warm-white text-text-dark"
                    onClick={() => {
                      setEditError('')
                      setEditSnackOtherError('')
                      setEditPhotoFile(null)
                      setEditState(editStateFor(bunny))
                      setEditTargetId(bunny.id)
                      setEditModalOpen(true)
                    }}
                    aria-label={`Edit ${bunny.name}`}
                  >
                    <PencilIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </Card>

        <Card>
          <div className="text-sm font-semibold text-text-dark">Bunhouse members</div>
          <div className="mt-1 break-words text-sm leading-relaxed text-text-mid">
            Anyone listed here can view and edit this bunhouse’s bunnies and records.
          </div>

          {bunhouseMembersError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {bunhouseMembersError?.message || 'Failed to load members.'}
            </div>
          ) : null}

          <form
            className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch"
            onSubmit={onInviteMemberByEmail}
          >
            <Input
              className="min-w-0 sm:flex-1"
              value={memberDraftEmail}
              onChange={(e) => setMemberDraftEmail(e.target.value)}
              placeholder="Email address (Gmail)"
              autoComplete="off"
              disabled={memberSaving || !activeBunhouseId}
            />
            <Button
              type="submit"
              className="shrink-0 whitespace-nowrap hover:brightness-95"
              disabled={memberSaving || !activeBunhouseId || !memberDraftEmail.trim()}
            >
              {memberSaving ? 'Saving…' : 'Send invite'}
            </Button>
          </form>

          {memberError ? (
            <div className="mt-3 text-sm text-red-700">{memberError}</div>
          ) : null}

          <div className="mt-4 grid gap-2">
            {bunhouseMembersLoading ? (
              <div className="text-sm text-text-mid">Loading members…</div>
            ) : null}

            {!bunhouseMembersLoading && bunhouseMembers.length === 0 ? (
              <div className="text-sm text-text-mid">No members found.</div>
            ) : null}

            {bunhouseMembers.map((m) => {
              const p = m.profile
              const label =
                p?.email?.trim() ||
                p?.full_name?.trim() ||
                (m.user_id ? String(m.user_id) : 'Unknown user')

              const isYou = Boolean(user?.id && m.user_id === user.id)
              return (
                <div
                  key={m.user_id}
                  className="flex min-w-0 flex-col gap-3 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-text-dark">
                      {label}
                      {isYou ? <span className="ml-2 text-xs font-semibold text-text-mid">(you)</span> : null}
                    </div>
                    <div className="mt-1 truncate text-xs text-text-mid">{m.user_id}</div>
                  </div>
                  <button
                    type="button"
                    className={`shrink-0 self-end rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-2 text-sm font-semibold text-text-dark sm:self-auto ${
                      memberSaving ? 'opacity-60' : 'hover:brightness-95'
                    }`}
                    disabled={memberSaving || !activeBunhouseId}
                    onClick={() => onRemoveBunhouseMember(m.user_id)}
                  >
                    Remove
                  </button>
                </div>
              )
            })}
          </div>

          <div className="mt-6 border-t border-lavender-mid/30 pt-5">
            <div className="text-sm font-semibold text-text-dark">Pending invites</div>
            <div className="mt-1 break-words text-sm leading-relaxed text-text-mid">
              Invites are claimed when the person signs in.
            </div>

            {bunhouseInvitesError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                {bunhouseInvitesError?.message || 'Failed to load invites.'}
              </div>
            ) : null}

            <div className="mt-4 grid gap-2">
              {bunhouseInvitesLoading ? (
                <div className="text-sm text-text-mid">Loading invites…</div>
              ) : null}

              {!bunhouseInvitesLoading && bunhouseInvites.length === 0 ? (
                <div className="text-sm text-text-mid">No pending invites.</div>
              ) : null}

              {bunhouseInvites
                .filter((i) => !i?.accepted_at)
                .map((i) => (
                  <div
                    key={i.id}
                    className="flex min-w-0 flex-col gap-3 rounded-2xl border border-lavender-mid/30 bg-warm-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-text-dark">
                        {String(i.email ?? '—')}
                      </div>
                      <div className="mt-1 truncate text-xs text-text-mid">{i.id}</div>
                    </div>
                    <button
                      type="button"
                      className={`shrink-0 self-end rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-2 text-sm font-semibold text-text-dark sm:self-auto ${
                        memberSaving ? 'opacity-60' : 'hover:brightness-95'
                      }`}
                      disabled={memberSaving || !activeBunhouseId}
                      onClick={async () => {
                        if (!activeBunhouseId) return
                        setMemberSaving(true)
                        setMemberError('')
                        try {
                          const { error: delErr } = await supabase
                            .from('bunhouse_invites')
                            .delete()
                            .eq('id', i.id)
                            .eq('bunhouse_id', activeBunhouseId)
                          if (delErr) throw delErr
                          await queryClient.invalidateQueries({
                            queryKey: ['bunhouse_invites', activeBunhouseId],
                          })
                        } catch (err) {
                          setMemberError(err?.message || 'Failed to cancel invite.')
                        } finally {
                          setMemberSaving(false)
                        }
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text-dark">Account</div>
              <div className="mt-1 text-sm text-text-mid">Manage security and access.</div>
            </div>
            <button
              type="button"
              className={`shrink-0 self-start rounded-full border border-lavender-mid/30 bg-warm-white px-3 py-2 text-sm font-semibold text-text-dark ${
                exportBusy ? 'opacity-60' : 'hover:brightness-95'
              }`}
              disabled={exportBusy || !user?.id}
              onClick={onExportAllData}
            >
              {exportBusy ? 'Preparing…' : 'Export'}
            </button>
          </div>

          {accountError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {accountError}
            </div>
          ) : null}
          {accountNotice ? (
            <div className="mt-4 rounded-2xl border border-lavender-mid/30 bg-lavender/10 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1 break-words text-sm text-text-dark">{accountNotice}</div>
                <button
                  type="button"
                  className="shrink-0 p-1 text-text-mid hover:text-text-dark"
                  onClick={() => setAccountNotice('')}
                  aria-label="Dismiss notice"
                >
                  <IconX size={16} stroke={2} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-lavender-mid/30 bg-warm-white p-4">
              <div className="text-sm font-semibold text-text-dark">Signed in as</div>
              <div className="mt-1 truncate text-sm text-text-dark">
                {user?.email ?? '—'}
              </div>
            </div>

            <div className="rounded-2xl border border-lavender-mid/30 bg-warm-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-dark">Currency</div>
                  <div className="mt-1 text-sm text-text-mid">
                    One currency per account.
                    {currencyLocked ? ' Locked after your first expense or record.' : ''}
                  </div>
                </div>

                <div className="relative sm:w-[260px]">
                  {currencyLocked ? (
                    <IconLock
                      size={16}
                      stroke={2}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light"
                      aria-hidden="true"
                    />
                  ) : null}
                  <select
                    value={currencyDraft || 'PHP'}
                    onChange={async (e) => {
                      const next = e.target.value
                      setCurrencyDraft(next)
                      if (!user?.id) return
                      if (currencyLocked) return
                      if (!next || next === currencyCode) return

                      setCurrencyError('')
                      setCurrencySaving(true)
                      try {
                        const { error: upErr } = await supabase
                          .from('profiles')
                          .update({ currency_code: next })
                          .eq('id', user.id)
                        if (upErr) throw upErr
                        await queryClient.invalidateQueries({ queryKey: ['profile', user.id] })
                      } catch (err) {
                        setCurrencyError(err?.message || 'Failed to update currency.')
                      } finally {
                        setCurrencySaving(false)
                      }
                    }}
                    className={`h-12 w-full appearance-none rounded-xl border bg-warm-white px-4 pr-10 text-[16px] outline-none focus:border-lavender sm:text-sm ${
                      currencyLocked ? 'cursor-not-allowed border-text-light/40 bg-cream pl-10 text-text-light' : 'border-lavender-mid/30'
                    }`}
                    disabled={currencySaving || !user?.id || currencyLocked}
                    aria-label="Account currency"
                  >
                    {currencyOptions.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <svg
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-mid"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z"
                      clipRule="evenodd"
                    />
                  </svg>

                  {currencySaving ? (
                    <div className="mt-2 text-sm text-text-mid">Saving…</div>
                  ) : null}
                  {currencyError ? (
                    <div className="mt-2 text-sm text-red-700">{currencyError}</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <button
          type="button"
          className="w-full rounded-full border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm font-semibold text-text-dark hover:brightness-95"
          onClick={onSignOut}
        >
          Sign out
        </button>
      </div>

      <Drawer
        title="Create your bunny’s profile"
        open={createModalOpen}
        onClose={() => {
          if (createSaving) return
          resetCreate()
          setCreateModalOpen(false)
        }}
      >
        <div className="flex h-full min-w-0 flex-col">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
            <form className="grid gap-6" onSubmit={onCreateBunny} noValidate>
            {createError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {createError}
              </div>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="text-sm font-medium text-text-dark">Profile photo</div>
                <div className="mt-3 flex items-center gap-3">
                  {createPhotoPreviewUrl ? (
                    <img
                      src={createPhotoPreviewUrl}
                      alt="New bunny profile preview"
                      className="h-12 w-12 rounded-full border border-lavender-mid/30 object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-lavender-mid/40" aria-hidden="true" />
                  )}
                  <FileInput
                    accept="image/*"
                    onChange={(e) => setCreatePhotoFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="text-sm font-medium text-text-dark">Name</div>
                <div className="mt-2">
                  <Input
                    value={createState.name}
                    onChange={(e) => {
                      const value = e.target.value
                      setCreateState((s) => ({ ...s, name: value }))
                      if (createFieldErrors.name) {
                        setCreateFieldErrors((fe) => ({ ...fe, name: '' }))
                      }
                    }}
                    placeholder="Binky"
                    autoComplete="off"
                    required
                  />
                </div>
                {createFieldErrors.name ? (
                  <div className="mt-2 text-sm text-red-700">{createFieldErrors.name}</div>
                ) : null}
              </div>

              <div>
                <div className="text-sm font-medium text-text-dark">Breed</div>
                <div className="mt-2">
                  <Input
                    value={createState.breed}
                    onChange={(e) => {
                      const value = e.target.value
                      setCreateState((s) => ({ ...s, breed: value }))
                      if (createFieldErrors.breed) {
                        setCreateFieldErrors((fe) => ({ ...fe, breed: '' }))
                      }
                    }}
                    placeholder="Holland Lop"
                    autoComplete="off"
                    required
                  />
                </div>
                {createFieldErrors.breed ? (
                  <div className="mt-2 text-sm text-red-700">{createFieldErrors.breed}</div>
                ) : null}
              </div>

              <div>
                <div className="text-sm font-medium text-text-dark">Birthday</div>
                <div className="mt-2">
                  <Input
                    type="date"
                    value={createState.date_of_birth}
                    onChange={(e) => {
                      const value = e.target.value
                      setCreateState((s) => ({ ...s, date_of_birth: value }))
                      if (createFieldErrors.date_of_birth) {
                        setCreateFieldErrors((fe) => ({ ...fe, date_of_birth: '' }))
                      }
                    }}
                    required
                  />
                </div>
                {createFieldErrors.date_of_birth ? (
                  <div className="mt-2 text-sm text-red-700">
                    {createFieldErrors.date_of_birth}
                  </div>
                ) : null}
              </div>

              <div>
                <div className="text-sm font-medium text-text-dark">Sex</div>
                <div className="mt-2">
                  <div className="flex items-center gap-4 rounded-xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm">
                    <RadioOption
                        name="create_sex"
                        value="male"
                        checked={createState.sex === 'male'}
                        onChange={(e) => {
                          const value = e.target.value
                          setCreateState((s) => ({ ...s, sex: value }))
                          if (createFieldErrors.sex) {
                            setCreateFieldErrors((fe) => ({ ...fe, sex: '' }))
                          }
                        }}
                        required
                      >
                      Male
                    </RadioOption>
                    <RadioOption
                        name="create_sex"
                        value="female"
                        checked={createState.sex === 'female'}
                        onChange={(e) => {
                          const value = e.target.value
                          setCreateState((s) => ({ ...s, sex: value }))
                          if (createFieldErrors.sex) {
                            setCreateFieldErrors((fe) => ({ ...fe, sex: '' }))
                          }
                        }}
                        required
                      >
                      Female
                    </RadioOption>
                  </div>
                </div>
                {createFieldErrors.sex ? (
                  <div className="mt-2 text-sm text-red-700">{createFieldErrors.sex}</div>
                ) : null}
              </div>

              <div>
                <div className="text-sm font-medium text-text-dark">Neutered / spayed</div>
                <div className="mt-2 flex items-center gap-4 rounded-xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm">
                  <RadioOption
                      name="create_is_neutered"
                      value="yes"
                      checked={createState.is_neutered === 'yes'}
                      onChange={(e) => {
                        const value = e.target.value
                        setCreateState((s) => ({ ...s, is_neutered: value }))
                        if (createFieldErrors.is_neutered) {
                          setCreateFieldErrors((fe) => ({ ...fe, is_neutered: '' }))
                        }
                      }}
                      required
                    >
                    Yes
                  </RadioOption>
                  <RadioOption
                      name="create_is_neutered"
                      value="no"
                      checked={createState.is_neutered === 'no'}
                      onChange={(e) => {
                        const value = e.target.value
                        setCreateState((s) => ({ ...s, is_neutered: value }))
                        if (createFieldErrors.is_neutered) {
                          setCreateFieldErrors((fe) => ({ ...fe, is_neutered: '' }))
                        }
                      }}
                      required
                    >
                    No
                  </RadioOption>
                </div>
                {createFieldErrors.is_neutered ? (
                  <div className="mt-2 text-sm text-red-700">
                    {createFieldErrors.is_neutered}
                  </div>
                ) : null}
              </div>

              <div className="sm:col-span-2">
                <FavoriteSnackSelect
                  id="create_favorite_snack"
                  value={createState.favorite_snack}
                  onChange={(v) => {
                    setCreateState((s) => ({
                      ...s,
                      favorite_snack: v,
                      favorite_snack_custom:
                        v === FAVORITE_SNACK_SELECT_OTHER ? s.favorite_snack_custom : '',
                    }))
                    if (v !== FAVORITE_SNACK_SELECT_OTHER && createFieldErrors.favorite_snack_other) {
                      setCreateFieldErrors((fe) => ({ ...fe, favorite_snack_other: '' }))
                    }
                  }}
                  customValue={createState.favorite_snack_custom}
                  onCustomChange={(v) => {
                    setCreateState((s) => ({ ...s, favorite_snack_custom: v }))
                    if (createFieldErrors.favorite_snack_other) {
                      setCreateFieldErrors((fe) => ({ ...fe, favorite_snack_other: '' }))
                    }
                  }}
                  otherError={createFieldErrors.favorite_snack_other}
                />
              </div>
              <div className="sm:col-span-2">
                <FavoriteHangoutSelect
                  id="create_favorite_hangout"
                  value={createState.favorite_hangout}
                  onChange={(v) => setCreateState((s) => ({ ...s, favorite_hangout: v }))}
                />
              </div>
            </div>

            <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
          </form>
          </div>

          <div className="shrink-0 border-t border-lavender-mid/30 bg-warm-white p-5">
            <Button
              className={`w-full ${createSaving ? 'opacity-60' : 'hover:brightness-95'}`}
              disabled={createSaving}
              type="button"
              onClick={(e) => onCreateBunny(e)}
            >
              {createSaving ? 'Creating…' : 'Create your bunny’s profile'}
            </Button>
          </div>
        </div>
      </Drawer>

      <Drawer
        title="Edit bunny profile"
        open={editModalOpen}
        onClose={() => {
          if (editSaving) return
          resetEdit()
          setEditModalOpen(false)
        }}
      >
        <div className="flex h-full min-w-0 flex-col">
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
            {editError ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            ) : null}

            <form className="grid gap-6" onSubmit={onSaveBunny} noValidate>
              <div>
                <div className="text-sm font-medium text-text-dark">Profile photo</div>
                <div className="mt-3 flex items-center gap-3">
                  {editPhotoPreviewUrl || editPhotoSignedUrl ? (
                    <img
                      src={editPhotoPreviewUrl || editPhotoSignedUrl}
                      alt={`${editTarget.name} profile`}
                      className="h-12 w-12 rounded-full border border-lavender-mid/30 object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-lavender-mid/40" aria-hidden="true" />
                  )}
                  <FileInput
                    accept="image/*"
                    onChange={(e) => setEditPhotoFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <div className="text-sm font-medium text-text-dark">Name</div>
                  <div className="mt-2">
                    <Input
                      value={editState.name}
                      onChange={(e) => setEditState((s) => ({ ...s, name: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-text-dark">Breed</div>
                  <div className="mt-2">
                    <Input
                      value={editState.breed}
                      onChange={(e) => setEditState((s) => ({ ...s, breed: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-text-dark">Birthday</div>
                  <div className="mt-2">
                    <Input
                      type="date"
                      value={editState.date_of_birth}
                      onChange={(e) =>
                        setEditState((s) => ({ ...s, date_of_birth: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-text-dark">Sex</div>
                  <div className="mt-2">
                    <div className="flex items-center gap-4 rounded-xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm">
                      <RadioOption
                          name="edit_sex"
                          value="male"
                          checked={editState.sex === 'male'}
                          onChange={(e) => setEditState((s) => ({ ...s, sex: e.target.value }))}
                          required
                        >
                        Male
                      </RadioOption>
                      <RadioOption
                          name="edit_sex"
                          value="female"
                          checked={editState.sex === 'female'}
                          onChange={(e) => setEditState((s) => ({ ...s, sex: e.target.value }))}
                          required
                        >
                        Female
                      </RadioOption>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-sm font-medium text-text-dark">Neutered / spayed</div>
                  <div className="mt-2 flex items-center gap-4 rounded-xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm">
                    <RadioOption
                        name="edit_is_neutered"
                        value="yes"
                        checked={editState.is_neutered === 'yes'}
                        onChange={(e) =>
                          setEditState((s) => ({ ...s, is_neutered: e.target.value }))
                        }
                        required
                      >
                      Yes
                    </RadioOption>
                    <RadioOption
                        name="edit_is_neutered"
                        value="no"
                        checked={editState.is_neutered === 'no'}
                        onChange={(e) =>
                          setEditState((s) => ({ ...s, is_neutered: e.target.value }))
                        }
                        required
                      >
                      No
                    </RadioOption>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <FavoriteSnackSelect
                    id="edit_favorite_snack"
                    value={editState.favorite_snack}
                    onChange={(v) => {
                      setEditState((s) => ({
                        ...s,
                        favorite_snack: v,
                        favorite_snack_custom:
                          v === FAVORITE_SNACK_SELECT_OTHER ? s.favorite_snack_custom : '',
                      }))
                      if (v !== FAVORITE_SNACK_SELECT_OTHER && editSnackOtherError) {
                        setEditSnackOtherError('')
                      }
                    }}
                    customValue={editState.favorite_snack_custom}
                    onCustomChange={(v) => {
                      setEditState((s) => ({ ...s, favorite_snack_custom: v }))
                      if (editSnackOtherError) setEditSnackOtherError('')
                    }}
                    otherError={editSnackOtherError}
                  />
                </div>
                <div className="sm:col-span-2">
                  <FavoriteHangoutSelect
                    id="edit_favorite_hangout"
                    value={editState.favorite_hangout}
                    onChange={(v) => setEditState((s) => ({ ...s, favorite_hangout: v }))}
                  />
                </div>
              </div>

              <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
            </form>
          </div>

          <div className="shrink-0 border-t border-lavender-mid/30 bg-warm-white p-5">
            <button
              type="button"
              className="mb-3 w-full rounded-full border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:brightness-95"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={editSaving || deleteBusy}
            >
              Delete bunny
            </button>
            <Button
              className={`w-full ${editSaving ? 'opacity-60' : 'hover:brightness-95'}`}
              disabled={editSaving}
              type="button"
              onClick={(e) => onSaveBunny(e)}
            >
              {editSaving ? 'Saving…' : 'Save bunny'}
            </Button>
          </div>
        </div>
      </Drawer>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete bunny?"
        description="This will permanently delete this bunny profile and all associated records (symptoms, weights, expenses, medical records, prescriptions). This cannot be undone."
        confirmText="Delete permanently"
        cancelText="Cancel"
        danger
        busy={deleteBusy}
        onClose={() => {
          if (deleteBusy) return
          setDeleteConfirmOpen(false)
        }}
        onConfirm={onDeleteBunny}
      />
    </main>
  )
}

