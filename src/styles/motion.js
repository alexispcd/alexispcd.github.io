// Mouvement du Design System (section Mouvement du README : tokens.json n'a pas de
// famille mouvement). Une seule courbe, sans rebond.

export const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'

/** Durées en millisecondes. */
export const DURATION = {
  open: 220, // ouvrir, déplier, ajouter, marquer faite
  close: 180, // fermer, replier, retirer, revenir à l'état d'avant
  fill: 400, // barre et chiffre qui se remplissent
  fade: 150, // fondu d'un texte ou d'une forme, bascule d'état
  press: 150, // appui : apparition du calque, agrandissement
  release: 200, // retour en place de la taille (réglage « Agrandit », sobre)
  effacement: 300, // disparition du calque d'appui
  page: 300, // transition de page (src/index.css)
  ressort: 390, // relâchement avec le petit ressort du réglage Animations
}

/** Agrandissement à l'appui du réglage « Pression », 3 %. */
export const AGRANDISSEMENT = 1.03

/**
 * Courbe du petit ressort du réglage « Retour en place » : raideur 400, amortissement
 * 30, masse 1, dépassement d'environ 3 %, 390 ms. Échantillonnage testé sur l'iPhone
 * (copie de public/labo/labo.js). Sans prise en charge de linear() : la courbe sobre.
 */
export const RESSORT = 'linear(0, 0.039, 0.132, 0.255, 0.386, 0.514, 0.631, 0.732, 0.815, 0.882, '
  + '0.933, 0.97, 0.996, 1.013, 1.023, 1.027, 1.028, 1.027, 1.024, 1.021, 1.017, 1.013, 1.01, '
  + '1.007, 1.005, 1.003, 1)'

/** transition('opacity', DURATION.fade) -> 'opacity 150ms cubic-bezier(...)'. */
export const transition = (props, duration) => []
  .concat(props)
  .map((p) => `${p} ${duration}ms ${EASE}`)
  .join(', ')

/**
 * Ajoute le retour en place de l'agrandissement (variable --retour-transition posée
 * sur <html> par le thème) à la transition d'un objet touchable en entier. À utiliser
 * pour toute transition posée sur une ButtonBase : elle écrase celle du thème.
 */
export const avecRetour = (transitions) => `${transitions}, var(--retour-transition)`
