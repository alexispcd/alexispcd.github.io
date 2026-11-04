import { Box, Typography } from '@mui/material'
import { space, textStyles } from '../styles/tokens'
import FeuilleFlottante from './FeuilleFlottante'
import Calendrier from './Calendrier'

/**
 * FeuilleFlottante usage Date : titre en 17 px gras et ce que la date concerne en
 * secondaire, le Calendrier du mois, ses légendes, puis la ligne qui confirme ;
 * second bloc « Annuler ».
 * - ouverte, onFermer : comme FeuilleFlottante.
 * - titre, sousTitre (facultatif).
 * - mois, onMois, valeur, min, max, creneau, aujourdhui, onChoisir : props du Calendrier
 *   (le consommateur tient le mois et la valeur).
 * - ligne : { libelle, onClick }, la ligne qui confirme (« Envoyer le ven 30 oct », « Valider »).
 * - legendes : textes en legende muted sous la grille, écrits par le consommateur.
 * Les props restent celles du consommateur pendant la descente : il garde ses valeurs
 * après la fermeture pour que la feuille ne se vide pas en partant.
 */
const FeuilleDate = ({
  ouverte,
  onFermer,
  titre,
  sousTitre,
  mois,
  onMois,
  valeur,
  min,
  max,
  creneau,
  aujourdhui,
  onChoisir,
  ligne,
  legendes = [],
}) => {
  const textes = legendes.filter(Boolean)
  return (
    <FeuilleFlottante
      ouverte={ouverte}
      onFermer={onFermer}
      libelleAria={titre}
      lignes={ligne ? [ligne] : []}
      fermerLibelle="Annuler"
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4], pt: space[16], px: space[16], pb: space[4] }}>
        <Typography component="h2" sx={{ ...textStyles['titre-barre'], fontWeight: 700 }}>{titre}</Typography>
        {sousTitre && <Typography variant="secondaire" sx={{ color: 'muted' }}>{sousTitre}</Typography>}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', px: space[12], pb: space[12] }}>
        <Calendrier
          mois={mois}
          onMois={onMois}
          valeur={valeur}
          min={min}
          max={max}
          creneau={creneau}
          aujourdhui={aujourdhui}
          onChoisir={onChoisir}
        />
        {textes.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', pt: space[8], px: space[8] }}>
            {textes.map((t) => (
              <Typography key={t} variant="legende" sx={{ color: 'muted' }}>{t}</Typography>
            ))}
          </Box>
        )}
      </Box>
    </FeuilleFlottante>
  )
}

export default FeuilleDate
