/**
 * Client partagé pour l'API Anthropic (api.anthropic.com/v1/messages).
 *
 * Deux modes :
 *   - anthropicSimple()     : appel classique (model, system, messages, max_tokens).
 *   - anthropicWithCoros()  : ajoute le MCP Coros (header beta + mcp_servers +
 *                             mcp_toolset référençant le serveur par son nom).
 *
 * La clé est lue depuis le secret ANTHROPIC_API_KEY.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"
const MCP_BETA = "mcp-client-2025-11-20"
const COROS_MCP_URL = "https://mcpeu.coros.com/mcp"
const COROS_SERVER_NAME = "coros"

export interface AnthropicMessage {
  role: "user" | "assistant"
  content: string | unknown[]
}

interface SimpleParams {
  model: string
  messages: AnthropicMessage[]
  max_tokens: number
  system?: string
}

interface CorosParams extends SimpleParams {
  corosToken: string
  /** Outils MCP à activer par leur nom (max 2-3 par appel — limites CPU). */
  tools: string[]
}

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>
  [key: string]: unknown
}

/** Concatène les blocs texte de la réponse Anthropic. */
export function extractText(data: AnthropicResponse): string {
  const blocks = data.content ?? []
  return blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")
}

async function callAnthropic(body: Record<string, unknown>): Promise<AnthropicResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante")

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "Content-Type": "application/json",
  }
  // Le mode MCP nécessite l'en-tête beta dédié.
  if ("mcp_servers" in body) headers["anthropic-beta"] = MCP_BETA

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    throw new Error(`Anthropic API error ${res.status}: ${errText}`)
  }
  return await res.json()
}

/** Appel simple : retourne le texte concaténé de la réponse. */
export async function anthropicSimple(p: SimpleParams): Promise<string> {
  const data = await callAnthropic({
    model: p.model,
    max_tokens: p.max_tokens,
    ...(p.system ? { system: p.system } : {}),
    messages: p.messages,
  })
  const text = extractText(data)
  if (!text) throw new Error("Réponse Anthropic vide")
  return text
}

/**
 * Appel avec MCP Coros. Le serveur "coros" est déclaré dans `mcp_servers` ET
 * référencé dans `tools` via un `mcp_toolset` (obligatoire, sinon l'API renvoie
 * "MCP server defined but not referenced"). Tous les outils sont désactivés par
 * défaut ; seuls ceux listés dans `tools` sont activés.
 */
export async function anthropicWithCoros(p: CorosParams): Promise<string> {
  if (!p.tools.length) throw new Error("anthropicWithCoros : au moins un outil MCP requis")

  const configs: Record<string, { enabled: boolean }> = {}
  for (const name of p.tools) configs[name] = { enabled: true }

  const data = await callAnthropic({
    model: p.model,
    max_tokens: p.max_tokens,
    ...(p.system ? { system: p.system } : {}),
    messages: p.messages,
    tools: [{
      type: "mcp_toolset",
      mcp_server_name: COROS_SERVER_NAME,
      default_config: { enabled: false },
      configs,
    }],
    mcp_servers: [{
      type: "url",
      url: COROS_MCP_URL,
      name: COROS_SERVER_NAME,
      authorization_token: p.corosToken,
    }],
  })
  const text = extractText(data)
  if (!text) throw new Error("Réponse Anthropic vide (MCP)")
  return text
}
