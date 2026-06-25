import type { SupabaseClient } from "npm:@supabase/supabase-js@^2"

interface CorosTokenRow {
  access_token: string
  refresh_token: string
  expires_at: string // ISO timestamp
}

interface CorosRefreshResponse {
  access_token: string
  refresh_token: string
  expires_in: number // secondes
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

/**
 * Retourne un access_token Coros valide pour userId.
 * Rafraîchit automatiquement si expiration dans moins de 2 jours.
 * Throw si le refresh échoue (re-authentification manuelle requise).
 */
export async function getValidCorosToken(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<string> {
  // 1. Lire le token en base
  console.log("[coros-token] query coros_tokens for user_id:", userId)
  const { data, error } = await supabaseAdmin
    .from("coros_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle()

  if (error) {
    console.error("[coros-token] query error:", error.code, error.message, error.details)
    throw new Error(
      `Erreur lors de la lecture des tokens Coros (${error.code}) : ${error.message}`,
    )
  }

  if (!data) {
    console.error("[coros-token] no row found for user_id:", userId)
    throw new Error(
      "Aucun token Coros trouvé pour cet utilisateur. " +
        "Une connexion OAuth Coros est nécessaire.",
    )
  }

  const token = data as CorosTokenRow
  const expiresAt = new Date(token.expires_at).getTime()
  const now = Date.now()

  // 2. Token valide plus de 2 jours — retourner tel quel
  if (expiresAt - now > TWO_DAYS_MS) {
    return token.access_token
  }

  // 3. Rafraîchissement nécessaire
  const clientId = Deno.env.get("COROS_CLIENT_ID")
  if (!clientId) {
    throw new Error("Variable d'environnement COROS_CLIENT_ID manquante.")
  }

  const refreshRes = await fetch("https://mcpeu.coros.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh_token,
      client_id: clientId,
    }).toString(),
  })

  if (!refreshRes.ok) {
    const detail = await refreshRes.text().catch(() => "")
    throw new Error(
      `Rafraîchissement du token Coros échoué (HTTP ${refreshRes.status}). ` +
        `Une re-authentification OAuth Coros est nécessaire. Détail : ${detail}`,
    )
  }

  const refreshed: CorosRefreshResponse = await refreshRes.json()

  if (!refreshed.access_token || !refreshed.refresh_token) {
    throw new Error(
      "Réponse de rafraîchissement Coros invalide (tokens manquants). " +
        "Une re-authentification OAuth Coros est nécessaire.",
    )
  }

  const newExpiresAt = new Date(now + refreshed.expires_in * 1000).toISOString()

  // 4. Persister les nouveaux tokens (rotation — le refresh_token tourne)
  const { error: updateError } = await supabaseAdmin
    .from("coros_tokens")
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token, // nouveau refresh_token après rotation
      expires_at: newExpiresAt,
    })
    .eq("user_id", userId)

  if (updateError) {
    throw new Error(
      `Impossible de sauvegarder les nouveaux tokens Coros : ${updateError.message}`,
    )
  }

  return refreshed.access_token
}
