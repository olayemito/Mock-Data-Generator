export const maxDuration = 60

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
//   <data id="FORM_ID">
//     <field_name_1>value1</field_name_1>
//     <field_name_2>value2</field_name_2>
//     <meta>
//       <instanceID>uuid:GENERATED_UUID</instanceID>
//     </meta>
//   </data>
function buildSubmissionXml(formId, fieldData, instanceId) {
  const fields = Object.keys(fieldData)
    .filter(k => k && !k.startsWith("_"))
    .map(k => `  <${k}>${escapeXml(fieldData[k])}</${k}>`)
    .join("\n")
  return (
    `<?xml version="1.0"?>\n` +
    `<data id="${escapeXml(formId)}">\n` +
    `${fields}\n` +
    `  <meta>\n` +
    `    <instanceID>${escapeXml(instanceId)}</instanceID>\n` +
    `  </meta>\n` +
    `</data>`
  )
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
  const kfUrl          = server.replace(/\/$/, "")
  const submissionUrl = getSubmissionUrl(server)

  // ── Look up the form's id_string — the <data id="…"> must match the FORM's
  //    id_string, not the asset uid the user typed. Non-fatal: fall back to the
  //    user-supplied assetId if this lookup fails.
  let formId = assetId
  try {
    const assetRes = await fetch(`${kfUrl}/api/v2/assets/${assetId}/`, {
      headers: { Authorization: `Token ${koboToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    if (assetRes.ok) {
      const assetData = await assetRes.json()
      formId = assetData.id_string || assetData.uid || assetId
    }
  } catch {
    // non-fatal — proceed with the user-supplied assetId as the form id
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
      let abort   = false   // set on HTTP 410 (endpoint deprecated → all will fail)

      try {
        for (let i = 0; i < rows.length; i++) {
          if (abort) break

          // Strip KoboFiller internal metadata before building the XML
          const { _enumerator_id, _submission_time, _id, _rowId, ...fieldData } = rows[i] // strip display-only _ metadata; start/end/deviceid/username are standard Kobo meta (kept, emitted as XML)
          const instanceId = `uuid:${generateUUID()}`
          const xml        = buildSubmissionXml(formId, fieldData, instanceId)

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
              failed++
              errors.push(
                `Row ${i + 1}: Submission endpoint deprecated (410). Ensure you are posting OpenRosa XML to the kc server host.`
              )
              abort = true   // endpoint deprecated — every subsequent row will also 410
            } else if (!res.ok) {
              // 201 Created / 200 OK = success; anything else is a failure.
              const clean = text
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 160)
              failed++
              errors.push(`Row ${i + 1} failed (${res.status}): ${clean || "no error body"}`)
            } else {
              pushed++
            }
          } catch (e) {
            failed++
            errors.push(`Row ${i + 1} network error: ${e.message}`)
          }

          send({ type: "progress", current: i + 1, total, pushed, failed })
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
