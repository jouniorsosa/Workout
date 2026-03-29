/**
 * DB layer — mirrors localStorage API but syncs to Supabase when logged in.
 * Writes are instant (localStorage), Supabase sync happens async in background.
 * On login, all cloud data is pulled down and applied to the UI.
 */

import { supabase, getCurrentUser } from './supabase.js'

// ── Sync helpers ──────────────────────────────────────────────────────────────

async function pushToCloud(key, value) {
  const user = await getCurrentUser()
  if (!user) return { ok: false, reason: 'Not logged in' }
  const { error } = await supabase.from('user_data').upsert({
    user_id: user.id,
    key,
    value: String(value),
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,key' })
  if (error) {
    return { ok: false, reason: error.message || error.code || 'Unknown error' }
  }
  return { ok: true }
}

async function deleteFromCloud(key) {
  const user = await getCurrentUser()
  if (!user) return
  const { error } = await supabase.from('user_data')
    .delete()
    .eq('user_id', user.id)
    .eq('key', key)
  if (error) console.error('[DB] deleteFromCloud failed:', key, error.message)
}

// ── Public API (drop-in localStorage replacement) ─────────────────────────────

export function setItem(key, value) {
  localStorage.setItem(key, value)
  pushToCloud(key, value) // async, fire-and-forget
}

/** Like setItem but awaits cloud sync — returns { ok, reason } */
export async function setItemSync(key, value) {
  localStorage.setItem(key, value)
  return pushToCloud(key, value)
}

export function getItem(key) {
  return localStorage.getItem(key)
}

export function removeItem(key) {
  localStorage.removeItem(key)
  deleteFromCloud(key) // async, fire-and-forget
}

// ── Load all cloud data into localStorage and refresh UI ──────────────────────

export async function loadFromCloud(onLoaded) {
  const user = await getCurrentUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('user_data')
    .select('key, value')
    .eq('user_id', user.id)

  if (error) {
    console.error('[DB] loadFromCloud failed:', error.message)
    return false
  }
  if (!data || data.length === 0) {
    console.log('[DB] loadFromCloud: no data in cloud for this user')
    return false
  }

  console.log('[DB] loadFromCloud: loaded', data.length, 'keys from cloud')
  data.forEach(({ key, value }) => localStorage.setItem(key, value))

  if (onLoaded) onLoaded()
  return true
}

// ── Auth state change listener ────────────────────────────────────────────────

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session?.user ?? null)
  })
}
