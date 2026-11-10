// Retour d'une connexion OAuth : la fonction de la source renvoie sur le chemin
// demandé avec ?source=<id>&connexion=ok|echec (supabase/functions/_shared/sources/retour.ts).
// Pur, sans React : lu par useRetourConnexion, testé par retourConnexion.test.js.

/**
 * Lit le retour dans une query (`location.search`).
 * -> null sans les deux paramètres, sinon { source, ok, search } où `search` est la
 * query sans eux (chaîne vide ou commençant par ?).
 */
export const lireRetourConnexion = (search) => {
  const params = new URLSearchParams(search)
  const source = params.get('source')
  const connexion = params.get('connexion')
  if (!source || !connexion) return null
  params.delete('source')
  params.delete('connexion')
  const reste = params.toString()
  return { source, ok: connexion === 'ok', search: reste ? `?${reste}` : '' }
}
