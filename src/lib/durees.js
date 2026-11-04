// Durées habituelles des attentes, en millisecondes : rythme de la BarreAttente
// (elle avance vers 90 % en ralentissant, au rythme de cette durée).

export const DUREES = {
  // Mesurées dans les logs du 30 octobre au 2 novembre 2026.
  rechercheActivites: 1600, // recherche des activités d'une séance (coros-match)
  validation: 3900, // validation d'une séance avec analyse (complete-session)
  envoiMontre: 2100, // envoi ou mise à jour sur la montre (coros-push)
  preparationRenfo: 15500, // préparation d'une séance Renfo (renfo-session)
  administration: 700, // actions de l'Administration (admin-users)
  sources: 400, // état d'une source de données (coros-oauth)

  // À reprendre : estimations, sans mesure.
  chargementPage: 1200, // chargement d'une page
  adaptation: 4000, // adaptation des séances après « Sauter et adapter »
  enregistrement: 600, // enregistrement de réglages
  envoiCode: 1200, // envoi du code de connexion
  generationPlan: 120000, // génération ou régénération d'un plan (sans fin tant que ça génère)
  actionCourte: 1200, // action courte : écriture directe, appel rapide
  connexion: 1000, // vérification du code de connexion
  rechercheCotes: 4000, // recherche de côtes (Overpass puis altitudes)
  resumeArticle: 4000, // fiche d'un article de la Veille (summarize-article)
}
