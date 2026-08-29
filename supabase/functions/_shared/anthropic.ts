/**
 * Client partagé pour l'API Anthropic (api.anthropic.com/v1/messages).
 *
 * Un seul mode : anthropicSimple(), appel classique (model, system, messages,
 * max_tokens). L'accès aux données Coros ne passe plus par un modèle : voir
 * _shared/coros-mcp.ts, client MCP direct.
 *
 * La clé est lue depuis le secret ANTHROPIC_API_KEY.
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
const ANTHROPIC_VERSION = "2023-06-01"

// Un appel qui traîne devient une erreur applicative propre plutôt qu'une mort
// silencieuse de l'Edge Function (limite runtime).
const DEFAULT_TIMEOUT_MS = 150_000

export interface AnthropicMessage {
  role: "user" | "assistant"
  content: string | unknown[]
}

interface SimpleParams {
  model: string
  messages: AnthropicMessage[]
  max_tokens: number
  system?: string
  /** Timeout du fetch en ms (défaut 150s). */
  timeoutMs?: number
}

export interface AnthropicContentBlock {
  type: string
  text?: string
  [key: string]: unknown
}

export interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  [key: string]: unknown
}

/** Concatène les blocs texte de la réponse Anthropic. */
export function extractText(data: AnthropicResponse): string {
  const blocks = data.content ?? []
  return blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("")
}

async function callAnthropic(
  body: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<AnthropicResponse> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY manquante")

  const headers: Record<string, string> = {
    "x-api-key": apiKey,
    "anthropic-version": ANTHROPIC_VERSION,
    "Content-Type": "application/json",
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res: Response
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Anthropic timeout après ${Math.round(timeoutMs / 1000)}s`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

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
  }, p.timeoutMs)
  const text = extractText(data)
  if (!text) throw new Error("Réponse Anthropic vide")
  return text
}
