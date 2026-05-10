import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { useBunny } from './useBunny'
import { supabase } from '../lib/supabase'

const SYMPTOM_MEDIA_BUCKET = 'symptom-media'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

async function fetchSymptoms({ bunnyId }) {
  const { data, error } = await supabase
    .from('symptom_logs')
    .select(
      'id, bunny_id, logged_at, observed_since, body_area, symptom_type, severity, notes, media_urls',
    )
    .eq('bunny_id', bunnyId)
    .order('logged_at', { ascending: false })

  if (error) throw error

  const rows = data ?? []
  const withSigned = await Promise.all(
    rows.map(async (row) => {
      const media = Array.isArray(row.media_urls) ? row.media_urls : []
      const pairs = await Promise.all(
        media.map(async (value) => {
          if (!value || typeof value !== 'string') return null
          if (value.startsWith('http://') || value.startsWith('https://')) {
            return { path: null, url: value }
          }

          const { data: signed, error: signedError } = await supabase.storage
            .from(SYMPTOM_MEDIA_BUCKET)
            .createSignedUrl(value, SIGNED_URL_TTL_SECONDS)
          if (signedError) return null
          const url = signed?.signedUrl ?? null
          if (!url) return null
          return { path: value, url }
        }),
      )

      const media_attachments = pairs.filter(Boolean)
      const media_links = media_attachments.map((p) => p.url)

      return {
        ...row,
        media_attachments,
        media_links,
      }
    }),
  )

  return withSigned
}

export function useSymptoms() {
  const { user } = useAuth()
  const { activeBunnyId } = useBunny()

  return useQuery({
    queryKey: ['symptom_logs', user?.id ?? null, activeBunnyId ?? null],
    queryFn: () => fetchSymptoms({ bunnyId: activeBunnyId }),
    enabled: Boolean(user?.id && activeBunnyId),
  })
}

