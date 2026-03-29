// Vercel Serverless Function — generates exercises for ONE day with a specific equipment type
// POST /api/generate-day  { profile, focus, equipment, phase }
// Returns JSON: { exercises: [...] }

const Anthropic = require('@anthropic-ai/sdk')

function buildPrompt(profile, focus, equipment, phase) {
  const equipmentDesc = {
    gym:        'full gym equipment — barbells, cables, machines, dumbbells, pull-up bar, all available',
    bodyweight: 'bodyweight ONLY — zero equipment. Calisthenics movements: push-ups, pull-ups, dips, bodyweight squats, lunges, planks, burpees, mountain climbers, etc. NO weights of any kind.',
    dumbbells:  'dumbbells ONLY — no barbells, no cables, no machines. Only two dumbbells.'
  }

  const goalLabels = {
    'fat-loss':  'Fat Loss (higher reps, shorter rest)',
    'muscle':    'Build Muscle (moderate reps, compound focus)',
    'recomp':    'Body Recomp (balanced volume)',
    'endurance': 'Endurance (high reps, circuit style)',
    'strength':  'Raw Strength (lower reps, heavy load)',
    'general':   'General Fitness (balanced)'
  }

  const levelNotes = {
    beginner:     '4-5 exercises. Simple movement patterns. Clear beginner-friendly form cues.',
    intermediate: '5-6 exercises. Mix of compound and isolation. Standard gym movements.',
    advanced:     '6-7 exercises. Complex movements allowed. Intensity techniques in notes (supersets, drop sets).'
  }

  const femaleNote = profile.sex === 'female'
    ? '\nFor female athlete: Prioritize glutes/posterior chain where applicable. Upper body can use higher rep ranges.'
    : ''

  const ageNote = parseInt(profile.age) >= 50
    ? '\nFor 50+ athlete: Include joint-friendly alternatives in notes, suggest longer rest if needed.'
    : ''

  return `Generate a workout for ONE training session.

SESSION FOCUS: ${focus}
PROGRAM PHASE: ${phase || 'Foundation'}
EQUIPMENT RESTRICTION: ${equipmentDesc[equipment] || equipmentDesc.gym}

USER:
- Sex: ${profile.sex}, Age: ${profile.age}, Weight: ${profile.weight} lbs
- Level: ${profile.fitnessLevel} — ${levelNotes[profile.fitnessLevel] || levelNotes.intermediate}
- Goal: ${goalLabels[profile.goal] || profile.goal}
${femaleNote}${ageNote}

STRICT RULES:
- Use ONLY the allowed equipment: ${equipmentDesc[equipment] || equipmentDesc.gym}
- Target the muscle groups in the SESSION FOCUS above
- Every exercise needs: name, sets (integer), reps (string like "12" or "10-12"), rest (string like "60s"), notes (one specific form cue)
- Make sure exercises actually work with the equipment restriction — NO exceptions

Return ONLY valid JSON, no markdown, no text outside the JSON:
{"exercises":[{"name":"Push-Ups","sets":3,"reps":"15","rest":"60s","notes":"Keep core tight, chest to floor"}]}`
}

function extractJSON(text) {
  let s = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  const start = s.indexOf('{')
  const end = s.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) s = s.slice(start, end + 1)
  return s
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const { profile, focus, equipment, phase } = req.body || {}
  if (!profile || !focus || !equipment) {
    return res.status(400).json({ error: 'profile, focus, and equipment are required' })
  }

  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt(profile, focus, equipment, phase) }]
    })

    const raw = message.content[0].text.trim()
    const data = JSON.parse(extractJSON(raw))

    if (!data.exercises || !Array.isArray(data.exercises) || data.exercises.length === 0) {
      return res.status(500).json({ error: 'AI returned no exercises' })
    }

    return res.status(200).json(data)
  } catch (err) {
    console.error('[generate-day]', err.message)
    return res.status(500).json({ error: err.message || 'Generation failed' })
  }
}
