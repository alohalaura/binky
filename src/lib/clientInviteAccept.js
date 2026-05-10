import { supabase } from './supabase'
import { ensureProfileExists } from './authProfile'

/**
 * Client-side mop-up for pending bunhouse invites (runs after RPC).
 * Safe when invites are already consumed: selects only rows with accepted_at null.
 */
export async function sweepPendingBunhouseInvitesClient({ cancelled, uid, session, user }) {
  const email = user?.email ? String(user.email).trim().toLowerCase() : ''
  if (!uid || !session?.user?.id || !email || cancelled) return

  await ensureProfileExists(user ?? session.user)

  const { data: rawInvites, error } = await supabase
    .from('bunhouse_invites')
    .select('id, bunhouse_id, email, accepted_at')
    .is('accepted_at', null)

  if (cancelled || error || !Array.isArray(rawInvites) || rawInvites.length === 0) return

  const invites = rawInvites.filter(
    (row) =>
      typeof row?.email === 'string' &&
      String(row.email).trim().toLowerCase() === email,
  )

  if (invites.length === 0) return

  for (const inv of invites) {
    if (!inv?.bunhouse_id || !inv?.id) continue

    const { error: memberErr } = await supabase
      .from('bunhouse_members')
      .insert({ bunhouse_id: inv.bunhouse_id, user_id: session.user.id })
    const dupMember =
      memberErr?.code === '23505' ||
      String(memberErr?.message ?? '')
        .toLowerCase()
        .includes('duplicate key')
    if (memberErr && !dupMember) continue

    await supabase
      .from('bunhouse_invites')
      .update({ accepted_at: new Date().toISOString(), accepted_by: session.user.id })
      .eq('id', inv.id)
  }
}
