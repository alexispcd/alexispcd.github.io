import { Box, Typography } from '@mui/material'
import { size, space, textStyles } from '../../../styles/tokens'
import Bouton from '../../../ui/Bouton'
import Carte from '../../../ui/Carte'

const valeurSx = { ...textStyles.chiffre, fontVariantNumeric: 'tabular-nums' }

// Une case du récapitulatif : étiquette, puis la valeur (et son unité en muted).
const tuile = (etiquette, valeur, unite) => (
  <Box key={etiquette} sx={{ display: 'flex', flexDirection: 'column', gap: space[4], minWidth: 0 }}>
    <Typography variant="etiquette" sx={{ color: 'muted' }}>{etiquette}</Typography>
    <Typography component="span" sx={valeurSx}>
      {valeur}
      {unite && <Box component="span" sx={{ ...textStyles.secondaire, fontWeight: 600, color: 'muted' }}>{` ${unite}`}</Box>}
    </Typography>
  </Box>
)

/**
 * Fin de séance dans le player : « Séance terminée », la phrase, le récapitulatif
 * (Temps réel, Estimé, Exercices), puis « Valider la séance » (`ink`) et « Fermer »
 * en bouton texte. Pas de coche.
 */
const EcranFin = ({ tempsReel, minutes, exercices, onValider, onFermer }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[24], flex: '1 0 auto' }}>
    <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: space[24], flex: '1 0 auto' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
        <Typography component="h2" sx={textStyles['titre-player']}>Séance terminée</Typography>
        <Typography variant="secondaire" sx={{ color: 'muted' }}>Beau travail. Enregistre ton ressenti pour suivre ta progression.</Typography>
      </Box>
      <Carte sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: space[8] }}>
        {tuile('Temps réel', tempsReel)}
        {tuile('Estimé', `≈ ${minutes}`, 'min')}
        {tuile('Exercices', String(exercices))}
      </Carte>
    </Box>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8], flexShrink: 0 }}>
      <Bouton
        variante="ink"
        niveau="page"
        pleineLargeur
        onClick={onValider}
        sx={{ ...textStyles['titre-barre'], fontWeight: 700, height: size.player }}
      >
        Valider la séance
      </Bouton>
      <Bouton variante="texte" petit pleineLargeur onClick={onFermer} sx={{ ...textStyles['corps-fort'] }}>Fermer</Bouton>
    </Box>
  </Box>
)

export default EcranFin
