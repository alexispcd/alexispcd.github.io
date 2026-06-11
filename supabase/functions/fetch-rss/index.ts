import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface FeedInput {
  url: string
  name: string
  theme: string
}

interface FeedResult {
  feed: string
  inserted: number
  error?: string
}

function extractItems(doc: Document): Element[] {
  // Check for parseerror first
  if (doc.querySelector("parsererror")) return []
  const items = Array.from(doc.querySelectorAll("item"))
  if (items.length > 0) return items
  return Array.from(doc.querySelectorAll("entry"))
}

function extractUrl(item: Element): string {
  // Atom: <link href="..."/>
  const linkEl = item.querySelector("link")
  if (linkEl?.getAttribute("href")) return linkEl.getAttribute("href")!
  // RSS 2.0: <link>https://...</link>
  if (linkEl?.textContent?.trim()) return linkEl.textContent.trim()
  // guid as fallback
  return item.querySelector("guid")?.textContent?.trim() ?? ""
}

async function processFeed(
  feed: FeedInput,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<FeedResult> {
  let res: Response
  try {
    res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CairnBot/1.0)" },
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    return { feed: feed.name, inserted: 0, error: `fetch failed: ${err}` }
  }

  if (!res.ok) {
    return { feed: feed.name, inserted: 0, error: `HTTP ${res.status}` }
  }

  let xml: string
  try {
    xml = await res.text()
  } catch (err) {
    return { feed: feed.name, inserted: 0, error: `read failed: ${err}` }
  }

  let doc: Document
  try {
    doc = new DOMParser().parseFromString(xml, "text/xml")
  } catch (err) {
    return { feed: feed.name, inserted: 0, error: `parse failed: ${err}` }
  }

  const items = extractItems(doc)
  if (items.length === 0) {
    return { feed: feed.name, inserted: 0, error: "no items found (parseerror or empty feed)" }
  }

  let inserted = 0
  for (const item of items.slice(0, 20)) {
    const url = extractUrl(item)
    if (!url) continue

    const title = item.querySelector("title")?.textContent?.trim() ?? "(sans titre)"
    const pubDateRaw =
      item.querySelector("pubDate")?.textContent ??
      item.querySelector("published")?.textContent ??
      item.querySelector("updated")?.textContent
    const published_at = pubDateRaw
      ? new Date(pubDateRaw).toISOString()
      : new Date().toISOString()

    const { error, data } = await supabase
      .from("watch_items")
      .upsert(
        {
          user_id: userId,
          url,
          title,
          source: feed.name,
          tags: [feed.theme],
          published_at,
          is_read: false,
          is_favorite: false,
        },
        { onConflict: "url", ignoreDuplicates: true },
      )
      .select("id")

    if (error) {
      return { feed: feed.name, inserted, error: `db error: ${error.message}` }
    }
    if (data && data.length > 0) inserted++
  }

  return { feed: feed.name, inserted }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS })
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return Response.json({ error: "Missing authorization" }, { status: 401, headers: CORS })
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS })
  }

  const body = await req.json()
  const feeds: FeedInput[] = body.feeds
  if (!feeds || !Array.isArray(feeds)) {
    return Response.json({ error: "Missing feeds array" }, { status: 400, headers: CORS })
  }

  // Fetch all feeds in parallel
  const results = await Promise.all(feeds.map((f) => processFeed(f, supabase, user.id)))

  const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
  const errors = results.filter((r) => r.error)

  return Response.json(
    { inserted: totalInserted, feeds: results, errors },
    { headers: CORS },
  )
})
