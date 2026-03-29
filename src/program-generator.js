/**
 * Client-side program generation module.
 * Calls /api/generate-program, caches result in localStorage + Supabase.
 */

import { setItemSync, getItem } from './db.js'

const PROGRAM_KEY = 'customProgram'
const FINGERPRINT_KEY = 'customProgramFingerprint'

/**
 * Call the serverless function to generate a personalized program.
 * Stores the result in localStorage + Supabase and returns the program object.
 * Throws on failure.
 */
export async function generateProgram(profile) {
  const res = await fetch('/api/generate-program', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile })
  })

  if (!res.ok) {
    let errMsg = 'Generation failed (' + res.status + ')'
    try {
      const err = await res.json()
      if (err.error) errMsg = err.error
    } catch (_) { /* ignore */ }
    throw new Error(errMsg)
  }

  const program = await res.json()

  if (!program.phases || !Array.isArray(program.phases)) {
    throw new Error('Invalid program structure returned by AI')
  }

  // Persist program and the fingerprint that generated it
  await setItemSync(PROGRAM_KEY, JSON.stringify(program))
  setItemSync(FINGERPRINT_KEY, JSON.stringify({
    fitnessLevel: profile.fitnessLevel,
    goal: profile.goal,
    sex: profile.sex,
    age: String(profile.age)
  }))

  return program
}

/**
 * Return the stored custom program (from localStorage), or null if none.
 */
export function getStoredProgram() {
  try {
    const raw = getItem(PROGRAM_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

/**
 * Returns true if any of the key profile fields that affect exercise selection
 * have changed since the last program was generated.
 */
export function profileChanged(currentProfile) {
  try {
    const raw = getItem(FINGERPRINT_KEY)
    if (!raw) return true
    const saved = JSON.parse(raw)
    return ['fitnessLevel', 'goal', 'sex', 'age'].some(
      k => String(saved[k]) !== String(currentProfile[k])
    )
  } catch (_) {
    return true
  }
}
