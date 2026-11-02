import { useEffect, useRef, useState } from 'react'
import { DURATION } from '../styles/motion'
import { useReduireAnimations } from './useReduireAnimations'

// Courbe du Design System, cubic-bezier(0.32, 0.72, 0, 1), évaluée en JavaScript
// pour que le chiffre suive la barre qui se remplit en CSS avec la même courbe.
const P1X = 0.32
const P1Y = 0.72
const P2X = 0
const P2Y = 1
const bezier = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3

const courbe = (x) => {
  // Recherche par dichotomie du t qui donne x, puis y(t).
  let lo = 0
  let hi = 1
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2
    if (bezier(mid, P1X, P2X) < x) lo = mid
    else hi = mid
  }
  return bezier((lo + hi) / 2, P1Y, P2Y)
}

/**
 * Chiffre qui défile entier par entier vers `cible`, depuis la valeur d'avant (0 à
 * la première arrivée), en `duree` ms (400 par défaut, 220 pour une barre liée à un
 * changement d'état). La valeur finale est exacte, décimales comprises. Avec
 * « Réduire les animations », la cible est rendue directement.
 */
export const useValeurAnimee = (cible, duree = DURATION.fill) => {
  const reduire = useReduireAnimations()
  const [affichee, setAffichee] = useState(0)
  // Dernière valeur affichée : point de départ de l'animation suivante.
  const depart = useRef(0)

  useEffect(() => {
    if (reduire) {
      depart.current = cible
      return undefined
    }
    const from = depart.current
    let debut = null
    let id = requestAnimationFrame(function pas(t) {
      if (debut === null) debut = t
      const p = Math.min(1, (t - debut) / duree)
      const v = p >= 1 ? cible : Math.round(from + (cible - from) * courbe(p))
      depart.current = v
      setAffichee(v)
      if (p < 1) id = requestAnimationFrame(pas)
    })
    return () => cancelAnimationFrame(id)
  }, [cible, duree, reduire])

  return reduire ? cible : affichee
}
