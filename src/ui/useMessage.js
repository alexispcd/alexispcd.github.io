import { createContext, useContext, useEffect } from 'react'

// Contexte du Message, fourni par MessageProvider (monté dans src/App.jsx).
export const MessageCtx = createContext(null)

const SANS_FOURNISSEUR = {
  afficher: () => {},
  afficherFixe: () => {},
  retirerFixe: () => {},
  signalerBarreBas: () => {},
}

/**
 * Messages en bas de l'écran (voir MessageProvider) :
 * - afficher(texte) : 4 s ; un nouveau remplace l'ancien et relance la durée.
 * - afficherFixe({ texte, action: { libelle, onClick }, onFermer }) : reste
 *   jusqu'au toucher ; un message de 4 s passe devant le temps de sa durée.
 * - retirerFixe() : retire le message fixe.
 */
export const useMessage = () => {
  const ctx = useContext(MessageCtx) ?? SANS_FOURNISSEUR
  return { afficher: ctx.afficher, afficherFixe: ctx.afficherFixe, retirerFixe: ctx.retirerFixe }
}

/**
 * Signale une barre du bas fixe (`ref`) tant que `actif` est vrai : le Message se
 * pose alors 12 px au-dessus d'elle au lieu de SPACE_BAS. Mesure la distance entre
 * le haut de la barre et le bas de l'écran, à chaque changement de taille.
 */
export const useBarreBasMessage = (ref, actif = true) => {
  const { signalerBarreBas } = useContext(MessageCtx) ?? SANS_FOURNISSEUR
  useEffect(() => {
    const el = ref.current
    if (!actif || !el) return undefined
    const mesurer = () => {
      signalerBarreBas(Math.max(0, window.innerHeight - el.getBoundingClientRect().top))
    }
    // Le premier appel arrive dès l'observation.
    const observateur = new ResizeObserver(mesurer)
    observateur.observe(el)
    window.addEventListener('resize', mesurer)
    return () => {
      observateur.disconnect()
      window.removeEventListener('resize', mesurer)
      signalerBarreBas(null)
    }
  }, [ref, actif, signalerBarreBas])
}
