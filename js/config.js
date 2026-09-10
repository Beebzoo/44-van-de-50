/* The Supabase project used for syncing between phone and computer.

   The anon key is public by design: it only lets a request through to
   the row-level policy, which returns nothing without the right
   x-learner header. The koppelcode in that header is the secret and it
   lives only on Martijn's devices. Fill these two in once the project
   exists (Phase 1); until then the app runs local-only. */
export const SUPABASE_URL = "https://bgxirhzdcntzmtvywmxf.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJneGlyaHpkY250em10dnl3bXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwNTgxNTYsImV4cCI6MjEwNDYzNDE1Nn0.B7rYiWCShd4tmY9yZ-rnH3xdl8kxO56oiChTsLw7bXw";
