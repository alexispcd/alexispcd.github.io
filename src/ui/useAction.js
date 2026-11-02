import { useRef, useState } from 'react'
import { PAS_DE_CONNEXION, estErreurReseau } from '../lib/reseau'
import { useMessage } from './useMessage'
import { useFinAttente } from './useFinAttente'

const texteDe = (source, argument) => (typeof source === 'function' ? source(argument) : source)

/**
 * Action réseau avec attente et message de fin.
 * - attente : phrase de la BarreAttente ; duree : durée habituelle (src/lib/durees.js).
 * - succes : texte, (valeur) => texte, ou rien (pas de message).
 * - echec : texte ou (erreur) => texte ; un échec réseau dit toujours PAS_DE_CONNEXION.
 * Renvoie { lancer, enCours, barre } : `barre` regroupe les props de BarreAttente
 * ({ phrase, duree, visible, fini, onFin }). lancer(fn) renvoie { ok, valeur } et ne
 * lève jamais ; un second appel pendant le premier est ignoré. Le message part à la
 * réponse, sans attendre la fin de la barre.
 */
export const useAction = ({ attente, duree, succes, echec } = {}) => {
  const { afficher } = useMessage()
  const [enCours, setEnCours] = useState(false)
  const occupe = useRef(false)
  const { visible, fini, onFin } = useFinAttente(enCours)

  const dire = (texte) => {
    if (texte) afficher(texte)
  }

  const lancer = async (fn) => {
    if (occupe.current) return { ok: false }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      afficher(PAS_DE_CONNEXION)
      return { ok: false }
    }
    occupe.current = true
    setEnCours(true)
    try {
      const valeur = await fn()
      try {
        dire(texteDe(succes, valeur))
      } catch (e) {
        console.error('[useAction] message de succès :', e)
      }
      return { ok: true, valeur }
    } catch (erreur) {
      console.error('[useAction]', erreur)
      try {
        dire(estErreurReseau(erreur) ? PAS_DE_CONNEXION : texteDe(echec, erreur))
      } catch (e) {
        console.error('[useAction] message d\'échec :', e)
      }
      return { ok: false }
    } finally {
      occupe.current = false
      setEnCours(false)
    }
  }

  return { lancer, enCours, barre: { phrase: attente, duree, visible, fini, onFin } }
}
