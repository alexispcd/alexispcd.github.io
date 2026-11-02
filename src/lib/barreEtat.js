// Bande en haut de l'écran pendant une FeuilleFlottante, pour teinter la barre d'état
// de l'iPhone comme le voile (lot S3a, réduit au lot S3b).
//
// Fait établi sur iPhone : la barre d'état suit ce qui est en haut de la page, avec un
// délai. La page commence sous la barre d'état (safe-area haut à 0) : le voile ne peut
// pas la couvrir. Seule une bande opaque de 44 px l'a teintée ; le body et les metas
// theme-color ne changent plus. Deux réglages de test, choisis dans l'Atelier : la
// hauteur de la bande et son apparition (d'un coup ou en fondu).
import { VEIL, colors } from '../styles/tokens.js'
import { DURATION, transition } from '../styles/motion.js'

export const HAUTEURS = [8, 12, 16, 24, 44]
export const APPARITIONS = [
  { valeur: 'net', libelle: "D'un coup" },
  { valeur: 'fondu', libelle: 'Fondu' },
]
const DEFAUT = { hauteur: 44, apparition: 'net' }
const CLE = 'cairn:barre_etat_bande'

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

// ─── Réglages de test (gardés sur l'appareil) ───────────────────────────────

const valides = (r) => ({
  hauteur: HAUTEURS.includes(r?.hauteur) ? r.hauteur : DEFAUT.hauteur,
  apparition: APPARITIONS.some((a) => a.valeur === r?.apparition) ? r.apparition : DEFAUT.apparition,
})

const lireStockage = () => {
  try {
    return valides(JSON.parse(window.localStorage.getItem(CLE) ?? 'null'))
  } catch {
    return DEFAUT
  }
}

let reglages = typeof window === 'undefined' ? DEFAUT : lireStockage()
const abonnes = new Set()

/** Réglages courants { hauteur, apparition } ; même objet tant qu'ils ne changent pas. */
export const lireReglages = () => reglages

export const changerReglages = (patch) => {
  const suivant = valides({ ...reglages, ...patch })
  if (suivant.hauteur === reglages.hauteur && suivant.apparition === reglages.apparition) return
  reglages = suivant
  try {
    window.localStorage.setItem(CLE, JSON.stringify(reglages))
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la session.
  }
  abonnes.forEach((f) => f())
}

/** Pour useSyncExternalStore. */
export const abonnerReglages = (f) => {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

// ─── Bande ──────────────────────────────────────────────────────────────────

let ouvertes = 0
let bande = null
let minuteur = null

const mode = () => (document.body.classList.contains('dark') ? 'dark' : 'light')

const reduire = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const retirerBande = () => {
  clearTimeout(minuteur)
  minuteur = null
  bande?.remove()
  bande = null
}

const creerBande = (fond) => {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  Object.assign(el.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    height: `${reglages.hauteur}px`,
    backgroundColor: fond,
    // Au-dessus du voile et de la feuille (Modal MUI, 1300).
    zIndex: '1301',
    pointerEvents: 'none',
  })
  document.body.appendChild(el)
  return el
}

const poser = () => {
  const m = mode()
  const couleur = couleurVoileSurFond(m)
  // En sombre, le voile mélangé vaut bg : aucune bande.
  if (couleur === colors[m].bg) {
    retirerBande()
    return
  }
  const fondu = reglages.apparition === 'fondu' && !reduire()
  if (!fondu) {
    retirerBande()
    bande = creerBande(couleur)
    return
  }
  // Fondu : depuis bg (ou depuis l'état d'une fermeture en cours), vers le voile en 220 ms.
  clearTimeout(minuteur)
  minuteur = null
  if (!bande) {
    bande = creerBande(colors[m].bg)
    // Lecture de mise en page : la couleur de départ est prise en compte avant la transition.
    void bande.offsetHeight
  }
  bande.style.transition = transition('background-color', DURATION.open)
  bande.style.backgroundColor = couleur
}

const enlever = () => {
  if (!bande) return
  if (reglages.apparition !== 'fondu' || reduire()) {
    retirerBande()
    return
  }
  // Fondu : retour à bg en 180 ms, puis la bande disparaît.
  bande.style.transition = transition('background-color', DURATION.close)
  bande.style.backgroundColor = colors[mode()].bg
  clearTimeout(minuteur)
  minuteur = setTimeout(retirerBande, DURATION.close)
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
  if (ouvertes === 0) enlever()
}
