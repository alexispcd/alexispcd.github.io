import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, size, space, textStyles } from '../styles/tokens'
import { DURATION, transition } from '../styles/motion'
import { focusContour, sansMouvement } from './appui'
import { motEffort } from '../lib/feedback'

const NOTES = Array.from({ length: 10 }, (_, i) => i + 1)
const HAUTEUR_SEGMENT = '12px'
// Le segment visible est centré dans sa zone de toucher de 44 px : 16 px au-dessus.
const DECALAGE_SEGMENT = '16px'

/**
 * Saisie de l'effort ressenti, de 1 à 10, dans une carte : la note en 34 px et son mot,
 * puis dix segments de 12 px (ink jusqu'à la note, track après), chacun un bouton de
 * 44 px de haut. Pas encore noté : « ? » et « Touche la barre ».
 * - note : nombre de 1 à 10, ou null ; onChange(note) au toucher d'un segment.
 * Aucune couleur : l'effort n'est pas une intensité de course. Les segments passent en
 * fondu, la note change d'un coup.
 */
const BarreEffort = ({ note = null, onChange, sx }) => {
  const notee = note != null
  return (
    <Box sx={{ bgcolor: 'surface', borderRadius: radius.card, p: space[14], display: 'flex', flexDirection: 'column', ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: space[8] }}>
        <Typography component="span" aria-live="polite">
          <Box
            component="span"
            sx={{
              fontSize: textStyles['titre-app'].fontSize,
              lineHeight: textStyles['titre-app'].lineHeight,
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'ink',
            }}
          >
            {notee ? note : '?'}
          </Box>
          <Typography component="span" variant="secondaire" sx={{ color: 'muted' }}> / 10</Typography>
        </Typography>
        <Typography variant="corps-fort" component="span" sx={{ color: notee ? 'ink' : 'muted' }}>
          {notee ? motEffort(note) : 'Touche la barre'}
        </Typography>
      </Box>

      <Box role="group" aria-label="Effort ressenti" sx={{ display: 'flex', gap: space[2] }}>
        {NOTES.map((n) => {
          const plein = notee && n <= note
          return (
            <ButtonBase
              key={n}
              aria-label={`Effort ${n} sur 10`}
              aria-pressed={n === note || undefined}
              onClick={() => onChange?.(n)}
              sx={{
                flex: '1 1 0',
                minWidth: 0,
                height: size.cible,
                color: 'ink',
                // Calque d'appui du thème posé sur le segment visible, pas sur toute la zone.
                '&::after': {
                  inset: 'auto',
                  left: 0,
                  right: 0,
                  top: DECALAGE_SEGMENT,
                  height: HAUTEUR_SEGMENT,
                  borderRadius: radius.segment,
                },
                '&:focus-visible .segment, &.Mui-focusVisible .segment': focusContour['&:focus-visible, &.Mui-focusVisible'],
              }}
            >
              <Box
                className="segment"
                sx={{
                  width: '100%',
                  height: HAUTEUR_SEGMENT,
                  borderRadius: radius.segment,
                  bgcolor: plein ? 'ink' : 'track',
                  transition: transition('background-color', DURATION.fade),
                  ...sansMouvement(),
                }}
              />
            </ButtonBase>
          )
        })}
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="legende" sx={{ color: 'muted' }}>Facile</Typography>
        <Typography variant="legende" sx={{ color: 'muted' }}>Maximal</Typography>
      </Box>
    </Box>
  )
}

export default BarreEffort
