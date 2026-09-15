export const maxDuration = 60

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function getKcUrl(kfUrl) {
  if (kfUrl.includes("://kf.kobotoolbox.org"))
    return kfUrl.replace("://kf.kobotoolbox.org", "://kc.kobotoolbox.org")
  if (kfUrl.includes("://kobocat.kobotoolbox.org"))
    return kfUrl
  const match = kfUrl.match(/^(https?:\/\/)kf\.(.+)$/)
  if (match) return `${match[1]}kc.${match[2]}`
  return kfUrl
}

export async function POST(req) {
  const body = await req.json()
  const { assetId, rows, koboToken: bodyToken } = body
  const koboToken = bodyToken || process.env.KOBO_API_TOKEN

  if (!assetId)      return Response.json({ error: "Asset ID is required." }, { status: 400 })
  if (!rows?.length) return Response.json({ error: "No rows to push." }, { status: 400 })
  if (!koboToken)    return Response.json({ error: "KoboToolbox API token is required." }, { status: 400 })

  const kfUrl = (process.env.KOBO_SERVER_URL || "https://kf.kobotoolbox.org").replace(/\/$/, "")
  const kcUrl = getKcUrl(kfUrl)

  let formUuid     = null
  let formIdString = assetId

  try {
    const assetRes = await fetch(`${kfUrl}/api/v2/assets/${assetId}/`, {
      headers: { Authorization: `Token ${koboToken}`, Accept: "application/json" },
    })
    if (assetRes.ok) {
      const assetData = await assetRes.json()
      formUuid     = assetData.uuid || null
      formIdString = assetData.uid  || assetId
    }
  } catch {
    // Non-fatal — proceed without UUID
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

      try {
        for (let i = 0; i < rows.length; i++) {
          // Strip all internal KoboFiller metadata before pushing
          const { _enumerator, _submission_time, _id, _rowId, ...fieldData } = rows[i]

          const instanceId = `uuid:${generateUUID()}`

          const submissionBody = {
            id: formIdString,
            submission: {
              ...(formUuid ? { formhub: { uuid: formUuid } } : {}),
              ...fieldData,
              meta: { instanceID: instanceId },
            },
          }

          try {
            const res = await fetch(`${kcUrl}/api/v1/submissions`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization:  `Token ${koboToken}`,
              },
              body: JSON.stringify(submissionBody),
            })

            const text = await res.text()

            if (!res.ok) {
              let errMsg = `(${res.status})`
              try {
                const errJson = JSON.parse(text)
                errMsg += ": " + (
                  errJson.detail || errJson.error || errJson.message || JSON.stringify(errJson)
                ).slice(0, 120)
              } catch {
                errMsg += ": " + text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120)
              }
              failed++
              errors.push(`Row ${i + 1} failed ${errMsg}`)
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
