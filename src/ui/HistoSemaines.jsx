import { Box, ButtonBase, Typography } from '@mui/material'
import { keyframes } from '@emotion/react'
import Carte from './Carte'
import { radius, space, textStyles } from '../styles/tokens'
import { DURATION, EASE, transition } from '../styles/motion'
import { focusContour, sansMouvement } from './appui'

// Barres qui montent de 0 à leur hauteur à l'arrivée de l'écran ; un changement de
// hauteur ensuite (adaptation) se pose d'un coup.
const monte = keyframes`from { height: 0; }`
const fondu = keyframes`from { opacity: 0; } to { opacity: 1; }`

const HAUTEUR_BARRES = 112
const HAUTEUR_MAX = 84

const virgule = (n) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',')

/**
 * HistoSemaines : km prévus par semaine sur tout le plan, qui sert de sélecteur.
 * - semaines : [{ numero, km }] ; max : km de la plus grosse semaine.
 * - blocs : [{ libelle, debut, span }], colonnes de la grille (1 à n).
 * - selection : numéro de la semaine sélectionnée ; onChoisir(numero).
 * Toute la colonne (barre et numéro) est touchable. Barres en `bar`, la sélectionnée
 * en `ink` avec sa valeur au-dessus, à une décimale.
 */
const HistoSemaines = ({ semaines, max, blocs = [], selection, onChoisir, sx }) => {
  const colonnes = `repeat(${Math.max(1, semaines.length)}, minmax(0, 1fr))`
  return (
    <Carte sx={{ gap: space[8], flexShrink: 0, ...sx }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: space[8] }}>
        <Typography variant="etiquette" noWrap sx={{ color: 'muted' }}>Plan, km prévus</Typography>
        <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          max {virgule(max)} km
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: colonnes, gap: space[8] }}>
        {semaines.map((s) => {
          const choisie = s.numero === selection
          const hauteur = max > 0 ? Math.round((HAUTEUR_MAX * s.km) / max) : 0
          return (
            <ButtonBase
              key={s.numero}
              aria-label={`Voir la semaine ${s.numero}`}
              aria-pressed={choisie}
              onClick={() => onChoisir(s.numero)}
              sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-end',
                gap: space[4], minWidth: 0, borderRadius: radius.segment, color: 'ink',
                ...focusContour,
              }}
            >
              <Box sx={{ height: `${HAUTEUR_BARRES}px`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center', gap: space[4] }}>
                <Box
                  component="span"
                  key={choisie ? `v${s.numero}` : undefined}
                  sx={{
                    ...textStyles.legende, fontWeight: 700, height: '15px', lineHeight: '15px',
                    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                    animation: `${fondu} ${DURATION.fade}ms ${EASE}`,
                    ...sansMouvement(),
                  }}
                >
                  {choisie ? virgule(s.km) : ''}
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: 'block', width: '100%', height: `${hauteur}px`, borderRadius: radius.segment,
                    bgcolor: choisie ? 'ink' : 'bar',
                    animation: `${monte} ${DURATION.fill}ms ${EASE}`,
                    transition: transition('background-color', DURATION.fade),
                    ...sansMouvement(),
                  }}
                />
              </Box>
              <Typography
                component="span"
                sx={{
                  ...textStyles.legende, textAlign: 'center',
                  fontWeight: choisie ? 700 : 500, color: choisie ? 'ink' : 'muted',
                  fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                  transition: transition('color', DURATION.fade),
                  ...sansMouvement(),
                }}
              >
                S{s.numero}
              </Typography>
            </ButtonBase>
          )
        })}
      </Box>

      {blocs.length > 0 && (
        <Box sx={{ display: 'grid', gridTemplateColumns: colonnes, gap: space[8] }}>
          {blocs.map((b) => (
            <Typography
              key={`${b.debut}-${b.libelle}`}
              component="span"
              noWrap
              sx={{
                gridColumn: `${b.debut} / span ${b.span}`, minWidth: 0,
                borderTop: '2px solid', borderColor: 'muted', pt: space[4],
                fontSize: textStyles.etiquette.fontSize, lineHeight: textStyles.etiquette.lineHeight, color: 'muted',
              }}
            >
              {b.libelle}
            </Typography>
          ))}
        </Box>
      )}
    </Carte>
  )
}

export default HistoSemaines
