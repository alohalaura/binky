import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { useBunnies } from '../hooks/useBunnies'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { supabase } from '../lib/supabase'
import { STORAGE_BUCKETS } from '../lib/storageBuckets'
import {
  bunnyAgeLabel,
  estimatedHumanAgeYears,
  safeDateLabel,
} from '../lib/bunnyPresentation.js'
import { labelForFavoriteHangout, labelForFavoriteSnack } from '../lib/bunnyProfileExtras'
import { toSentenceCase } from '../lib/text'
import { IconArrowLeft } from '@tabler/icons-react'

const BUNNY_PROFILE_BUCKET = STORAGE_BUCKETS.bunnyProfilePhotos
const SIGNED_URL_TTL_SECONDS = 60 * 60

function Field({ label, children }) {
  return (
    <div className="border-b border-lavender-mid/20 py-3 last:border-b-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-mid">{label}</div>
      <div className="mt-1 text-sm font-semibold text-text-dark">{children}</div>
    </div>
  )
}

function sexLabel(sex) {
  if (!sex || typeof sex !== 'string') return '—'
  const s = sex.trim().toLowerCase()
  if (s === 'male' || s === 'female') return toSentenceCase(s)
  return toSentenceCase(sex)
}

function neuteredLabel(isNeutered) {
  if (isNeutered === true) return 'Yes'
  if (isNeutered === false) return 'No'
  return '—'
}

export function BunnyProfile() {
  const { bunnyId } = useParams()
  const navigate = useNavigate()
  const { data: bunnies = [], isLoading, error } = useBunnies()
  const bunny = useMemo(
    () => (bunnyId ? bunnies.find((b) => b.id === bunnyId) ?? null : null),
    [bunnies, bunnyId],
  )

  const [photoUrl, setPhotoUrl] = useState('')

  useEffect(() => {
    let active = true
    async function run() {
      const value = bunny?.photo_url
      if (!value || typeof value !== 'string') {
        if (active) setPhotoUrl('')
        return
      }
      const trimmed = value.trim()
      if (!trimmed) {
        if (active) setPhotoUrl('')
        return
      }
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        if (active) setPhotoUrl(trimmed)
        return
      }
      const { data, error } = await supabase.storage
        .from(BUNNY_PROFILE_BUCKET)
        .createSignedUrl(trimmed, SIGNED_URL_TTL_SECONDS)
      if (!active) return
      if (error) {
        setPhotoUrl('')
        return
      }
      setPhotoUrl(data?.signedUrl ?? '')
    }
    run()
    return () => {
      active = false
    }
  }, [bunny?.photo_url])

  if (!bunnyId) {
    return <Navigate to="/settings" replace />
  }

  if (error) {
    return (
      <main>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error.message}
        </div>
      </main>
    )
  }

  if (!isLoading && !bunny) {
    return <Navigate to="/settings" replace />
  }

  if (!bunny) {
    return (
      <main>
        <p className="text-sm text-text-mid">Loading…</p>
      </main>
    )
  }

  const humanApprox = estimatedHumanAgeYears(bunny.date_of_birth)

  return (
    <main>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-lavender-dark hover:text-lavender"
        >
          <IconArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
          Settings
        </Link>
      </div>

      <Card className="overflow-hidden !p-0 sm:!p-5 sm:overflow-visible">
        <div className="flex flex-wrap items-start justify-between gap-3 gap-y-4 border-b border-lavender-mid/20 px-5 pt-5 pb-4 sm:border-0 sm:px-0 sm:pb-6 sm:pt-0">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-semibold text-text-dark">
              {bunny.name?.trim() || 'Unnamed bunny'}
            </h1>
            <p className="mt-1 text-sm font-semibold text-text-mid">
              {bunny.breed?.trim() || '—'}
            </p>
          </div>
          <Button
            type="button"
            className="ml-auto shrink-0 hover:brightness-95"
            onClick={() => navigate('/settings', { state: { editBunnyId: bunny.id } })}
          >
            Edit profile
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6">
          <div className="px-5 sm:px-0">
            <div className="aspect-square w-full overflow-hidden rounded-2xl border border-lavender-mid/30 bg-warm-white sm:aspect-auto sm:h-36 sm:w-36 sm:shrink-0 sm:rounded-3xl">
              {photoUrl ? (
                <img
                  src={photoUrl}
                  alt={bunny.name?.trim() ? `${bunny.name.trim()} photo` : 'Bunny photo'}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-4 text-center text-sm font-semibold text-text-mid">
                  No photo yet
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 px-5 pb-5 pt-6 sm:px-0 sm:pb-0 sm:pt-0">
          <Field label="Birthday">{safeDateLabel(bunny.date_of_birth)}</Field>
          <div className="border-b border-lavender-mid/20 py-3 last:border-b-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-mid">Age</div>
            <div className="mt-1 text-sm font-semibold text-text-dark">
              {bunnyAgeLabel(bunny.date_of_birth)}
            </div>
            {humanApprox != null ? (
              <div className="mt-1 text-xs font-normal text-text-mid">
                Human age estimate: ~{humanApprox} years
              </div>
            ) : null}
          </div>
          <Field label="Sex">{sexLabel(bunny.sex)}</Field>
          <Field label="Spayed / neutered">{neuteredLabel(bunny.is_neutered)}</Field>
          <Field label="Favorite snack">
            {labelForFavoriteSnack(bunny.favorite_snack) || '—'}
          </Field>
          <Field label="Favorite hangout">
            {labelForFavoriteHangout(bunny.favorite_hangout) || '—'}
          </Field>
          {bunny.created_at ? (
            <Field label="Profile created">
              {(() => {
                try {
                  return format(new Date(bunny.created_at), 'MMM d, yyyy')
                } catch {
                  return '—'
                }
              })()}
            </Field>
            ) : null}
          </div>
        </div>
      </Card>
    </main>
  )
}
