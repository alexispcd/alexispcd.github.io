/**
 * Extrait le JSON d'une réponse LLM.
 * Gère : bloc markdown ```json ... ```, texte parasite avant/après, ou JSON brut.
 * Version centralisée (remplace les copies dupliquées dans chaque fonction).
 */
export function extractJson(raw: string): string {
  const block = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (block) return block[1].trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  return start !== -1 && end > start ? raw.slice(start, end + 1) : raw.trim()
}
