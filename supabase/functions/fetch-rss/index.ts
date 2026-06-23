import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// SYNC: cette liste doit rester identique à RSS_FEEDS dans src/lib/rss.js
// (impossible de partager le fichier : Supabase Edge Functions ne remonte pas les imports hors du répertoire de la fonction)
const SYSTEM_FEEDS = [
  { name: "Le Monde Informatique", url: "https://www.lemondeinformatique.fr/flux-rss/thematique/toute-l-informatique/1.xml", theme: "Optimisation du SI" },
  { name: "Journal du Net", url: "https://www.journaldunet.com/rss/", theme: "Management et stratégie" },
  { name: "ZDNet France", url: "https://www.zdnet.fr/feeds/rss/actualites/", theme: "Développement" },
  { name: "The Hacker News", url: "https://feeds.feedburner.com/TheHackersNews", theme: "Cybersécurité" },
  { name: "ANSSI", url: "https://www.cert.ssi.gouv.fr/feed/", theme: "Cybersécurité" },
  { name: "Krebs on Security", url: "https://krebsonsecurity.com/feed/", theme: "Cybersécurité" },
  { name: "AWS Blog", url: "https://aws.amazon.com/blogs/aws/feed/", theme: "Cloud et virtualisation" },
  { name: "InfoQ Cloud", url: "https://feed.infoq.com/cloud", theme: "Cloud et virtualisation" },
  { name: "Anthropic Blog", url: "https://www.anthropic.com/news/rss.xml", theme: "Intelligence artificielle" },
  { name: "MIT Technology Review AI", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", theme: "Intelligence artificielle" },
  { name: "dev.to", url: "https://dev.to/feed", theme: "Développement" },
  { name: "CSS Tricks", url: "https://css-tricks.com/feed/", theme: "Développement" },
  { name: "Towards Data Science", url: "https://medium.com/feed/towards-data-science", theme: "Big Data" },
  { name: "CoinTelegraph", url: "https://cointelegraph.com/rss", theme: "Blockchain" },
  { name: "GreenIT.fr", url: "https://www.greenit.fr/feed/", theme: "SI et environnement" },
  { name: "FrAndroid", url: "https://www.frandroid.com/feed", theme: "Mobilité" },
  { name: "InfoQ Mobile", url: "https://feed.infoq.com/mobile/", theme: "Mobilité" },
  { name: "Usine Digitale", url: "https://www.usine-digitale.fr/rss", theme: "Management et stratégie" },
  { name: "Clubic", url: "https://www.clubic.com/feed/news.rss", theme: "Optimisation du SI" },
  { name: "InfoQ Architecture", url: "https://feed.infoq.com/architecture-design/", theme: "Cloud et virtualisation" },
  { name: "InfoQ AI/ML/Data", url: "https://feed.infoq.com/ai-ml-data-eng/", theme: "Big Data" },
]

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

type ParsedNode = Record<string, unknown>

function toArray(val: unknown): ParsedNode[] {
  if (!val) return []
  return Array.isArray(val) ? (val as ParsedNode[]) : [val as ParsedNode]
}

function extractItems(parsed: ParsedNode): ParsedNode[] {
  const rssItems = (parsed as any).rss?.channel?.item
  if (rssItems) return toArray(rssItems)
  const atomEntries = (parsed as any).feed?.entry
  if (atomEntries) return toArray(atomEntries)
  return []
}

function extractText(val: unknown): string {
  if (!val) return ""
  if (typeof val === "string") return val.trim()
  if (typeof val === "object" && val !== null && "#text" in val) return String((val as any)["#text"]).trim()
  return String(val).trim()
}

function extractUrl(item: ParsedNode): string {
  if (item.link && typeof item.link === "string") return item.link.trim()
  if (item.link && typeof item.link === "object" && "@href" in (item.link as object)) {
    return String((item.link as any)["@href"]).trim()
  }
  return extractText(item.guid)
}

// Tronque le XML aux N premiers items pour limiter la taille parsée
function truncateXml(xml: string, maxItems: number): string {
  // Détecte le tag de fermeture d'item (RSS 2.0 ou Atom)
  const closeTag = xml.includes("</item>") ? "</item>" : "</entry>"
  let pos = 0
  for (let i = 0; i < maxItems; i++) {
    const next = xml.indexOf(closeTag, pos)
    if (next === -1) return xml // moins de maxItems items, rien à tronquer
    pos = next + closeTag.length
  }
  // Ferme proprement les balises parentes
  const suffix = xml.includes("</channel>")
    ? "</channel></rss>"
    : xml.includes("</feed>") ? "</feed>" : ""
  return xml.slice(0, pos) + suffix
}

async function processFeed(
  feed: FeedInput,
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<FeedResult> {
  const t0 = Date.now()
  console.log(`[${feed.name}] start`)

  let res: Response
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    res = await fetch(feed.url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CairnBot/1.0)" },
      signal: controller.signal,
    })
    clearTimeout(timer)
  } catch (err) {
    console.log(`[${feed.name}] fetch failed in ${Date.now() - t0}ms: ${err}`)
    return { feed: feed.name, inserted: 0, error: `fetch failed: ${err}` }
  }

  if (!res.ok) {
    console.log(`[${feed.name}] HTTP ${res.status} in ${Date.now() - t0}ms`)
    return { feed: feed.name, inserted: 0, error: `HTTP ${res.status}` }
  }

  let xmlText: string
  try {
    xmlText = await res.text()
  } catch (err) {
    return { feed: feed.name, inserted: 0, error: `read failed: ${err}` }
  }

  const rawBytes = xmlText.length
  if (rawBytes > 200_000) {
    console.log(`[${feed.name}] large feed: ${rawBytes} bytes, truncating to 20 items`)
    xmlText = truncateXml(xmlText, 20)
    console.log(`[${feed.name}] truncated to ${xmlText.length} bytes`)
  }

  let parsed: ParsedNode
  try {
    parsed = parse(xmlText) as ParsedNode
  } catch (err) {
    console.log(`[${feed.name}] parse failed in ${Date.now() - t0}ms: ${err}`)
    return { feed: feed.name, inserted: 0, error: `parse failed: ${err}` }
  }

  const items = extractItems(parsed)
  console.log(`[${feed.name}] done in ${Date.now() - t0}ms, ${items.length} items, ${rawBytes} bytes`)

  if (items.length === 0) {
    return { feed: feed.name, inserted: 0, error: "no items found (empty feed or unrecognized format)" }
  }

  let inserted = 0
  for (const item of items.slice(0, 20)) {
    const url = extractUrl(item)
    if (!url) continue

    const title = extractText(item.title) || "(sans titre)"
    const pubDateRaw =
      extractText(item.pubDate) ||
      extractText(item.published) ||
      extractText(item.updated) || null
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

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const isSystemCall = authHeader === `Bearer ${serviceRoleKey}`

  const body = await req.json().catch(() => ({}))
  const batchOffset: number = body.batchOffset ?? 0
  const batchSize: number = body.batchSize ?? 2

  let supabase: ReturnType<typeof createClient>
  let userId: string
  let feeds: FeedInput[]
  let depth: number

  if (isSystemCall) {
    supabase = createClient(supabaseUrl, serviceRoleKey)
    userId = Deno.env.get("CRON_USER_ID") ?? ""
    if (!userId) {
      return Response.json({ error: "CRON_USER_ID not configured" }, { status: 500, headers: CORS })
    }
    feeds = SYSTEM_FEEDS
    depth = body.depth ?? 0
  } else {
    supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: CORS })
    }
    userId = user.id
    feeds = Array.isArray(body?.feeds) ? body.feeds : SYSTEM_FEEDS
    depth = 0
  }

  const batch = feeds.slice(batchOffset, batchOffset + batchSize)
  const hasMore = batchOffset + batchSize < feeds.length
  const nextOffset = batchOffset + batchSize

  const results: FeedResult[] = []
  for (const f of batch) {
    results.push(await processFeed(f, supabase, userId))
    await new Promise((r) => setTimeout(r, 200))
  }

  const inserted = results.reduce((s, r) => s + r.inserted, 0)
  const errors = results.filter((r) => r.error)

  // En mode system, se ré-invoquer pour le batch suivant (max 5 ré-invocations)
  if (isSystemCall && hasMore && depth < 5) {
    fetch(`${supabaseUrl}/functions/v1/fetch-rss`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ batchOffset: nextOffset, depth: depth + 1 }),
    }).catch((err) => console.error("Self-invoke error:", err))
  }

  return Response.json({ processed: batch.length, inserted, hasMore, nextOffset, feeds: results, errors }, { headers: CORS })
})
