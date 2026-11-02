import { Box } from '@mui/material'
import { radius, space } from '../styles/tokens'

// Récupérations : zone-qualite-soft pour une séance de qualité, la teinte de la zone sinon.
const COULEUR = {
  calme: () => 'warm',
  effort: (zone) => `zone-${zone}`,
  recup: (zone) => (zone === 'qualite' ? 'zone-qualite-soft' : `zone-${zone}-tint`),
}

/**
 * Structure d'une séance : un segment par étape, de longueur proportionnelle à sa
 * durée, séparés de 2 px. Aucun mouvement : c'est une description.
 * - segments : [{ duree, type: 'calme' | 'effort' | 'recup' }] (échauffement et retour
 *   au calme en 'calme'). Une étape en distance : distance × allure cible.
 * - zone : 'facile', 'qualite' ou 'longue'.
 * - petit : 8 px (widget) au lieu de 12.
 * - label : obligatoire, la séance en toutes lettres pour le lecteur d'écran.
 */
const BarreStructure = ({ segments, zone = 'facile', petit = false, label, sx }) => (
  <Box
    role="img"
    aria-label={label}
    sx={{ display: 'flex', gap: space[2], height: petit ? '8px' : '12px', ...sx }}
  >
    {segments.map((s, i) => (
      <Box
        key={i}
        sx={{
          flex: `${s.duree} 1 0`,
          minWidth: space[2],
          borderRadius: radius.segment,
          bgcolor: (COULEUR[s.type] ?? COULEUR.effort)(zone),
        }}
      />
    ))}
  </Box>
)

export default BarreStructure
