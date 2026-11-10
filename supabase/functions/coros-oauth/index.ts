import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { withCors } from "../_shared/cors.ts"
import { errorMessage, internalError } from "../_shared/http.ts"
import { statutConnexions } from "../_shared/sources/connexions.ts"
import { cheminRetour, urlRetour } from "../_shared/sources/retour.ts"

const COROS_AUTHORIZE = "https://mcpeu.coros.com/oauth2/authorize"
const COROS_TOKEN = "https://mcpeu.coros.com/oauth2/token"
const COROS_RESOURCE = "https://mcpeu.coros.com/mcp"
const COROS_SCOPE = "openid mcp.tools offline_access"
const REDIRECT_URI = "https://fdijofhfrtsipsjxinbo.supabase.co/functions/v1/coros-oauth/callback"
const STATE_TTL_MS = 10 * 60 * 1000

const json = (status: number, body: unknown) => Response.json(body, { status })

/**
 * Redirection navigateur vers la PWA, sur le chemin de retour demandé au start
 * (chemin par défaut s'il est absent ou illisible), avec source=coros et
 * connexion=ok ou connexion=echec.
 */
const redirectToApp = (result: "ok" | "echec", returnPath?: string | null) =>
  new Response(null, { status: 302, headers: { Location: urlRetour(returnPath, "coros", result) } })

// PKCE : helpers bases sur le crypto natif de Deno, sans dependance.

/** Encodage base64url sans padding. */
function base64url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/** Chaine aleatoire url-safe de `bytes` octets d'entropie. */
function randomUrlSafe(bytes: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(bytes)))
}

/** code_challenge S256 du verifier (seule methode supportee par Coros). */
async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64url(new Uint8Array(digest))
}

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
}

/** Verifie le JWT porte par la requete. Retourne l'id utilisateur ou null. */
async function authenticate(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return null

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

Deno.serve(withCors(async (req) => {
  const pathname = new URL(req.url).pathname

  // Route publique : c'est Coros qui redirige le navigateur ici, sans JWT.
  if (req.method === "GET" && pathname.endsWith("/callback")) {
    try {
      return await handleCallback(req)
    } catch (err) {
      console.error("[coros-oauth] callback uncaught:", err instanceof Error ? err.message : err)
      return redirectToApp("echec")
    }
  }

  if (req.method === "POST") {
    try {
      return await handleAction(req)
    } catch (err) {
      return internalError("coros-oauth", err)
    }
  }

  return json(404, { error: "Not found" })
}))

/**
 * Routes authentifiees : status, start et disconnect. Ouvertes a tout compte
 * connecte (Sources de donnees est une page commune), sans requireModule.
 */
async function handleAction(req: Request): Promise<Response> {
  const userId = await authenticate(req)
  if (!userId) return json(401, { error: "Unauthorized" })

  // Corps lu une seule fois, puis passe aux actions qui en ont besoin.
  let body: Record<string, unknown>
  try {
    const parsed = await req.json()
    body = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}
  } catch (err) {
    console.error("[coros-oauth] corps invalide:", errorMessage(err))
    return json(400, { error: "Corps de requête invalide." })
  }
  const action = body.action

  if (action === "status") return await handleStatus(userId)
  if (action === "start") return await handleStart(userId, body.retour)
  if (action === "disconnect") return await handleDisconnect(userId)
  return json(400, { error: "Action inconnue" })
}

/**
 * Etat des connexions du compte, sans jamais renvoyer les tokens. Un jeton expire
 * est rafraichi avant de conclure : « expiree » seulement si le rafraichissement
 * echoue.
 */
async function handleStatus(userId: string): Promise<Response> {
  let sources
  try {
    sources = await statutConnexions(adminClient(), userId)
  } catch (err) {
    console.error("[coros-oauth] status:", errorMessage(err))
    return json(500, { error: "L'état de tes sources n'a pas pu être lu." })
  }
  return json(200, { sources })
}

/**
 * Deconnexion purement locale : suppression de la ligne Coros de source_connections. Le
 * revocation_endpoint de Coros n'accepte pas les clients publics sans secret
 * (401 systematique), aucun appel de revocation n'est donc tente.
 */
async function handleDisconnect(userId: string): Promise<Response> {
  const supabaseAdmin = adminClient()

  const { error: tokenError } = await supabaseAdmin
    .from("source_connections")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "coros")

  if (tokenError) {
    console.error("[coros-oauth] disconnect delete error:", tokenError.code, tokenError.message)
    return json(500, { error: "Coros n'a pas pu être déconnecté." })
  }

  // Etats OAuth restes en attente pour cet utilisateur : rien ne sert de les garder.
  const { error: stateError } = await supabaseAdmin
    .from("coros_oauth_state")
    .delete()
    .eq("user_id", userId)
  if (stateError) console.error("[coros-oauth] disconnect state cleanup error:", stateError.message)

  // Une suppression qui ne touche aucune ligne n'est pas une erreur.
  return json(200, { deconnectee: true })
}

