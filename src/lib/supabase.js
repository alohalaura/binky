import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      // PKCE stores a code_verifier in localStorage; after the Google redirect it is often
      // missing (www vs non-www, mobile/PWA, Safari, ITP), which breaks sign-in with
      // "PKCE code verifier not found". Implicit flow returns tokens in the URL hash instead;
      // no verifier is required—better fit for this static Vite app without @supabase/ssr.
      flowType: 'implicit',
      detectSessionInUrl: true,
      persistSession: true,
    },
  },
)

