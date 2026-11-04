import { Box, Typography } from '@mui/material'
import { space, textStyles } from '../../../styles/tokens'
import BarreProgression from '../../../ui/BarreProgression'
import Carte from '../../../ui/Carte'
import MarqueSeance from '../../../ui/MarqueSeance'
import { useValeurAnimee } from '../../../ui/useValeurAnimee'
import { libelleSemaine } from '../accueil'

const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const NOMS_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']

/** Carte « Cette semaine » : compte, barre plafonnée à l'objectif, sept jours. */
const SemaineCarte = ({ semaine, objectif, today }) => {
  const compte = useValeurAnimee(semaine.compte)
  return (
    <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[8] }}>
        <Typography variant="titre-section" component="h2">Cette semaine</Typography>
        <Typography variant="legende" sx={{ color: 'muted' }}>{libelleSemaine(semaine.lundi)}</Typography>
      </Box>
      <Carte sx={{ gap: space[12] }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[8] }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: space[4], fontVariantNumeric: 'tabular-nums' }}>
            <Typography variant="chiffre-widget" component="span">{compte}</Typography>
            <Typography variant="secondaire" component="span" sx={{ color: 'muted' }}>
              {`/ ${objectif} séance${objectif > 1 ? 's' : ''}`}
            </Typography>
          </Box>
          {semaine.atteint && (
            <Typography variant="secondaire" component="span" sx={{ fontWeight: 600 }}>Objectif atteint</Typography>
          )}
        </Box>
        <BarreProgression
          widget
          valeur={Math.min(semaine.compte, objectif)}
          max={objectif}
          label={`${semaine.compte} séance${semaine.compte > 1 ? 's' : ''} sur ${objectif} cette semaine`}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: space[2], pt: space[2] }}>
          {LETTRES.map((lettre, i) => {
            const aujourdhui = semaine.dates[i] === today
            return (
              <Box key={semaine.dates[i]} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[4] }}>
                <Typography
                  component="span"
                  aria-hidden="true"
                  sx={{
                    ...textStyles.etiquette,
                    letterSpacing: 0,
                    fontWeight: aujourdhui ? 700 : 500,
                    color: aujourdhui ? 'ink' : 'muted',
                  }}
                >
                  {lettre}
                </Typography>
                <MarqueSeance
                  zone="ink"
                  etat={semaine.jours[i] ? 'faite' : 'aucune'}
                  label={`${NOMS_JOURS[i]}${aujourdhui ? ", aujourd'hui" : ''} : ${semaine.jours[i] ? 'séance faite' : 'pas de séance'}`}
                />
              </Box>
            )
          })}
        </Box>
      </Carte>
    </Box>
  )
}

export default SemaineCarte
