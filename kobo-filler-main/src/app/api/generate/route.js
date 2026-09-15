import { buildPrompt }         from "@/lib/promptBuilder"
import { generateCompletion } from "@/lib/aiRouter"
import { rateLimiter }        from "@/lib/rateLimit"

export const maxDuration = 60

const MIN_BATCH = 10
const MAX_BATCH = 50

// ── Robust record extraction ──────────────────────────────────────────────────
// Handles raw JSON arrays `[...]` (response_format text) AND object wrappers like
// {"records":[...]} / {"data":[...]} / {"results":[...]} (in case a model ignores
// the text instruction or json_object is later enabled).
function parseRecords(text) {
  if (!text) return null
  const t = String(text).replace(/```json/gi, "").replace(/```/g, "").trim()

  try {
    const p = JSON.parse(t)
    if (Array.isArray(p)) return p
    if (p && Array.isArray(p.records)) return p.records
    if (p && Array.isArray(p.data))    return p.data
    if (p && Array.isArray(p.results)) return p.results
    if (p && Array.isArray(p.rows))    return p.rows
  } catch {}

  const s = t.indexOf("[")
  const e = t.lastIndexOf("]")
  if (s !== -1 && e > s) {
    try {
      const p = JSON.parse(t.slice(s, e + 1))
      if (Array.isArray(p)) return p
    } catch {}
  }

  return null
}

// ── Categorical distribution metadata (fed back as previousContext) ───────────
function computeDistribution(records, fields) {
  const cleanFields = (fields || []).filter(f => f && f.name && !f.name.startsWith("_"))
  const categorical = cleanFields.filter(f => Array.isArray(f.choices) && f.choices.length > 0)

  const out = {}
  for (const f of categorical) {
    const counts = {}
    let total = 0
    for (const r of records) {
      const v = r ? r[f.name] : undefined
      if (v == null || v === "") continue
      // select_one → single value; select_multiple (Kobo) → space-separated
      const vals = Array.isArray(v) ? v : String(v).split(/\s+/).filter(Boolean)
      for (const x of vals) {
        counts[x] = (counts[x] || 0) + 1
        total++
      }
    }
    out[f.name] = { counts, total, choices: f.choices }
  }

  return { totalRecords: records.length, fields: out }
}

export async function POST(req) {
  // ── Distributed rate limit (Upstash Redis; survives cold starts) ────────────
  // req.ip may be undefined outside Vercel → fall back to x-forwarded-for / anon.
  const identifier = req.ip || req.headers.get("x-forwarded-for") || "anonymous"
  const { success, reset } = await rateLimiter.limit(identifier)
  if (!success) {
    const retryAfter = reset ? Math.max(1, Math.ceil((reset - Date.now()) / 1000)) : 10
    return Response.json(
      { error: `Rate limit exceeded. Try again in ${retryAfter}s.` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    )
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body
  try { body = await req.json() }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }) }

  const { config, previousContext } = body || {}
  const fields = Array.isArray(body?.fields) ? body.fields : []

  // batchSize capped to [10, 50]; default 20
  const requested = Number(body?.batchSize)
  const batchSize = Math.min(
    MAX_BATCH,
    Math.max(MIN_BATCH, Number.isFinite(requested) && requested > 0 ? requested : 20)
  )

  try {
    // ── Build stateful prompt (system + user) ───────────────────────────────
    const messages = buildPrompt(config || {}, fields, batchSize, previousContext)

    // response_format "text" so ANY model (primary Gemini or fallback Llama,
    // with or without JSON-mode support) can return a raw JSON array. The robust
    // parseRecords() above also tolerates {"records":[...]} wrappers.
    const completion = await generateCompletion(messages, {
      temperature: 0.4,
      response_format: { type: "text" },
    })

    const aiText = completion?.choices?.[0]?.message?.content || ""
    const records = parseRecords(aiText)

    if (!records || records.length === 0) {
      return Response.json(
        { error: "AI did not return any valid records. Try again." },
        { status: 502 }
      )
    }

    // ── Updated categorical distribution metadata for the next chunk ─────────
    const updatedContext = computeDistribution(records, fields)

    return Response.json({ records, updatedContext })
  } catch (err) {
    console.error("Generate error:", err)
    return Response.json(
      { error: err?.message || "Generation failed." },
      { status: 500 }
    )
  }
}
