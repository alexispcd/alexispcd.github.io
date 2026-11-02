// Banc d'essai de la barre d'état de l'iPhone pendant une FeuilleFlottante (lot S3a).
//
// Fait établi sur iPhone : la barre d'état suit le fond de la page, avec un délai à
// l'ouverture du voile. La page commence sous la barre d'état (safe-area haut à 0) :
// le voile ne peut pas la couvrir. Quatre variantes à comparer sur la vraie feuille :
// - A « fond » : body et metas theme-color passent à la couleur du voile, sans transition ;
// - B « fond 220 » : pareil, fondu du fond en 220 ms à l'ouverture, 180 ms à la fermeture ;
// - C « bande 2 » : body et metas inchangés, bande opaque de 2 px en haut de l'écran ;
// - D « bande 44 » : pareil, 44 px.
// Les variantes écartées seront retirées au lot suivant, avec ce qui ne sert plus ici.
import { VEIL, colors } from '../styles/tokens.js'
import { DURATION, transition } from '../styles/motion.js'

export const VARIANTES = ['A', 'B', 'C', 'D']
export const LIBELLES = { A: 'fond', B: 'fond 220', C: 'bande 2', D: 'bande 44' }
const HAUTEUR_BANDE = { C: '2px', D: '44px' }
const DEFAUT = 'B'
const CLE = 'cairn:barre_etat'

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

// ─── Variante choisie (gardée sur l'appareil) ───────────────────────────────

const lireStockage = () => {
  try {
    const v = window.localStorage.getItem(CLE)
    return VARIANTES.includes(v) ? v : DEFAUT
  } catch {
    return DEFAUT
  }
}

let variante = typeof window === 'undefined' ? DEFAUT : lireStockage()
const abonnes = new Set()

export const lireVariante = () => variante

export const choisirVariante = (v) => {
  if (!VARIANTES.includes(v) || v === variante) return
  variante = v
  try {
    window.localStorage.setItem(CLE, v)
  } catch {
    // Stockage indisponible (navigation privée) : le choix vaut pour la session.
  }
  abonnes.forEach((f) => f())
}

/** Pour useSyncExternalStore. */
export const abonnerVariante = (f) => {
  abonnes.add(f)
  return () => abonnes.delete(f)
}

// ─── Application ────────────────────────────────────────────────────────────

let ouvertes = 0
let minuteur = null
let image = null
let bande = null

const mode = () => (document.body.classList.contains('dark') ? 'dark' : 'light')

const poserMetas = (couleur) => {
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', couleur))
}

const reduire = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

const annulerMinuteurs = () => {
  clearTimeout(minuteur)
  cancelAnimationFrame(image)
  minuteur = null
  image = null
}

const nettoyerBody = () => {
  document.body.style.removeProperty('background-color')
  document.body.style.removeProperty('transition')
}

const retirerBande = () => {
  bande?.remove()
  bande = null
}

const appliquer = () => {
  annulerMinuteurs()
  retirerBande()
  const m = mode()
  const couleur = couleurVoileSurFond(m)
  // En sombre, le voile mélangé vaut bg : rien à changer, aucune bande.
  if (couleur === colors[m].bg) {
    nettoyerBody()
    return
  }
  const v = variante
  if (v === 'A' || v === 'B') {
    // La transition du body (src/index.css) est remplacée tant que la feuille est ouverte.
    document.body.style.transition = v === 'B' && !reduire()
      ? transition('background-color', DURATION.open)
      : 'none'
    document.body.style.backgroundColor = couleur
    poserMetas(couleur)
    return
  }
  nettoyerBody()
  bande = document.createElement('div')
  bande.setAttribute('aria-hidden', 'true')
  Object.assign(bande.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    height: HAUTEUR_BANDE[v],
    backgroundColor: couleur,
    // Au-dessus du voile et de la feuille (Modal MUI, 1300).
    zIndex: '1301',
    pointerEvents: 'none',
  })
  document.body.appendChild(bande)
}

const retirer = () => {
  annulerMinuteurs()
  retirerBande()
  poserMetas(colors[mode()].bg)
  const style = document.body.style
  if (!style.backgroundColor) {
    nettoyerBody()
    return
  }
  if (style.transition !== 'none') {
    // B : retour au fond en 180 ms, puis plus de style en ligne.
    style.transition = transition('background-color', DURATION.close)
    style.backgroundColor = colors[mode()].bg
    minuteur = setTimeout(() => {
      minuteur = null
      nettoyerBody()
    }, DURATION.close)
    return
  }
  // A : retour immédiat au fond, transition du body rétablie une image plus tard,
  // sinon elle rejouerait le changement.
  style.removeProperty('background-color')
  image = requestAnimationFrame(() => {
    image = null
    style.removeProperty('transition')
  })
}

/** Une feuille s'ouvre. Compte les feuilles empilées : seule la première agit. */
export const ouvrirFeuille = () => {
  ouvertes += 1
  if (ouvertes === 1) appliquer()
}

/** Une feuille se ferme. La dernière remet le body, les metas et retire la bande. */
export const fermerFeuille = () => {
  if (ouvertes === 0) return
  ouvertes -= 1
  if (ouvertes === 0) retirer()
}
