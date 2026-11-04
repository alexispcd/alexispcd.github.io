import { Box, Typography } from '@mui/material'
import { space } from '../../../styles/tokens'
import Carte from '../../../ui/Carte'
import LigneSaisie from '../../../ui/LigneSaisie'
import BarreAttente from '../../../ui/BarreAttente'
import { DUREES } from '../../../lib/durees'
import { formatGoalTime, formatPace, formatShortDay } from '../constants'

const PHRASE_LISTE = 'Trouvées sur Coros autour du créneau. Plusieurs si la séance a été enregistrée en morceaux (3 au plus).'
const PHRASE_EXPIREE = 'La connexion à Coros a expiré. Reconnecte-la pour retrouver ton activité, ou indique le jour.'
const PHRASE_ECHEC = 'La recherche de tes activités n\'a pas abouti.'

// Distance à deux décimales avec une virgule (« 9,58 km ») : formatKm n'en garde qu'une.
const km = (m) => (m ? `${(m / 1000).toFixed(2).replace('.', ',')} km` : null)

/** Sous-ligne d'une activité : « 9,58 km · 49:29 · 5:10 /km ». */
const chiffres = (c) => [
  km(c.distance_m),
  formatGoalTime(c.duration_sec),
  c.avg_pace_sec ? `${formatPace(c.avg_pace_sec)} /km` : null,
].filter(Boolean).join(' · ')

const phraseVide = (plage) => (plage
  ? `Rien trouvé sur Coros ${plage}. Indique le jour de la séance.`
  : 'Rien trouvé sur Coros. Indique le jour de la séance.')

/**
 * Partie « Activité » de la page « Valider la séance » de Training.
 * - etat : 'recherche' | 'liste' | 'vide' | 'expiree' | 'echec'.
 * - attente : props de visibilité de la BarreAttente de la recherche (useFinAttente).
 * - candidats, selection ({ ids, sans }), onActivite(labelId), onSans : liste à cocher.
 * - jour (yyyy-MM-dd), onJour : ligne « Jour de la séance », qui ouvre la feuille Date.
 * - plage : texte de la fenêtre de recherche (« entre le lun 2 et le mer 4 nov »).
 * - onReconnecter, onReessayer : lignes de la connexion expirée et de l'échec.
 */
const BlocActivite = ({
  etat, attente, candidats, selection, onActivite, onSans, jour, onJour, plage, onReconnecter, onReessayer,
}) => {
  const ligneJour = (
    <LigneSaisie type="choix" libelle="Jour de la séance" valeur={formatShortDay(jour)} onClick={onJour} />
  )

  let phrase
  let contenu
  if (etat === 'recherche') {
    phrase = 'Recherche sur Coros autour du créneau.'
    contenu = (
      <Box sx={{ px: space[14], py: space[16] }}>
        <BarreAttente place="section" phrase="Recherche des activités" duree={DUREES.rechercheActivites} {...attente} />
      </Box>
    )
  } else if (etat === 'liste') {
    phrase = PHRASE_LISTE
    contenu = (
      <>
        {candidats.map((c) => (
          <LigneSaisie
            key={c.labelId}
            type="cocher"
            double
            libelle={formatShortDay(c.date)}
            sousLigne={chiffres(c) || null}
            coche={!selection.sans && selection.ids.includes(c.labelId)}
            onClick={() => onActivite(c.labelId)}
          />
        ))}
        <LigneSaisie
          type="cocher"
          double
          libelle="Sans activité"
          sousLigne="Tu indiques le jour, rien n'est analysé"
          coche={selection.sans}
          onClick={onSans}
        />
        {selection.sans && ligneJour}
      </>
    )
  } else if (etat === 'expiree') {
    phrase = PHRASE_EXPIREE
    contenu = (
      <>
        <LigneSaisie type="choix" libelle="Reconnecter Coros" onClick={onReconnecter} />
        {ligneJour}
      </>
    )
  } else if (etat === 'echec') {
    phrase = PHRASE_ECHEC
    contenu = (
      <>
        <LigneSaisie type="choix" libelle="Réessayer" onClick={onReessayer} />
        {ligneJour}
      </>
    )
  } else {
    phrase = phraseVide(plage)
    contenu = ligneJour
  }

  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
      <Typography variant="etiquette" component="h2" sx={{ color: 'muted', px: space[4] }}>Activité</Typography>
      <Typography variant="secondaire" sx={{ color: 'muted', px: space[4] }}>{phrase}</Typography>
      <Carte sansMarge>{contenu}</Carte>
    </Box>
  )
}

export default BlocActivite
