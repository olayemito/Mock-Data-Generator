export const maxDuration = 60

export async function GET(request) {
  try {
    // ── Extract params from request.nextUrl.searchParams ──────────────────
    const searchParams = request.nextUrl.searchParams
    const assetId = searchParams.get('assetId')

    // Read token from header FIRST (more secure), fallback to URL query param, then env
    const koboToken =
      request.headers.get('x-kobo-token') ||
      searchParams.get('koboToken') ||
      process.env.KOBO_API_TOKEN

    // Read server domain from query or header, fallback to env or default kf
    let server =
      searchParams.get('server') ||
      request.headers.get('x-kobo-server') ||
      process.env.KOBO_SERVER_URL ||
      'kf.kobotoolbox.org'

    // ── Explicit validation ─────────────────────────────────────────────────
    if (!assetId || !koboToken) {
      return NextResponse.json(
        { error: 'Missing required parameters: assetId and koboToken are required.' },
        { status: 400 }
      )
    }

    // ── Sanitize server: strip leading http(s):// + trailing slash ──────────
    server = server.replace(/^https?:\/\//, '').replace(/\/$/, '')

    // ── Upstream fetch (Authorization: Token — NOT Bearer) ──────────────────
    const targetUrl = `https://${server}/api/v2/assets/${assetId}.json`
    console.log(`[Schema API] Fetching from: ${targetUrl}`)

    let res
    try {
      res = await fetch(targetUrl, {
        method: 'GET',
        headers: {
          Authorization: `Token ${koboToken.trim()}`,
          Accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      })
    } catch (e) {
      return NextResponse.json(
        { error: 'Could not reach KoboToolbox: ' + e.message },
        { status: 502 }
      )
    }

    const text = await res.text()

    // ── Upstream error: handle common statuses + forward message ───────────
    if (!res.ok) {
      console.error(`[Schema API Error] Kobo returned ${res.status}:`, text)
      if (res.status === 401) {
        return NextResponse.json(
          { error: 'Invalid API token. Check your KoboToolbox API key.' },
          { status: 401 }
        )
      }
      if (res.status === 404) {
        return NextResponse.json(
          { error: `Form not found on https://${server}. Check your Asset ID and server instance.` },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: `Kobo API Error (${res.status}): ${text.slice(0, 200)}` },
        { status: res.status }
      )
    }

    // ── Parse + transform Kobo asset → {fields} for the client ──────────────
    let data
    try {
      data = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { error: 'KoboToolbox returned invalid JSON.' },
        { status: 500 }
      )
    }

    const survey = data?.content?.survey
    const choicesList = data?.content?.choices || []
    if (!survey || survey.length === 0) {
      return NextResponse.json(
        { error: 'No fields found in this form.' },
        { status: 404 }
      )
    }

    // Build choices lookup: list_name → [values]
    const choicesMap = {}
    for (const choice of choicesList) {
      const ln = choice.list_name
      if (!choicesMap[ln]) choicesMap[ln] = []
      const val = choice.name || choice.$autoname
      if (val) choicesMap[ln].push(val)
    }

    const fields = survey
      .filter((f) => f.name || f.$autoname)
      .map((f) => {
        const name = f.name || f.$autoname
        const type = f.type || 'text'
        const label = Array.isArray(f.label) ? f.label[0] : f.label || name
        let choices = null
        if (type.startsWith('select_one') || type.startsWith('select_multiple')) {
          const listName = f.select_from_list_name || type.split(' ')[1]
          if (listName && choicesMap[listName]) choices = choicesMap[listName]
        }
        return { name, type, label, choices }
      })

    return NextResponse.json({ fields })
  } catch (err) {
    console.error('[Schema API Internal Error]:', err)
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

}
