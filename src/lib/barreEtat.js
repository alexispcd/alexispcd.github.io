// Bande en haut de l'écran pendant une FeuilleFlottante, pour teinter la barre d'état
// de l'iPhone comme le voile (lot S3a, réglée au lot S3c).
//
// Fait établi sur iPhone : la barre d'état suit ce qui est en haut de la page, avec un
// délai. La page commence sous la barre d'état (safe-area haut à 0) : le voile ne peut
// pas la couvrir. Une bande opaque la teinte ; le body et les metas theme-color ne
// changent pas. Choix final (Alexis, 4 novembre) : 8 px, posée d'un coup, car un
// fondu ne teint pas la barre.
import { VEIL, colors } from '../styles/tokens.js'

const HAUTEUR = 8

// ─── Couleur ────────────────────────────────────────────────────────────────

const canaux = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Couleur opaque d'une couche `dessus` d'opacité `alpha` posée sur `dessous` (hex #rrggbb). */
export const melanger = (dessus, alpha, dessous) => {
  const a = canaux(dessus)
  const b = canaux(dessous)
  return `#${a.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha))
    .toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

/** Voile du thème mélangé au fond bg : #A5A7A6 en clair, bg lui-même en sombre. */
export const couleurVoileSurFond = (mode) => {
  const c = colors[mode]
  return melanger(c[VEIL[mode].token], VEIL[mode].alpha, c.bg)
}

// ─── Bande ──────────────────────────────────────────────────────────────────

let ouvertes = 0
let bande = null

const mode = () => (document.body.classList.contains('dark') ? 'dark' : 'light')

const retirerBande = () => {
  bande?.remove()
  bande = null
}

const poser = () => {
  retirerBande()
  const m = mode()
  const couleur = couleurVoileSurFond(m)
  // En sombre, le voile mélangé vaut bg : aucune bande.
  if (couleur === colors[m].bg) return
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    height: `${HAUTEUR}px`,
    backgroundColor: couleur,
    // Au-dessus du voile et de la feuille (Modal MUI, 1300).
    zIndex: '1301',
    pointerEvents: 'none',
  })
  document.body.appendChild(el)
  bande = el
}

/** Une feuille s'ouvre. Compte les feuilles empilées : seule la première agit. */
export const ouvrirFeuille = () => {
  ouvertes += 1
  if (ouvertes === 1) poser()
}

/** Une feuille se ferme. La dernière retire la bande. */
export const fermerFeuille = () => {
  if (ouvertes === 0) return
  ouvertes -= 1
  if (ouvertes === 0) retirerBande()
}
