export const maxDuration = 60

export async function GET(req) {
  const { searchParams } = req.nextUrl
  const assetId   = searchParams.get("assetId")
  // Read token from header — never from URL query params (appear in server logs)
  const koboToken = req.headers.get("x-kobo-token") || process.env.KOBO_API_TOKEN

  if (!assetId)    return Response.json({ error: "Asset ID is required." }, { status: 400 })
  if (!koboToken)  return Response.json({ error: "KoboToolbox API token is required. Enter it in the settings panel." }, { status: 400 })

  const serverUrl = process.env.KOBO_SERVER_URL || "https://kf.kobotoolbox.org"

  let res
  try {
    res = await fetch(`${serverUrl}/api/v2/assets/${assetId}/`, {
      headers: { Authorization: `Token ${koboToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
  } catch (e) {
    return Response.json({ error: "Could not reach KoboToolbox: " + e.message }, { status: 502 })
  }

  const text = await res.text()
  if (!res.ok) {
    if (res.status === 401) return Response.json({ error: "Invalid API token. Check your KoboToolbox API key." }, { status: 401 })
    if (res.status === 404) return Response.json({ error: "Form not found. Check your Asset ID." }, { status: 404 })
    return Response.json({ error: `KoboToolbox error ${res.status}: ${text.slice(0, 200)}` }, { status: res.status })
  }

  let data
  try { data = JSON.parse(text) }
  catch { return Response.json({ error: "KoboToolbox returned invalid JSON." }, { status: 500 }) }

  const survey     = data?.content?.survey
  const choicesList = data?.content?.choices || []
  if (!survey || survey.length === 0)
    return Response.json({ error: "No fields found in this form." }, { status: 404 })

  // Build choices lookup: list_name → [values]
  const choicesMap = {}
  for (const choice of choicesList) {
    const ln = choice.list_name
    if (!choicesMap[ln]) choicesMap[ln] = []
    const val = choice.name || choice.$autoname
    if (val) choicesMap[ln].push(val)
  }

  const fields = survey
    .filter(f => f.name || f.$autoname)
    .map(f => {
      const name  = f.name || f.$autoname
      const type  = f.type || "text"
      const label = Array.isArray(f.label) ? f.label[0] : (f.label || name)
      let choices = null
      if (type.startsWith("select_one") || type.startsWith("select_multiple")) {
        const listName = f.select_from_list_name || type.split(" ")[1]
        if (listName && choicesMap[listName]) choices = choicesMap[listName]
      }
      return { name, type, label, choices }
    })

  return Response.json({ fields })
}
