import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/authContext'
import { useBunny } from '../hooks/useBunny'
import { useBunhouse } from '../hooks/useBunhouse'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { FileInput } from '../components/ui/FileInput'
import { RadioOption } from '../components/ui/RadioOption'
import {
  FavoriteHangoutSelect,
  FavoriteSnackSelect,
} from '../components/bunny/BunnyProfileExtraSelects'
import { FAVORITE_SNACK_SELECT_OTHER } from '../lib/bunnyProfileExtras'
import { STORAGE_BUCKETS } from '../lib/storageBuckets'
import { ensureProfileExists } from '../lib/authProfile'

function isBucketNotFound(err) {
  const msg = String(err?.message ?? '')
  return msg.toLowerCase().includes('bucket not found')
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

export function Onboarding() {
  const { user } = useAuth()
  const { setActiveBunnyId } = useBunny()
  const { setActiveBunhouseId } = useBunhouse()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const [state, setState] = useState({
    name: '',
    breed: '',
    date_of_birth: '',
    sex: '',
    is_neutered: '',
    favorite_snack: '',
    favorite_snack_custom: '',
    favorite_hangout: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [photoFile, setPhotoFile] = useState(null)

  const validation = useMemo(() => {
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
  }, [state])

  async function onCreate(e) {
    e.preventDefault()
    if (!user?.id) return

    setError('')
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
        state.is_neutered === 'yes' || state.is_neutered === 'no'
          ? ''
          : 'Please choose yes or no.',
      favorite_snack_other: validation.snackOtherError || '',
    }
    setFieldErrors(nextFieldErrors)

    const hasErrors = Object.values(nextFieldErrors).some(Boolean)
    if (hasErrors) return

    setSaving(true)
    try {
      await ensureProfileExists(user)

      const bunhouseId = await ensureDefaultBunhouse({ userId: user.id })
      setActiveBunhouseId(bunhouseId)

      const payload = {
        bunhouse_id: bunhouseId,
        ...validation.payload,
      }

      const { data, error: insertError } = await supabase
        .from('bunnies')
        .insert(payload)
        .select(
          'id, bunhouse_id, owner_id, name, breed, date_of_birth, sex, is_neutered, favorite_snack, favorite_hangout, photo_url, created_at',
        )
        .single()

      if (insertError) throw insertError

      if (photoFile) {
        const path = `${bunhouseId}/${data.id}/profile.jpg`
        const bucket = STORAGE_BUCKETS.bunnyProfilePhotos
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(path, photoFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: photoFile.type || 'image/jpeg',
          })
        if (uploadError) {
          if (isBucketNotFound(uploadError)) {
            throw new Error(`Storage bucket "${bucket}" was not found. Create it in Supabase Storage.`)
          }
          throw uploadError
        }

        const { error: photoUpdateError } = await supabase
          .from('bunnies')
          .update({ photo_url: path })
          .eq('id', data.id)
        if (photoUpdateError) throw photoUpdateError
      }

      await queryClient.invalidateQueries({
        queryKey: ['bunnies', user.id, bunhouseId],
      })
      setActiveBunnyId(data.id)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message || 'Failed to create bunny')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main>
      <h1 className="font-display text-2xl font-semibold text-text-dark">
        Welcome to Binky Labs
      </h1>
      <p className="mt-2 text-sm text-text-mid">
        Let’s set up your first bunny profile.
      </p>

      <Card className="mt-6">
        <div className="text-lg font-semibold">Create your bunny’s profile</div>

        <form className="mt-4 grid gap-3" onSubmit={onCreate} noValidate>
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div>
            <div className="text-sm font-medium text-text-dark">Profile photo</div>
            <div className="mt-1">
              <FileInput
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          <div>
            <div className="text-sm font-medium text-text-dark">Name</div>
            <div className="mt-1">
              <Input
                value={state.name}
                onChange={(e) => {
                  const value = e.target.value
                  setState((s) => ({ ...s, name: value }))
                  if (fieldErrors.name) {
                    setFieldErrors((fe) => ({ ...fe, name: '' }))
                  }
                }}
                placeholder="Binky"
                autoComplete="off"
                required
              />
            </div>
            {fieldErrors.name ? (
              <div className="mt-2 text-sm text-red-700">{fieldErrors.name}</div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium text-text-dark">Breed</div>
              <div className="mt-1">
                <Input
                  value={state.breed}
                  onChange={(e) => {
                    const value = e.target.value
                    setState((s) => ({ ...s, breed: value }))
                    if (fieldErrors.breed) {
                      setFieldErrors((fe) => ({ ...fe, breed: '' }))
                    }
                  }}
                  placeholder="Holland Lop"
                  autoComplete="off"
                  required
                />
              </div>
              {fieldErrors.breed ? (
                <div className="mt-2 text-sm text-red-700">{fieldErrors.breed}</div>
              ) : null}
            </div>

            <div>
              <div className="text-sm font-medium text-text-dark">Birthday</div>
              <div className="mt-1">
                <Input
                  type="date"
                  value={state.date_of_birth}
                  onChange={(e) => {
                    const value = e.target.value
                    setState((s) => ({ ...s, date_of_birth: value }))
                    if (fieldErrors.date_of_birth) {
                      setFieldErrors((fe) => ({ ...fe, date_of_birth: '' }))
                    }
                  }}
                  required
                />
              </div>
              {fieldErrors.date_of_birth ? (
                <div className="mt-2 text-sm text-red-700">
                  {fieldErrors.date_of_birth}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium text-text-dark">Sex</div>
              <div className="mt-1">
                <div className="flex items-center gap-4 rounded-xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm">
                  <RadioOption
                      name="sex"
                      value="male"
                      checked={state.sex === 'male'}
                      onChange={(e) => {
                        const value = e.target.value
                        setState((s) => ({ ...s, sex: value }))
                        if (fieldErrors.sex) {
                          setFieldErrors((fe) => ({ ...fe, sex: '' }))
                        }
                      }}
                      required
                    >
                    Male
                  </RadioOption>
                  <RadioOption
                      name="sex"
                      value="female"
                      checked={state.sex === 'female'}
                      onChange={(e) => {
                        const value = e.target.value
                        setState((s) => ({ ...s, sex: value }))
                        if (fieldErrors.sex) {
                          setFieldErrors((fe) => ({ ...fe, sex: '' }))
                        }
                      }}
                      required
                    >
                    Female
                  </RadioOption>
                </div>
              </div>
              {fieldErrors.sex ? (
                <div className="mt-2 text-sm text-red-700">{fieldErrors.sex}</div>
              ) : null}
            </div>

            <div>
              <div className="text-sm font-medium text-text-dark">
                Neutered / spayed
              </div>
              <div className="mt-1 flex items-center gap-4 rounded-xl border border-lavender-mid/30 bg-warm-white px-4 py-3 text-sm">
                <RadioOption
                    name="is_neutered"
                    value="yes"
                    checked={state.is_neutered === 'yes'}
                    onChange={(e) => {
                      const value = e.target.value
                      setState((s) => ({ ...s, is_neutered: value }))
                      if (fieldErrors.is_neutered) {
                        setFieldErrors((fe) => ({ ...fe, is_neutered: '' }))
                      }
                    }}
                    required
                  >
                  Yes
                </RadioOption>
                <RadioOption
                    name="is_neutered"
                    value="no"
                    checked={state.is_neutered === 'no'}
                    onChange={(e) => {
                      const value = e.target.value
                      setState((s) => ({ ...s, is_neutered: value }))
                      if (fieldErrors.is_neutered) {
                        setFieldErrors((fe) => ({ ...fe, is_neutered: '' }))
                      }
                    }}
                    required
                  >
                  No
                </RadioOption>
              </div>
              {fieldErrors.is_neutered ? (
                <div className="mt-2 text-sm text-red-700">
                  {fieldErrors.is_neutered}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FavoriteSnackSelect
                id="onboard_favorite_snack"
                value={state.favorite_snack}
                onChange={(v) => {
                  setState((s) => ({
                    ...s,
                    favorite_snack: v,
                    favorite_snack_custom:
                      v === FAVORITE_SNACK_SELECT_OTHER ? s.favorite_snack_custom : '',
                  }))
                  if (v !== FAVORITE_SNACK_SELECT_OTHER && fieldErrors.favorite_snack_other) {
                    setFieldErrors((fe) => ({ ...fe, favorite_snack_other: '' }))
                  }
                }}
                customValue={state.favorite_snack_custom}
                onCustomChange={(v) => {
                  setState((s) => ({ ...s, favorite_snack_custom: v }))
                  if (fieldErrors.favorite_snack_other) {
                    setFieldErrors((fe) => ({ ...fe, favorite_snack_other: '' }))
                  }
                }}
                otherError={fieldErrors.favorite_snack_other}
              />
            </div>
            <div className="sm:col-span-2">
              <FavoriteHangoutSelect
                id="onboard_favorite_hangout"
                value={state.favorite_hangout}
                onChange={(v) => setState((s) => ({ ...s, favorite_hangout: v }))}
              />
            </div>
          </div>

          <Button className="w-full" disabled={saving} type="submit">
            {saving ? 'Creating…' : 'Create your bunny’s profile'}
          </Button>
        </form>
      </Card>
    </main>
  )
}

