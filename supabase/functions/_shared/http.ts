// Réponses d'erreur des Edge Functions. Règle : un message interne (err.message,
// erreur Postgres ou Supabase, texte Coros, Mistral ou Anthropic) part dans les
// logs, jamais dans la réponse. Le texte Coros peut contenir des injections.

/** Message lisible d'une erreur quelconque, pour les logs uniquement. */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err)

/** Journalise `err` sous le préfixe [tag] et renvoie un 500 générique, sans détail. */
export const internalError = (tag: string, err: unknown): Response => {
  console.error(`[${tag}]`, errorMessage(err))
  return Response.json({ error: "Internal server error" }, { status: 500 })
}
