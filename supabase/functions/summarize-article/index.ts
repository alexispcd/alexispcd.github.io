import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const THEMES = [
  "SI et environnement",
  "Cybersécurité",
  "Cloud et virtualisation",
  "Big Data",
  "Développement",
  "Mobilité",
  "Management et stratégie",
  "Blockchain",
  "Intelligence artificielle",
  "Optimisation du SI",
]

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

  const { articleId, url, title, content } = await req.json()
  if (!url || !title) {
    return Response.json({ error: "Missing url or title" }, { status: 400, headers: CORS })
  }

  const userMessage = content
    ? `Titre : ${title}\n\nContenu :\n${content}`
    : `Titre : ${title}\nURL : ${url}`

  const mistralRes = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("MISTRAL_API_KEY")!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content:
            "Tu es un expert en veille technologique. Réponds uniquement en JSON valide avec les clés summary, keyPoints et suggestedTags.",
        },
        {
          role: "user",
          content: `Analyse cet article et génère une fiche de veille.

${userMessage}

Réponds avec ce JSON exact :
{
  "summary": "résumé en 5 lignes maximum",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "suggestedTags": ["tag1", "tag2"]
}

Les suggestedTags doivent être choisis parmi ces thèmes uniquement :
${THEMES.join(", ")}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  })

  if (!mistralRes.ok) {
    const errText = await mistralRes.text()
    console.error("Mistral error:", mistralRes.status, errText)
    return Response.json({ error: "Mistral API error", status: mistralRes.status, detail: errText }, { status: 502, headers: CORS })
  }

  const mistralData = await mistralRes.json()
  const rawText = mistralData.choices?.[0]?.message?.content ?? "{}"

  let parsed: { summary: string; keyPoints: string[]; suggestedTags: string[] }
  try {
    parsed = JSON.parse(rawText)
  } catch {
    console.error("Failed to parse Mistral response:", rawText)
    return Response.json({ error: "Invalid JSON from Mistral" }, { status: 502, headers: CORS })
  }

  const result = {
    summary: parsed.summary ?? "",
    keyPoints: parsed.keyPoints ?? [],
    suggestedTags: parsed.suggestedTags ?? [],
  }

  if (articleId) {
    await supabase
      .from("watch_items")
      .update({
        summary: result.summary,
        key_points: result.keyPoints,
        tags: result.suggestedTags,
      })
      .eq("id", articleId)
      .eq("user_id", user.id)
  }

  return Response.json(result, { headers: CORS })
})
