import { Box, ButtonBase, Typography } from '@mui/material'
import { radius, space, textStyles } from '../styles/tokens'
import { WIDGET_SX } from './widget'
import BarreStructure from './BarreStructure'

const LIGNE_COUPEE = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
// Texte replié sur deux lignes au plus.
const DEUX_LIGNES = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
const SECONDAIRE_FORT = { ...textStyles.secondaire, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }

const Point = ({ couleur }) => (
  <Box component="span" sx={{ width: '8px', height: '8px', borderRadius: radius.pill, bgcolor: couleur, flexShrink: 0 }} />
)

/**
 * Widget de l'Accueil qui montre la séance de course du jour. Toute la surface est un
 * bouton (`onClick`, `label` en toutes lettres), appui du thème (calque à 14 %).
 * - zone : 'facile', 'qualite', 'longue', ou null (libellé muted, sans point coloré).
 * - repos : point `track` devant le libellé.
 * - libelle, valeur (chiffre-widget), barree (valeur muted barrée), sousLigne.
 * - bas : { segments, duree } (structure et durée), { verdict, titre } (séance faite),
 *   { titre, texte } (semaine prochaine), { titre, prochaine: { zone, titre, quand } }.
 */
const WidgetSeance = ({ zone, repos = false, libelle, valeur, barree = false, sousLigne, bas, onClick, label, sx }) => {
  const couleur = zone ? `zone-${zone}` : 'muted'
  return (
    <ButtonBase onClick={onClick} aria-label={label} sx={{ ...WIDGET_SX, ...sx }}>
      <Typography variant="legende" component="span" sx={{ display: 'flex', alignItems: 'center', gap: space[8], fontWeight: 600, color: couleur }}>
        {(zone || repos) && <Point couleur={zone ? couleur : 'track'} />}
        {libelle}
      </Typography>
      <Typography
        variant="chiffre-widget"
        component="span"
        sx={{
          ...LIGNE_COUPEE,
          flexShrink: 0,
          mt: bas?.verdict ? 0 : space[4],
          fontVariantNumeric: 'tabular-nums',
          ...(barree ? { color: 'muted', textDecoration: 'line-through', textDecorationThickness: '2px' } : {}),
        }}
      >
        {valeur}
      </Typography>
      {sousLigne && (
        <Typography variant="secondaire" component="span" sx={{ ...DEUX_LIGNES, color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
          {sousLigne}
        </Typography>
      )}
      {bas && (
        <Box component="span" sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: bas.verdict ? space[2] : space[8], minWidth: 0, flexShrink: 0 }}>
          {bas.segments && (
            <>
              <BarreStructure segments={bas.segments} zone={zone ?? 'facile'} petit label="Structure de la séance" />
              {bas.duree && <Box component="span" sx={SECONDAIRE_FORT}>{bas.duree}</Box>}
            </>
          )}
          {bas.verdict && (
            <>
              {/* Verdict sur deux lignes : le titre de la séance reste sur une seule. */}
              <Box component="span" sx={{ ...SECONDAIRE_FORT, ...DEUX_LIGNES }}>{bas.verdict}</Box>
              <Typography variant="secondaire" component="span" sx={{ ...LIGNE_COUPEE, color: 'muted' }}>{bas.titre}</Typography>
            </>
          )}
          {!bas.segments && !bas.verdict && (
            <>
              <Typography variant="legende" component="span" sx={{ fontWeight: 600, color: 'muted' }}>{bas.titre}</Typography>
              {bas.texte && <Box component="span" sx={{ ...SECONDAIRE_FORT, ...LIGNE_COUPEE }}>{bas.texte}</Box>}
              {bas.prochaine && (
                <Box component="span" sx={{ ...SECONDAIRE_FORT, display: 'flex', alignItems: 'center', gap: space[8], minWidth: 0 }}>
                  <Point couleur={`zone-${bas.prochaine.zone}`} />
                  <Box component="span" sx={LIGNE_COUPEE}>{`${bas.prochaine.titre} ${bas.prochaine.quand}`}</Box>
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </ButtonBase>
  )
}

export default WidgetSeance
