// Connexions aux sources de données (table source_connections, une ligne par
// compte et par source). Réservé aux Edge Functions, en service role.
// La config de rafraîchissement de chaque source reste ici, côté serveur.

import type { SupabaseClient } from "npm:@supabase/supabase-js@^2"

/** Aucune connexion enregistrée pour ce compte et cette source. */
export class AucuneConnexionError extends Error {
  constructor(readonly provider: string) {
    super(`Aucune connexion ${provider} pour ce compte.`)
    this.name = "AucuneConnexionError"
  }
}

/** Le jeton a expiré et son rafraîchissement a échoué : reconnexion nécessaire. */
export class RafraichissementEchoueError extends Error {
  constructor(readonly provider: string, raison: string) {
    super(`Rafraîchissement ${provider} échoué : ${raison}`)
    this.name = "RafraichissementEchoueError"
  }
}

interface ConfigRafraichissement {
  tokenUrl: string
  clientIdEnv: string
}

const RAFRAICHISSEMENT: Record<string, ConfigRafraichissement> = {
  coros: { tokenUrl: "https://mcpeu.coros.com/oauth2/token", clientIdEnv: "COROS_CLIENT_ID" },
}

/** Rafraîchissement dès que le jeton expire dans moins de 2 jours. */
const MARGE_MS = 2 * 24 * 60 * 60 * 1000

interface LigneConnexion {
  access_token: string
  refresh_token: string
  expires_at: string
}

interface ReponseRafraichissement {
  access_token?: string
  refresh_token?: string
  expires_in?: number
}

/**
 * Jeton d'accès valide du compte pour cette source. Rafraîchit le jeton s'il
 * expire dans moins de 2 jours et enregistre le nouveau refresh_token (rotation).
 * Lève AucuneConnexionError sans ligne, RafraichissementEchoueError si le
 * rafraîchissement échoue (la ligne n'est jamais supprimée), Error sinon.
 */
export async function getValidToken(
  admin: SupabaseClient,
  userId: string,
  provider: string,
): Promise<string> {
  const { data, error } = await admin
    .from("source_connections")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle()

  if (error) {
    console.error("[connexions] lecture échouée:", provider, error.code, error.message)
    throw new Error(`Lecture de la connexion ${provider} impossible (${error.code}).`)
  }
  if (!data) throw new AucuneConnexionError(provider)

  const ligne = data as LigneConnexion
  const now = Date.now()
  if (new Date(ligne.expires_at).getTime() - now > MARGE_MS) return ligne.access_token

  const config = RAFRAICHISSEMENT[provider]
  if (!config) throw new Error(`Aucune config de rafraîchissement pour ${provider}.`)
  const clientId = Deno.env.get(config.clientIdEnv)
  if (!clientId) throw new Error(`Variable d'environnement ${config.clientIdEnv} manquante.`)

  let res: Response
  try {
    res = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: ligne.refresh_token,
        client_id: clientId,
      }).toString(),
    })
  } catch (err) {
    throw new RafraichissementEchoueError(provider, `appel impossible (${err instanceof Error ? err.message : err})`)
  }

  if (!res.ok) {
    // Texte du fournisseur : journalisé, jamais interprété ni renvoyé.
    const detail = await res.text().catch(() => "")
    console.error("[connexions] rafraîchissement refusé:", provider, res.status, detail.slice(0, 300))
    throw new RafraichissementEchoueError(provider, `HTTP ${res.status}`)
  }

  const neuf = await res.json().catch(() => null) as ReponseRafraichissement | null
  if (!neuf?.access_token || !neuf.refresh_token) {
    throw new RafraichissementEchoueError(provider, "réponse sans jetons")
  }

  const expiresIn = typeof neuf.expires_in === "number" ? neuf.expires_in : 0
  const { error: updateError } = await admin
    .from("source_connections")
    .update({
      access_token: neuf.access_token,
      refresh_token: neuf.refresh_token, // le refresh_token tourne à chaque rafraîchissement
      expires_at: new Date(now + expiresIn * 1000).toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", provider)

  if (updateError) {
    console.error("[connexions] écriture échouée:", provider, updateError.code, updateError.message)
    throw new Error(`Enregistrement des nouveaux jetons ${provider} impossible.`)
  }

  return neuf.access_token
}

export type EtatConnexion = "connectee" | "expiree"

export interface StatutConnexion {
  id: string
  etat: EtatConnexion
}

/**
 * État de chaque connexion du compte. Tente getValidToken (donc le
 * rafraîchissement) : « expiree » seulement si le rafraîchissement échoue.
 * Une connexion supprimée entre-temps est ignorée ; toute autre erreur est levée.
 */
export async function statutConnexions(admin: SupabaseClient, userId: string): Promise<StatutConnexion[]> {
  const { data, error } = await admin
    .from("source_connections")
    .select("provider")
    .eq("user_id", userId)
    .order("provider")
  if (error) {
    console.error("[connexions] liste échouée:", error.code, error.message)
    throw new Error(`Lecture des connexions impossible (${error.code}).`)
  }

  const statuts: StatutConnexion[] = []
  for (const { provider } of (data ?? []) as { provider: string }[]) {
    try {
      await getValidToken(admin, userId, provider)
      statuts.push({ id: provider, etat: "connectee" })
    } catch (err) {
      if (err instanceof AucuneConnexionError) continue
      if (err instanceof RafraichissementEchoueError) {
        console.error("[connexions] statut:", err.message)
        statuts.push({ id: provider, etat: "expiree" })
        continue
      }
      throw err
    }
  }
  return statuts
}

/** Vrai si le compte a une ligne pour cette source (sans contrôle d'expiration). Faux si la lecture échoue. */
export async function aUneConnexion(admin: SupabaseClient, userId: string, provider: string): Promise<boolean> {
  const { data, error } = await admin
    .from("source_connections")
    .select("user_id")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle()
  if (error) console.error("[connexions] présence échouée:", provider, error.code, error.message)
  return Boolean(data)
}
