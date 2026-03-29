// Vercel Serverless Function — proxies Anthropic API to keep API key server-side
// POST /api/generate-program  { profile: {...} }
// Returns JSON: { phases: [ { phaseNum, phaseName, days: { mon, tue, ... } } ] }

const Anthropic = require('@anthropic-ai/sdk')

function buildPrompt(p) {
  const goalLabels = {
    'fat-loss': 'Fat Loss (burn fat, preserve muscle)',
    'muscle': 'Build Muscle (lean bulk, gain strength)',
    'recomp': 'Body Recomposition (lose fat, gain muscle simultaneously)',
    'endurance': 'Endurance (cardio & stamina focus)',
    'strength': 'Raw Strength (powerlifting-style gains)',
    'general': 'General Fitness (overall health & fitness)'
  }
  const activityLabels = {
    '1.375': 'Light (1-2 days/week)',
    '1.55': 'Moderate (3-5 days/week)',
    '1.725': 'Active (6-7 days/week)',
    '1.9': 'Very Active (2x/day)'
  }

  const levelRules = {
    beginner: 'Use dumbbell and machine exercises. Avoid barbell except for goblet squat and simple movements. 4-5 exercises per day. Higher reps (12-15). Simple compound movements with clear form cues.',
    intermediate: 'Mix of barbell, dumbbell, and cable exercises. 5-6 exercises per day. Moderate reps (8-12). Standard compound + isolation split.',
    advanced: 'Free weights dominant. 6-7 exercises per day. Moderate-lower reps (6-10) for compounds. Include advanced movements and intensity techniques.'
  }

  const goalRules = {
    'fat-loss': 'Higher reps (12-15), shorter rest (45-75s for isolation, 75-90s for compounds), include supersets in notes where appropriate.',
    'muscle': 'Moderate reps (8-12), standard rest (75-120s), heavy compound lifts paired with isolation finishers.',
    'strength': 'Lower reps (3-6) for main compound lifts, long rest (2-4 min), powerlifting movements (squat, bench, deadlift). Accessory work at 8-12 reps.',
    'endurance': 'High reps (15-20), shorter rest (30-60s), include bodyweight and circuit-style movements.',
    'recomp': 'Moderate reps (10-14), moderate rest (60-90s), equal emphasis on compound and isolation.',
    'general': 'Varied reps (10-15), moderate rest (60-90s), balanced compound + isolation.'
  }

  const femaleNote = p.sex === 'female'
    ? '\nFEMALE ATHLETE: Emphasize glutes and posterior chain (hip thrusts, RDLs, cable kickbacks, glute bridges). Include more direct glute and hamstring work. Upper body isolation can use lighter loads with higher reps.'
    : ''

  const ageNote = parseInt(p.age) >= 50
    ? '\nOLDER ATHLETE (50+): Include mobility-focused notes, suggest slightly longer rest periods, avoid high-impact plyometrics, include face pulls and external rotation work for shoulder health.'
    : ''

  return `Generate a personalized 12-week workout program for this user.

USER PROFILE:
- Sex: ${p.sex}
- Age: ${p.age} years old
- Weight: ${p.weight} lbs
- Experience Level: ${p.fitnessLevel}
- Primary Goal: ${goalLabels[p.goal] || p.goal}
- Activity Level: ${activityLabels[String(p.activity)] || 'Moderate'}
${femaleNote}${ageNote}

PROGRAM STRUCTURE:
The program has 3 phases (each repeated for 4 weeks). Generate ONE weekly template per phase.

Weekly training split:
- mon: Push — Chest, Shoulders, Triceps
- tue: Pull — Back, Biceps
- wed: Legs — Quads, Hamstrings, Glutes, Calves
- thu: Cardio + Core
- fri: Upper Body Push variant (DIFFERENT exercises from Monday, same muscle groups)
- sat: Pull + Legs combined (full body emphasis)

EXERCISE SELECTION:
${levelRules[p.fitnessLevel] || levelRules.intermediate}

GOAL ADJUSTMENTS:
${goalRules[p.goal] || goalRules.general}

PHASE PROGRESSION (must increase intensity phase-over-phase):
- Phase 1 "Foundation": Learn movements, moderate weight, establish baseline. Start conservative.
- Phase 2 "Progression": Add 1 set to main lifts, increase weight, introduce intensity techniques in notes.
- Phase 3 "Peak": Maximize intensity, include advanced variations, drop sets or supersets noted explicitly.

RULES:
- Each exercise object MUST have: name (string), sets (integer), reps (string), rest (string ending in 's' e.g. "90s"), notes (string with form cue or tip)
- "thu" Cardio+Core day: include 4-5 core exercises only (no cardio equipment — notes can mention cardio duration)
- "sat" day: include 6-8 exercises mixing upper and lower body
- Exercise names must be real gym exercises, spelled correctly
- Vary exercises across phases — do not repeat the same exercises in all 3 phases

Return ONLY a JSON object. No markdown. No explanation. No text before or after the JSON.

Required JSON structure:
{"phases":[{"phaseNum":1,"phaseName":"Foundation","days":{"mon":{"focus":"Push — Chest / Shoulders / Triceps","exercises":[{"name":"Barbell Bench Press","sets":3,"reps":"12","rest":"90s","notes":"Moderate weight, full range of motion"}]},"tue":{"focus":"Pull — Back / Biceps","exercises":[...]},"wed":{"focus":"Legs — Quads / Hamstrings / Glutes / Calves","exercises":[...]},"thu":{"focus":"Cardio + Core","exercises":[...]},"fri":{"focus":"Upper Push — Volume Day","exercises":[...]},"sat":{"focus":"Pull + Legs — Full Body","exercises":[...]}}},{"phaseNum":2,"phaseName":"Progression","days":{...}},{"phaseNum":3,"phaseName":"Peak","days":{...}}]}`
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })

  const profile = req.body && req.body.profile
  if (!profile) return res.status(400).json({ error: 'profile required in request body' })

  try {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8000,
      messages: [{ role: 'user', content: buildPrompt(profile) }]
    })

    const raw = message.content[0].text.trim()

    // Robustly extract JSON: strip code fences, then find outermost { ... }
    function extractJSON(text) {
      // Strip markdown code fences
      let s = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      // Find first { and matching last }
      const start = s.indexOf('{')
      const end = s.lastIndexOf('}')
      if (start !== -1 && end !== -1 && end > start) {
        s = s.slice(start, end + 1)
      }
      return s
    }

    let program
    try {
      program = JSON.parse(extractJSON(raw))
    } catch (parseErr) {
      console.error('[generate-program] JSON parse error:', parseErr.message)
      console.error('[generate-program] Raw response (first 500 chars):', raw.slice(0, 500))
      return res.status(500).json({ error: 'AI returned invalid JSON', detail: parseErr.message })
    }

    if (!program.phases || !Array.isArray(program.phases)) {
      return res.status(500).json({ error: 'AI response missing phases array' })
    }

    return res.status(200).json(program)
  } catch (err) {
    console.error('[generate-program] Anthropic API error:', err.message)
    return res.status(500).json({ error: err.message || 'Anthropic API error' })
  }
}
