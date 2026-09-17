// ==============================================
// Supabase Client (Client Components)
// ==============================================

import { createBrowserClient } from '@supabase/ssr';

const DEFAULT_SUPABASE_URL = 'https://cnezekhsnitmhptzlfys.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuZXpla2hzbml0bWhwdHpsZnlzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0OTU0NjgsImV4cCI6MjEwNTA3MTQ2OH0.ya9x8i5dJKo1ntrTMhhWe5rbBOcnke_8ZIgfHL9xOMs';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY
  );
}
