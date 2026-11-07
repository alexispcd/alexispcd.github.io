import { Box, ButtonBase, Typography } from '@mui/material'
import { space } from '../styles/tokens'
import BarreProgression from './BarreProgression'
import MarqueSeance from './MarqueSeance'
import { useValeurAnimee } from './useValeurAnimee'
import { WIDGET_SX } from './widget'

// Nombre avec une décimale et virgule française : 35,2.
const uneDecimale = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',')

/**
 * Widget de l'Accueil qui résume la semaine en cours : « Semaine 5 », km faits (qui
 * défilent en 400 ms) sur km prévus, BarreProgression de 5 px plafonnée, puis les 7
 * jours en initiales, aujourd'hui en gras ink, une MarqueSeance par séance (petit
 * point track sans séance). Toute la surface est un bouton (`onClick`, `label`).
 * - numero, faits et prevus (km), part (0 à 1).
 * - jours : [{ initiale, iso, aujourdhui, marque: { etat, zone } | null }].
 */
const WidgetSemaine = ({ numero, faits, prevus, part, jours, onClick, label, sx }) => {
  const anime = useValeurAnimee(faits)
  return (
    <ButtonBase onClick={onClick} aria-label={label} sx={{ ...WIDGET_SX, ...sx }}>
      <Typography variant="legende" component="span" sx={{ fontWeight: 600, color: 'muted' }}>
        {`Semaine ${numero ?? ''}`}
      </Typography>
      <Box component="span" sx={{ display: 'flex', alignItems: 'baseline', gap: space[4], mt: space[4], fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        <Typography variant="chiffre-widget" component="span">{uneDecimale(anime)}</Typography>
        <Typography variant="secondaire" component="span" sx={{ color: 'muted' }}>{`/ ${uneDecimale(prevus)} km`}</Typography>
      </Box>
      <BarreProgression valeur={part * 100} max={100} widget label={`${Math.round(part * 100)} % des km prévus`} />
      <Box component="span" sx={{ mt: 'auto', display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: space[2] }}>
        {jours.map((j) => (
          <Box key={j.iso} component="span" sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[4] }}>
            <Typography
              variant="etiquette"
              component="span"
              sx={{ textTransform: 'none', letterSpacing: 0, fontWeight: j.aujourdhui ? 700 : 500, color: j.aujourdhui ? 'ink' : 'muted' }}
            >
              {j.initiale}
            </Typography>
            {j.marque
              ? <MarqueSeance etat={j.marque.etat} zone={j.marque.zone} />
              : <MarqueSeance etat="aucune" />}
          </Box>
        ))}
      </Box>
    </ButtonBase>
  )
}

export default WidgetSemaine
