import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      // Must match hosted OAuth: PKCE uses ?code= + localStorage verifier.
      // Default library option is still "implicit"; mismatch looks like "login does nothing".
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
    },
  },
)

