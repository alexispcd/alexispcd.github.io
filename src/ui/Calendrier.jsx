import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, size, space, textStyles } from '../styles/tokens'
import { DURATION, transition } from '../styles/motion'
import { focusContour, sansMouvement } from './appui'
import BoutonIcone from './BoutonIcone'
import { ChevronDroit, ChevronRetour } from './Icones'
import { grilleMois, libelleMois, moisDe, moisVoisin } from './calendrier'
import { formatShortDay } from '../lib/dates'

const LETTRES = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const DISQUE = '38px'
// Le disque est centré dans la cellule de 44 px : 3 px au-dessus et au-dessous.
const DECALAGE_DISQUE = '3px'

const chevron = {
  '&.Mui-disabled': { color: 'muted' },
}

/**
 * Grille d'un mois pour choisir un jour, posée dans une FeuilleFlottante (usage Date).
 * Le consommateur tient le mois affiché et écrit ses légendes sous la grille.
 * - mois : yyyy-MM affiché ; onMois(mois) au toucher d'un chevron.
 * - valeur : jour choisi (yyyy-MM-dd) ; onChoisir(jour) au toucher d'un jour.
 * - min, max : bornes facultatives, comprises ; les jours hors bornes sont désactivés.
 * - creneau : jours du créneau de la séance, en fond chip.
 * - aujourdhui : date du jour (todayISO), en graisse 800 sauf si elle est choisie.
 * Toujours 6 rangées, quel que soit le mois : les chevrons ne bougent pas sous le doigt.
 * Aucune couleur. Le jour choisi passe en fondu, le changement de mois se fait d'un coup.
 */
const Calendrier = ({ mois, onMois, valeur, min, max, creneau = [], aujourdhui, onChoisir }) => {
  const precedent = moisVoisin(mois, -1)
  const suivant = moisVoisin(mois, 1)
  // Un chevron s'éteint quand le mois voisin est entièrement hors bornes.
  const precedentEteint = Boolean(min) && precedent < moisDe(min)
  const suivantEteint = Boolean(max) && suivant > moisDe(max)
  const horsBornes = (jour) => (Boolean(min) && jour < min) || (Boolean(max) && jour > max)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pl: space[8] }}>
        <Typography variant="corps-fort" component="h3" aria-live="polite">{libelleMois(mois)}</Typography>
        <Box sx={{ display: 'flex' }}>
          <BoutonIcone label="Mois précédent" disabled={precedentEteint} onClick={() => onMois?.(precedent)} sx={chevron}>
            <ChevronRetour taille={20} />
          </BoutonIcone>
          <BoutonIcone label="Mois suivant" disabled={suivantEteint} onClick={() => onMois?.(suivant)} sx={chevron}>
            <ChevronDroit taille={20} />
          </BoutonIcone>
        </Box>
      </Box>

      {/* key : la grille est remontée à chaque mois, sans fondu d'un mois à l'autre. */}
      <Box key={mois} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', rowGap: space[2] }}>
        {LETTRES.map((l, i) => (
          <Typography
            key={`l${i}`}
            variant="etiquette"
            aria-hidden
            sx={{ textAlign: 'center', textTransform: 'none', color: 'muted', height: '20px' }}
          >
            {l}
          </Typography>
        ))}
        {grilleMois(mois).map((jour, i) => {
          if (!jour) return <Box key={`v${i}`} sx={{ height: size.cible }} />
          const choisi = jour === valeur
          const eteint = !choisi && horsBornes(jour)
          const dansCreneau = !choisi && !eteint && creneau.includes(jour)
          return (
            <ButtonBase
              key={jour}
              aria-label={formatShortDay(jour)}
              aria-pressed={choisi || undefined}
              disabled={horsBornes(jour)}
              onClick={() => onChoisir?.(jour)}
              sx={{
                height: size.cible,
                width: '100%',
                color: choisi ? 'on-ink' : 'ink',
                // Calque d'appui du thème (14 %) posé sur le disque, pas sur la cellule.
                '&::after': {
                  inset: 'auto',
                  top: DECALAGE_DISQUE,
                  left: `calc(50% - ${DISQUE} / 2)`,
                  width: DISQUE,
                  height: DISQUE,
                  borderRadius: radius.pill,
                },
                '&:focus-visible .disque, &.Mui-focusVisible .disque': focusContour['&:focus-visible, &.Mui-focusVisible'],
              }}
            >
              <Box
                className="disque"
                sx={{
                  width: DISQUE,
                  height: DISQUE,
                  borderRadius: radius.pill,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: textStyles['corps-fort'].fontSize,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: choisi ? 700 : (jour === aujourdhui ? 800 : 400),
                  bgcolor: choisi ? 'ink' : (dansCreneau ? 'chip' : 'transparent'),
                  color: choisi ? 'on-ink' : (eteint ? 'muted' : 'ink'),
                  opacity: eteint ? 0.45 : 1,
                  transition: transition(['background-color', 'color'], DURATION.fade),
                  ...sansMouvement(),
                }}
              >
                {Number(jour.slice(8))}
              </Box>
            </ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}

export default Calendrier
