import { supabase } from './supabase'

/** Ensures public.profiles has a row (FK target for bunhouse_members, bunhouse_invites.accepted_by, etc.). */
export async function ensureProfileExists(user) {
  if (!user?.id) return
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
