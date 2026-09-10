/* The Supabase project used for syncing between phone and computer.

   The anon key is public by design: it only lets a request through to
   the row-level policy, which returns nothing without the right
   x-learner header. The koppelcode in that header is the secret and it
   lives only on Martijn's devices. Fill these two in once the project
   exists (Phase 1); until then the app runs local-only. */
export const SUPABASE_URL = "";
export const SUPABASE_ANON_KEY = "";
