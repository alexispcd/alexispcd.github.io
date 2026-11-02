// Mouvement du Design System (section Mouvement du README : tokens.json n'a pas de
// famille mouvement). Une seule courbe, sans rebond.

export const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/** Durées en millisecondes. */
export const DURATION = {
  open: 220, // ouvrir, déplier, ajouter, marquer faite
  close: 180, // fermer, replier, retirer, revenir à l'état d'avant
  fill: 400, // barre et chiffre qui se remplissent
  fade: 150, // fondu d'un texte ou d'une forme, bascule d'état
  press: 100, // appui
  release: 200, // relâchement
  page: 300, // transition de page (src/index.css)
}

/** transition('opacity', DURATION.fade) -> 'opacity 150ms cubic-bezier(...)'. */
export const transition = (props, duration) => []
  .concat(props)
  .map((p) => `${p} ${duration}ms ${EASE}`)
  .join(', ')