/**
 * Prepare un couple state/verifier et retourne l'URL d'autorisation Coros.
 * retour : chemin de l'app ou revenir apres la connexion, facultatif ; un chemin
 * absent ou refuse devient le chemin par defaut.
 */
async function handleStart(userId: string, retour: unknown): Promise<Response> {
  const clientId = Deno.env.get("COROS_CLIENT_ID")
  if (!clientId) {
    console.error("[coros-oauth] COROS_CLIENT_ID manquant")
    return json(500, { error: "La connexion à Coros n'a pas pu être préparée." })
  }

  const supabaseAdmin = adminClient()

  // Purge opportuniste des etats expires.
  const cutoff = new Date(Date.now() - STATE_TTL_MS).toISOString()
  const { error: purgeError } = await supabaseAdmin
    .from("coros_oauth_state")
    .delete()
    .lt("created_at", cutoff)
  if (purgeError) console.error("[coros-oauth] purge error:", purgeError.message)

  const verifier = randomUrlSafe(32)
  const state = randomUrlSafe(32)
  const codeChallenge = await challengeFor(verifier)

  const { error: insertError } = await supabaseAdmin
    .from("coros_oauth_state")
    .insert({ state, code_verifier: verifier, user_id: userId, return_path: cheminRetour(retour) })
  if (insertError) {
    console.error("[coros-oauth] state insert error:", insertError.message)
    return json(500, { error: "La connexion à Coros n'a pas pu être préparée." })
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: REDIRECT_URI,
    scope: COROS_SCOPE,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    resource: COROS_RESOURCE,
  })

  return json(200, { url: `${COROS_AUTHORIZE}?${params.toString()}` })
}

/** Retour d'autorisation Coros : echange du code contre les tokens. */
async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  if (oauthError) {
    console.error("[coros-oauth] callback error param:", oauthError)
    return redirectToApp("echec")
  }
  if (!code || !state) {
    console.error("[coros-oauth] callback: code ou state manquant")
    return redirectToApp("echec")
  }

  const supabaseAdmin = adminClient()

  // Un state est a usage unique : on le lit puis on le supprime immediatement,
  // qu'il soit valide ou non.
  const { data: stateRow, error: stateError } = await supabaseAdmin
    .from("coros_oauth_state")
    .select("code_verifier, user_id, created_at, return_path")
    .eq("state", state)
    .maybeSingle()
  await supabaseAdmin.from("coros_oauth_state").delete().eq("state", state)

  if (stateError) {
    console.error("[coros-oauth] state query error:", stateError.message)
    return redirectToApp("echec")
  }
  if (!stateRow) {
    console.error("[coros-oauth] state inconnu")
    return redirectToApp("echec")
  }
  if (Date.now() - new Date(stateRow.created_at).getTime() > STATE_TTL_MS) {
    console.error("[coros-oauth] state expire")
    return redirectToApp("echec", stateRow.return_path)
  }

  const clientId = Deno.env.get("COROS_CLIENT_ID")
  if (!clientId) {
    console.error("[coros-oauth] COROS_CLIENT_ID manquant")
    return redirectToApp("echec", stateRow.return_path)
  }

  const tokenRes = await fetch(COROS_TOKEN, {
    method: "POST",
    headers: {
      "accept": "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: stateRow.code_verifier,
      redirect_uri: REDIRECT_URI,
      resource: COROS_RESOURCE,
      client_id: clientId,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "")
    console.error("[coros-oauth] token exchange failed:", tokenRes.status, detail)
    return redirectToApp("echec", stateRow.return_path)
  }

  const tokens = await tokenRes.json().catch(() => null) as
    | { access_token?: string; refresh_token?: string; expires_in?: number }
    | null

  if (!tokens?.access_token || !tokens.refresh_token) {
    console.error("[coros-oauth] reponse token incomplete")
    return redirectToApp("echec", stateRow.return_path)
  }

  const expiresIn = typeof tokens.expires_in === "number" ? tokens.expires_in : 0
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  // (user_id, provider) est la cle primaire de source_connections : l'upsert
  // remplace la ligne Coros existante.
  const { error: upsertError } = await supabaseAdmin
    .from("source_connections")
    .upsert({
      user_id: stateRow.user_id,
      provider: "coros",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    }, { onConflict: "user_id,provider" })

  if (upsertError) {
    console.error("[coros-oauth] token upsert error:", upsertError.message)
    return redirectToApp("echec", stateRow.return_path)
  }

  return redirectToApp("ok", stateRow.return_path)
}
