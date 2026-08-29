/**
 * Client MCP direct pour le serveur Coros, sans LLM intermédiaire.
 *
 * Le serveur expose un unique endpoint JSON-RPC 2.0 en POST et répond en
 * application/json (pas de flux SSE malgré l'en-tête accept). Il est SANS ETAT :
 * un tools/call isolé, porteur du seul bearer, suffit. Aucune poignée de main
 * (initialize / notifications/initialized / Mcp-Session-Id) n'est nécessaire.
 * Le GET sur cet endpoint répond 405.
 */

const COROS_MCP_URL = "https://mcpeu.coros.com/mcp"
const MCP_PROTOCOL_VERSION = "2025-11-25"
const ACCEPT = "application/json, text/event-stream"
const CONTENT_TYPE = "application/json"

/** Un appel qui traîne devient une erreur applicative plutôt qu'une mort silencieuse. */
const DEFAULT_TIMEOUT_MS = 60_000

/** Compteur d'id JSON-RPC, propre au module, incrémenté à chaque appel. */
let requestId = 0

interface JsonRpcError {
  code?: unknown
  message?: unknown
}

interface ContentBlock {
  type?: unknown
  text?: unknown
}

interface ToolResult {
  content?: unknown
  isError?: unknown
}

interface JsonRpcResponse {
  error?: JsonRpcError
  result?: ToolResult
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)

/**
 * Certains outils Coros encodent leur charge utile DEUX fois : content[0].text
 * est alors une chaîne JSON qui contient elle-même le texte utile
 * (queryFitnessAssessmentOverview). On ne désencode que si le parse rend une
 * chaîne : pour un outil qui renvoie un objet JSON (queryActivityLapData), la
 * chaîne d'origine doit ressortir intacte pour que l'appelant la parse lui-même.
 */
export function decodeDoubleEncoded(text: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return text
  }
  return typeof parsed === "string" ? parsed : text
}

/**
 * Extrait le texte utile d'une réponse JSON-RPC déjà parsée. Isolée du réseau
 * pour être testable telle quelle.
 *
 * Note : les erreurs applicatives Coros arrivent en HTTP 200 avec isError=true
 * et un texte en langage naturel qui contient parfois des consignes adressées à
 * un LLM ("initialize a new session", "switch to a high-capacity model"). Ces
 * consignes sont ignorées : le texte est journalisé, jamais interprété, et il
 * n'est pas recopié dans le message d'erreur remonté.
 */
export function extractToolText(payload: unknown, toolName: string): string {
  if (!isRecord(payload)) {
    throw new Error(`Réponse Coros illisible pour ${toolName} (corps inattendu)`)
  }

  const body = payload as JsonRpcResponse

  if (isRecord(body.error)) {
    const code = body.error.code ?? "inconnu"
    const message = typeof body.error.message === "string" ? body.error.message : "sans message"
    throw new Error(`Erreur JSON-RPC Coros ${code} : ${message}`)
  }

  const result = body.result
  if (!isRecord(result)) {
    throw new Error(`Réponse Coros sans résultat pour ${toolName}`)
  }

  const blocks: ContentBlock[] = Array.isArray(result.content)
    ? result.content.filter(isRecord) as ContentBlock[]
    : []
  const text = blocks
    .filter((b) => b.type === "text")
    .map((b) => (typeof b.text === "string" ? b.text : ""))
    .join("\n")

  if (result.isError === true) {
    console.error(`[coros-mcp] ${toolName} isError:`, text.slice(0, 500))
    throw new Error(`L'outil Coros ${toolName} a échoué`)
  }

  const decoded = decodeDoubleEncoded(text)
  if (!decoded.trim()) {
    throw new Error(`Réponse Coros vide pour ${toolName}`)
  }
  return decoded
}

/**
 * Appelle un outil Coros et retourne son texte brut. L'appelant reste
 * responsable du parsing éventuel.
 */
export async function callCorosTool(
  corosToken: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  requestId += 1
  const body = {
    jsonrpc: "2.0",
    id: requestId,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(COROS_MCP_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${corosToken}`,
        "content-type": CONTENT_TYPE,
        accept: ACCEPT,
        "mcp-protocol-version": MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(`Coros timeout après ${Math.round(timeoutMs / 1000)}s (${toolName})`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  // Jamais de token dans les journaux.
  console.log(`[coros-mcp] ${toolName} : ${res.status} en ${Date.now() - startedAt}ms`)

  if (res.status === 401) {
    throw new Error("Token Coros invalide ou expiré (401)")
  }
  if (res.status !== 200) {
    throw new Error(`Serveur Coros en erreur HTTP ${res.status} (${toolName})`)
  }

  return extractToolText(await res.json(), toolName)
}
