import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  const { feeds } = await req.json()
  if (!feeds || !Array.isArray(feeds)) {
    return Response.json({ error: "Missing feeds array" }, { status: 400, headers: CORS })
  }

  const newArticles: unknown[] = []

  for (const feed of feeds) {
    try {
      const res = await fetch(feed.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CairnBot/1.0)" },
      })
      if (!res.ok) continue

      const xml = await res.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(xml, "text/xml")

      // RSS 2.0 uses <item>, Atom uses <entry>
      const items = [
        ...Array.from(doc.querySelectorAll("item")),
        ...Array.from(doc.querySelectorAll("entry")),
      ]

      for (const item of items) {
        const title = item.querySelector("title")?.textContent?.trim() ?? ""

        // RSS: <link> text node; Atom: <link href="...">
        const linkEl = item.querySelector("link")
        const url = linkEl?.getAttribute("href") ?? linkEl?.textContent?.trim() ?? ""
        if (!url) continue

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
              user_id: user.id,
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
          .select()

        if (!error && data && data.length > 0) {
          newArticles.push(...data)
        }
      }
    } catch (err) {
      console.error(`Error fetching ${feed.url}:`, err)
    }
  }

  return Response.json(
    { articles: newArticles, count: newArticles.length },
    { headers: CORS },
  )
})
