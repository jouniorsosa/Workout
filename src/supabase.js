import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vistryrzgwchqzzkdboy.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpc3R5cnl6Z3djaHF6emtkYm95Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTEzMDksImV4cCI6MjA5MDMyNzMwOX0.8C0RrTxm-fdDaGUZc8OqxoLnCvusaBpRfgWJ67cfLQg'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function signInWithEmail(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin }
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}
