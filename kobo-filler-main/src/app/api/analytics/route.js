export const maxDuration = 60

export async function GET(req) {
  const { searchParams } = req.nextUrl
  const assetId   = searchParams.get("assetId")
  const koboToken = req.headers.get("x-kobo-token") || process.env.KOBO_API_TOKEN

  if (!assetId)   return Response.json({ error: "Asset ID is required." }, { status: 400 })
  if (!koboToken) return Response.json({ error: "API token is required." }, { status: 400 })

  const serverUrl = process.env.KOBO_SERVER_URL || "https://kf.kobotoolbox.org"

  try {
    const res = await fetch(`${serverUrl}/api/v2/assets/${assetId}/data/`, {
      headers: { Authorization: `Token ${koboToken}`, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return Response.json({ error: `KoboToolbox error ${res.status}` }, { status: res.status })
    const data = await res.json()
    return Response.json({ submissionCount: data?.count ?? data?.results?.length ?? 0 })
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
