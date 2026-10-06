// En-têtes CORS restreints aux origines de l'app. Ne bloque jamais une requête :
// sans Origin (pg_cron, redirection OAuth en navigation directe) ou avec une
// origine inconnue, la réponse part simplement sans Access-Control-Allow-Origin.

export const ALLOWED_ORIGINS: readonly string[] = [
  "https://alexispcd.github.io",
  // Défauts Vite : dev (5173) et preview (4173), vite.config ne fixe pas de port.
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
]

const BASE_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
}

/** En-têtes CORS pour cette requête : Allow-Origin posé uniquement si l'origine est autorisée. */
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin")
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    return { ...BASE_HEADERS, "Access-Control-Allow-Origin": origin }
  }
  return { ...BASE_HEADERS }
}

/**
 * Enveloppe un handler : répond au préflight OPTIONS et pose les en-têtes CORS
 * sur toute réponse renvoyée, erreurs comprises. Recrée la réponse car celles
 * de Response.redirect ont des en-têtes immuables.
 */
export function withCors(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req) => {
    const cors = corsHeaders(req)
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
    const res = await handler(req)
    const headers = new Headers(res.headers)
    for (const [key, value] of Object.entries(cors)) headers.set(key, value)
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }
}
