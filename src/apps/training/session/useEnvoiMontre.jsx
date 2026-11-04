import { useState } from 'react'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import FeuilleDate from '../../../ui/FeuilleDate'
import { moisDe } from '../../../ui/calendrier'
import { useAction } from '../../../ui/useAction'
import { DUREES } from '../../../lib/durees'
import { texteErreur } from '../../../lib/reseau'
import { formatShortDayAnnee } from '../../../lib/dates'
import { pushToCoros } from '../../../lib/training'
import {
  cleanText, todayISO, addDaysISO, COROS_PUSH_WINDOW_DAYS, ZONE_DAYS, joursCreneau, formatShortDay,
} from '../constants'

const RECHARGEMENT = 'Les données n\'ont pas pu être rechargées. Réessaie.'
const NON_CONNECTE = 'Coros n\'est pas connecté. Connecte-le pour envoyer tes séances sur ta montre.'

// Date proposée : la date prévue, ramenée à aujourd'hui si elle est passée, et
// bornée à la fenêtre Coros.
const dateProposee = (session, aujourdhui, max) => {
  const prevue = session?.scheduled_date
  if (!prevue || prevue < aujourdhui) return aujourdhui
  return prevue > max ? max : prevue
}

/**
 * Envoi d'une séance sur la montre, partagé par la page séance et le dashboard.
 * - onEnvoye : recharge la page après l'envoi ; son échec dit RECHARGEMENT.
 * Renvoie { ouvrir(session), action, feuilles } :
 * - ouvrir : ouvre la feuille Date (Calendrier, bornes d'aujourd'hui à J+90) ;
 * - action : le useAction de l'envoi, dont la page montre la carte d'attente ;
 * - feuilles : la feuille Date et la feuille « Coros n'est pas connecté », à monter.
 * Aucune lecture du statut Coros avant l'envoi : le serveur rafraîchit le jeton, et
 * répond 409 coros_not_connected s'il n'y en a pas.
 */
export const useEnvoiMontre = ({ onEnvoye } = {}) => {
  const navigate = useAppNavigate()
  const [feuille, setFeuille] = useState(null) // 'date' | 'connexion' | null
  // Gardé après la fermeture : la feuille garde son contenu pendant qu'elle descend.
  const [envoi, setEnvoi] = useState(null) // { session, aujourdhui, max, date, mois, creneau }

  const action = useAction({
    attente: 'Envoi sur ta montre',
    duree: DUREES.envoiMontre,
    succes: (v) => {
      if (!v || v.nonConnecte) return null
      if (v.erreurRechargement) return texteErreur(v.erreurRechargement, RECHARGEMENT)
      return v.res?.previous_copy?.upcoming
        ? 'Séance envoyée. Supprime l\'ancienne copie dans l\'app Coros.'
        : 'Séance envoyée sur ta montre'
    },
    echec: 'L\'envoi sur ta montre n\'a pas abouti. Réessaie.',
  })

  const ouvrir = (session) => {
    if (!session || action.enCours) return
    const aujourdhui = todayISO()
    const max = addDaysISO(aujourdhui, COROS_PUSH_WINDOW_DAYS)
    const date = dateProposee(session, aujourdhui, max)
    setEnvoi({
      session, aujourdhui, max, date, mois: moisDe(date),
      creneau: joursCreneau(session.scheduled_date, session.zone),
    })
    setFeuille('date')
  }

  const envoyer = async () => {
    const { session, date } = envoi
    const { ok, valeur } = await action.lancer(async () => {
      let res
      try {
        res = await pushToCoros(session.id, date)
      } catch (e) {
        // Pas de jeton Coros : aucun message d'échec, la feuille de connexion s'ouvre.
        if (e?.body?.code === 'coros_not_connected') return { nonConnecte: true }
        throw e
      }
      try {
        await onEnvoye?.(res)
      } catch (e) {
        return { res, erreurRechargement: e }
      }
      return { res }
    })
    if (ok && valeur?.nonConnecte) setFeuille('connexion')
  }

  const fermer = () => setFeuille(null)

  let feuilleDate = null
  if (envoi) {
    const { session, aujourdhui, max, date, mois, creneau } = envoi
    const dejaEnvoyee = Boolean(session.coros_workout_id)
    const titre = dejaEnvoyee ? 'Envoyer à une autre date' : 'Envoyer sur la montre'
    const nom = cleanText(session.title)
    const precision = dejaEnvoyee
      ? 'l\'ancienne copie reste sur ta montre : supprime-la dans l\'app Coros.'
      : (ZONE_DAYS[session.zone] ? `créneau ${ZONE_DAYS[session.zone]}` : '')
    const sousTitre = [nom, precision].filter(Boolean).join(' · ')
    const creneauVisible = creneau.some((j) => moisDe(j) === mois && j >= aujourdhui && j <= max)
    const borneVisible = moisDe(max) === mois

    feuilleDate = (
      <FeuilleDate
        ouverte={feuille === 'date'}
        onFermer={fermer}
        titre={titre}
        sousTitre={sousTitre}
        mois={mois}
        onMois={(m) => setEnvoi((e) => ({ ...e, mois: m }))}
        valeur={date}
        min={aujourdhui}
        max={max}
        creneau={creneau}
        aujourdhui={aujourdhui}
        onChoisir={(j) => setEnvoi((e) => ({ ...e, date: j }))}
        ligne={{ libelle: `Envoyer le ${formatShortDay(date)}`, onClick: envoyer }}
        legendes={[
          creneauVisible && 'En fond : les jours du créneau.',
          borneVisible && `Jusqu'au ${formatShortDayAnnee(max)}.`,
        ]}
      />
    )
  }

  const feuilles = (
    <>
      {feuilleDate}
      <FeuilleFlottante
        ouverte={feuille === 'connexion'}
        onFermer={fermer}
        titre={NON_CONNECTE}
        lignes={[{
          libelle: 'Connecter Coros',
          onClick: () => navigate('/training/settings', { direction: 'forward' }),
        }]}
      />
    </>
  )

  return { ouvrir, action, feuilles }
}
