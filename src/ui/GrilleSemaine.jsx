import { Box, Typography } from '@mui/material'
import Carte from './Carte'
import BlocZone from './BlocZone'
import { radius, space, textStyles } from '../styles/tokens'

const SEPT = 'repeat(7, minmax(0, 1fr))'

/**
 * GrilleSemaine : les 7 jours de la semaine sélectionnée, puis un BlocZone par séance,
 * étalé sur les jours de son créneau.
 * - jours : [{ iso, jour: 'Lun', numero, aujourdhui }] ; aujourd'hui en ink, radius-inner.
 * - blocs : [{ id, colonne, intensite, libelle, titre, statut, coche }].
 * - onOuvrir(id) : taper un bloc ouvre la séance.
 * - vide : texte affiché à la place des blocs quand la semaine n'a pas de séance.
 * Changer de semaine remplace les blocs d'un coup.
 */
const GrilleSemaine = ({ jours, blocs, onOuvrir, vide, sx }) => (
  <Carte sx={{ gap: space[8], flexShrink: 0, ...sx }}>
    <Box sx={{ display: 'grid', gridTemplateColumns: SEPT, gap: space[4] }}>
      {jours.map((j) => (
        <Box
          key={j.iso}
          sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', py: space[4],
            borderRadius: radius.inner,
            ...(j.aujourdhui ? { bgcolor: 'ink', color: 'on-ink' } : { color: 'muted' }),
          }}
        >
          <Typography component="span" sx={{ ...textStyles.etiquette }}>{j.jour}</Typography>
          <Typography component="span" variant="corps-fort" sx={{ fontVariantNumeric: 'tabular-nums' }}>{j.numero}</Typography>
        </Box>
      ))}
    </Box>

    {blocs.length > 0 ? (
      <Box sx={{ display: 'grid', gridTemplateColumns: SEPT, gap: space[4] }}>
        {blocs.map((b) => (
          <BlocZone
            key={b.id}
            colonne={b.colonne}
            intensite={b.intensite}
            libelle={b.libelle}
            titre={b.titre}
            statut={b.statut}
            coche={b.coche}
            onClick={() => onOuvrir(b.id)}
          />
        ))}
      </Box>
    ) : (
      vide && (
        <Typography variant="secondaire" sx={{ color: 'muted', textAlign: 'center', py: space[8] }}>
          {vide}
        </Typography>
      )
    )}
  </Carte>
)

export default GrilleSemaine
