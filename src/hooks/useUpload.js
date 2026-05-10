import { supabase } from '../lib/supabase'

function isBucketNotFound(err) {
  const msg = String(err?.message ?? '')
  return msg.toLowerCase().includes('bucket not found')
}

function isRlsBlocked(err) {
  const msg = String(err?.message ?? '')
  return /row-level security/i.test(msg)
}

export function useUpload() {
  const uploadFile = async ({ bucket, path, file, options } = {}) => {
    if (!bucket) throw new Error('bucket is required')
    if (!path) throw new Error('path is required')
    if (!file) throw new Error('file is required')

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      ...(options ?? {}),
    })

    if (error) {
      if (isBucketNotFound(error)) {
        throw new Error(
          `Storage bucket "${bucket}" was not found. Create it in Supabase Storage (or set VITE_BUNNY_PROFILE_BUCKET / other VITE_*_BUCKET env vars to an existing bucket).`,
        )
      }
      if (isRlsBlocked(error)) {
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
      throw error
    }
    // For private buckets, callers should store `path` and use signed URLs for display.
    return path
  }

  return { uploadFile }
}

