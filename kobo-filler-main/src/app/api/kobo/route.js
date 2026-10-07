export const maxDuration = 60

// Max in-flight OpenRosa submissions per chunk (parallel batch processing prevents
// Vercel 10s/60s function timeouts on large datasets).
const CONCURRENCY_LIMIT = 5

// ── UUID generator (for the OpenRosa <instanceID>uuid:…</instanceID>) ─────────
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ── Map a KoboToolbox (kf) server host → the OpenRosa /submission URL ─────────
//  kf.kobotoolbox.org → https://kc.kobotoolbox.org/submission
//  eu.kobotoolbox.org → https://kc.humanitarianresponse.info/submission
//  self-hosted kf.<host> → https://kc.<host>/submission  (best-effort)
function getSubmissionUrl(server) {
  const host = String(server || "")
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .trim()
  if (host.includes("eu.kobotoolbox.org")) return "https://kc.humanitarianresponse.info/submission"
  if (host.includes("kf.kobotoolbox.org")) return "https://kc.kobotoolbox.org/submission"
  if (host.startsWith("kf."))              return `https://${host.replace(/^kf\./, "kc.")}/submission`
  return `https://${host || "kc.kobotoolbox.org"}/submission`
}

// ── XML value escaping (field VALUES only; Kobo field names are valid XML names) ─
function escapeXml(s) {
  return String(s ?? "").replace(/[<>&"']/g, (c) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  })[c])
}

// ── Build an OpenRosa submission XML string for one row ──────────────────────
//   <${formId} id="${formId}">
//     <field_name_1>value1</field_name_1>
//     <select_multiple_field>key1 key2</select_multiple_field>
//     <meta>
//       <instanceID>uuid:GENERATED_UUID</instanceID>
//       <_submission_time>YYYY-MM-DD HH:MM:SS</_submission_time>
//       <_enumerator_id>enum_N</_enumerator_id>
//     </meta>
//   </${formId}>
// Convert a field value to OpenRosa XML text (schema-aware):
//  - arrays → space-joined ("key1 key2")
//  - select_multiple strings containing commas → split/trim/space-join (cleans LLM
//    formatting drift like "coil, indoor_spray" → "coil indoor_spray")
//  - all other types (text/integer/select_one/…) → String(v) UNTOUCHED (preserves
//    free-text fields like addresses/descriptions that legitimately contain commas)
function convertValue(v, fieldType) {
  if (v == null) return ""
  if (Array.isArray(v)) return v.join(" ")
  if (fieldType === "select_multiple" && typeof v === "string" && v.includes(",")) {
    return v.split(",").map(s => s.trim()).join(" ")
  }
  return String(v)
}

// Count non-metadata (survey) fields in a row: keys not starting with "_" and not
// standard Kobo meta (start/end). Used to reject empty-row payloads before push.
function countSurveyFields(row) {
  if (!row || typeof row !== "object") return 0
  return Object.keys(row).filter(k => k && !k.startsWith("_") && k !== "start" && k !== "end").length
}

// Serialize one row → OpenRosa XML. Root tag = formId (with id="${formId}");
// body = non-underscore fields (select_multiple values space-delimited via the
// schema-aware convertValue); <meta> = generated instanceID + _submission_time
// + _enumerator_id (from row, with index-based fallbacks if the client didn't attach them).
// Logs the outgoing XML + throws if the row has 0 survey fields (defensive backstop;
// the POST handler pre-validates this → HTTP 400).
function serializeToOpenRosaXml(row, formId, index, fieldTypes) {
  const root = formId || "data"

  // Defensive: refuse to serialize a row with 0 survey fields. The POST handler
  // pre-validates this → HTTP 400, but this guards against any bypass.
  if (countSurveyFields(row) === 0) throw new Error("Cannot push empty row payload to Kobo")

  const body = Object.keys(row)
    .filter(k => k && !k.startsWith("_"))
    .map(k => `  <${k}>${escapeXml(convertValue(row[k], fieldTypes ? fieldTypes[k] : undefined))}</${k}>`)
    .join("\n")

  const instanceId     = `uuid:${generateUUID()}`
  const submissionTime = row._submission_time || new Date().toISOString().replace("T", " ").substring(0, 19)
  const enumeratorId   = row._enumerator_id || `enum_${index + 1}`

  const xml =
    `<?xml version="1.0"?>\n` +
    `<${root} id="${escapeXml(root)}">\n` +
    `${body}\n` +
    `  <meta>\n` +
    `    <instanceID>${escapeXml(instanceId)}</instanceID>\n` +
    `    <_submission_time>${escapeXml(submissionTime)}</_submission_time>\n` +
    `    <_enumerator_id>${escapeXml(enumeratorId)}</_enumerator_id>\n` +
    `  </meta>\n` +
    `</${root}>`

  console.log("OUTGOING XML SAMPLE:", xml)
  return xml
}

export async function POST(req) {
  let body
  try { body = await req.json() }
  catch { return Response.json({ error: "Invalid JSON body." }, { status: 400 }) }

  const { assetId, rows, koboToken: bodyToken, server: bodyServer } = body || {}
  const koboToken = bodyToken || process.env.KOBO_API_TOKEN

  if (!assetId)      return Response.json({ error: "Asset ID is required." }, { status: 400 })
  if (!rows?.length) return Response.json({ error: "No rows to push." }, { status: 400 })
  if (!koboToken)    return Response.json({ error: "KoboToolbox API token is required. Enter it in the settings panel." }, { status: 400 })

  // ── Resolve servers: kf URL (asset lookup) + kc /submission URL (OpenRosa) ──
  const server        = bodyServer || process.env.KOBO_SERVER_URL || "https://kf.kobotoolbox.org"
  const kfUrl         = server.replace(/\/$/, "")
  const submissionUrl = getSubmissionUrl(server)

  // ── Look up the form's id_string + build a field-name→type lookup. Non-fatal:
  //    fall back to the user-supplied assetId + an empty fieldTypes if this fails.
  let formId = assetId
  let fieldTypes = {}   // field name → normalized type (e.g. "select_multiple") for schema-aware convertValue
  try {
    const assetRes = await fetch(`${kfUrl}/api/v2/assets/${assetId}/`, {
      headers: { Authorization: `Token ${koboToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    if (assetRes.ok) {
      const assetData = await assetRes.json()
      formId = assetData.id_string || assetData.uid || assetId
      // Build field-name → type lookup from the XLSForm survey definition, so
      // convertValue can clean select_multiple comma-strings without touching free-text.
      // Kobo types come as "select_multiple <list_name>" → normalize to the first token.
      const survey = assetData?.content?.survey || []
      for (const f of survey) {
        const name = f && (f.name || f.$autoname)
        if (name) fieldTypes[name] = String(f.type || "text").split(" ")[0]
      }
    }
  } catch {
    // non-fatal — proceed with the user-supplied assetId as the form id (fieldTypes stays {})
  }

  // ── Pre-stream validation: reject empty-row payloads with a real HTTP 400
  //    (can't return a 400 from inside the SSE stream). serializeToOpenRosaXml
  //    also asserts this defensively (throws) as a backstop.
  const emptyRowIdx = rows.findIndex(r => countSurveyFields(r) === 0)
  if (emptyRowIdx !== -1) {
    return Response.json(
      { error: `Cannot push empty row payload to Kobo (row ${emptyRowIdx + 1} has 0 survey fields).` },
      { status: 400 }
    )
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

      let pushed = 0
      let failed = 0
      const errors = []
      const total  = rows.length
      let abort   = false   // set on HTTP 410 (endpoint deprecated → stop future chunks)

      try {
        // ── Parallel batch chunking: process rows in chunks of CONCURRENCY_LIMIT
        //    via Promise.all (5 in flight at a time) to stay within Vercel function
        //    timeouts on large datasets. `send` is called only at chunk-level (after
        //    each Promise.all resolves) to avoid concurrent-enqueue races.
        for (let chunkStart = 0; chunkStart < rows.length; chunkStart += CONCURRENCY_LIMIT) {
          if (abort) break

          const chunk = rows.slice(chunkStart, chunkStart + CONCURRENCY_LIMIT)
          const results = await Promise.all(chunk.map(async (row, inChunkIdx) => {
            const globalIdx = chunkStart + inChunkIdx
            const xml = serializeToOpenRosaXml(row, formId, globalIdx, fieldTypes)

            try {
              // OpenRosa submission: multipart/form-data with the XML blob under
              // the standard key "xml_submission_file". fetch/undici sets the
              // multipart Content-Type + boundary automatically — do NOT set it
              // manually (a hardcoded boundary would break parsing).
              const formData = new FormData()
              formData.append(
                "xml_submission_file",
                new Blob([xml], { type: "text/xml" }),
                "submission.xml"
              )

              const res = await fetch(submissionUrl, {
                method: "POST",
                headers: { Authorization: `Token ${koboToken}` },
                body: formData,
              })

              // Safely read the body as text. Kobo returns HTML (not JSON) on
              // errors — never JSON.parse it.
              const text = await res.text()

              if (res.status === 410) {
                return { ok: false, status: 410, text, abort: true }
              }
              if (!res.ok) {
                return { ok: false, status: res.status, text }
              }
              return { ok: true }
            } catch (e) {
              return { ok: false, error: e.message }
            }
          }))

          // Aggregate this chunk's results into the overall counters (sequential,
          // so `send` is race-free). 410 aborts future chunks.
          for (let j = 0; j < results.length; j++) {
            const r = results[j]
            const globalIdx = chunkStart + j
            if (r.ok) {
              pushed++
            } else {
              failed++
              if (r.abort) {
                errors.push(
                  `Row ${globalIdx + 1}: Submission endpoint deprecated (410). Ensure you are posting OpenRosa XML to the kc server host.`
                )
                abort = true   // endpoint deprecated — every subsequent row will also 410
              } else if (r.error) {
                errors.push(`Row ${globalIdx + 1} network error: ${r.error}`)
              } else {
                // 201 Created / 200 OK = success; anything else is a failure.
                const clean = (r.text || "")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
                  .slice(0, 160)
                errors.push(`Row ${globalIdx + 1} failed (${r.status}): ${clean || "no error body"}`)
              }
            }
          }

          send({ type: "progress", current: Math.min(chunkStart + chunk.length, total), total, pushed, failed })
        }
      } catch (outerErr) {
        errors.push(`Unexpected error: ${outerErr.message}`)
      }

      send({ type: "done", pushed, failed, errors: errors.slice(0, 5) })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  })
}
