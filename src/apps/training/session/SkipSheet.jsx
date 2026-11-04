import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import { cleanText, formatShortDay, isCorosCopyUpcoming } from '../constants'

/** Phrase de la confirmation « Sauter » (vue 10b) ; la montre seulement si la copie est à venir. */
const titreSaut = (session) => {
  if (!session) return ''
  const montre = isCorosCopyUpcoming(session)
    ? ` Elle reste sur ta montre (${formatShortDay(session.coros_workout_date)}) : supprime-la dans l'app Coros.`
    : ''
  return `Tu sautes ${cleanText(session.title)}.${montre} Adapter les séances des 10 prochains jours pour compenser ?`
}

/**
 * Confirmation « Sauter » d'une séance Training, partagée par la page séance et le
 * dashboard. Rien n'est écrit avant le choix : « Annuler » ou le voile ferment seuls.
 */
const SkipSheet = ({ session, ouverte, onFermer, onAdapter, onSansAdapter }) => (
  <FeuilleFlottante
    ouverte={ouverte}
    onFermer={onFermer}
    titre={titreSaut(session)}
    lignes={[
      { libelle: 'Sauter et adapter', onClick: onAdapter },
      { libelle: 'Sauter sans adapter', onClick: onSansAdapter },
    ]}
    fermerLibelle="Annuler"
  />
)

export default SkipSheet
