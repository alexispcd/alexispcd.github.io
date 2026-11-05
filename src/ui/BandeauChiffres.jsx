import { Box, Typography } from '@mui/material'
import { radius, space, textStyles } from '../styles/tokens'
import { useValeurAnimee } from './useValeurAnimee'

// Valeur d'un plan passé : 17 px, graisse 700, tabulaire.
const VALEUR_PETITE = { fontSize: textStyles['titre-barre'].fontSize, lineHeight: textStyles['titre-barre'].lineHeight, fontWeight: 700 }

// Étiquette qui ne donne pas sa largeur à la colonne : coupée à la largeur de la valeur.
const SANS_LARGEUR = { width: 0, minWidth: '100%' }

/**
 * Cellule du bandeau. `nombre` (avec `formater`) : chiffre qui défile en 400 ms
 * depuis la valeur d'avant (useValeurAnimee), valeur finale exacte.
 */
const Cellule = ({ etiquette, valeur, nombre, formater = String, sous, petite, etiquetteSouple }) => {
  const anime = useValeurAnimee(nombre ?? 0)
  return (
    <Box sx={{ bgcolor: 'surface', py: space[12], px: space[14], display: 'flex', flexDirection: 'column', gap: space[4], minWidth: 0 }}>
      <Typography variant="etiquette" noWrap sx={{ display: 'block', color: 'muted', ...(etiquetteSouple ? SANS_LARGEUR : {}) }}>
        {etiquette}
      </Typography>
      <Typography variant="chiffre" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', ...(petite ? VALEUR_PETITE : {}) }}>
        {nombre != null ? formater(anime) : valeur}
      </Typography>
      {sous && (
        <Typography variant="secondaire" sx={{ color: 'muted', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {sous}
        </Typography>
      )}
    </Box>
  )
}

/**
 * BandeauChiffres : trois chiffres côte à côte sous leur étiquette, en tête du
 * dashboard Training. Grille `auto auto minmax(0,1fr)` : les deux premières colonnes
 * à la largeur de leur contenu, la troisième prend le reste ; filets de 1 px (`line`).
 * - cellules : [{ etiquette, valeur | nombre + formater, sous }], trois au plus.
 * - petite : valeurs en 17 px, graisse 700 (plan passé).
 * - etiquetteSouple : la première étiquette (nom de la course) ne donne pas sa
 *   largeur à sa colonne et se coupe à celle de sa valeur.
 */
const BandeauChiffres = ({ cellules, petite = false, etiquetteSouple = false, sx }) => (
  <Box sx={{
    display: 'grid', gridTemplateColumns: 'auto auto minmax(0, 1fr)', gap: '1px',
    bgcolor: 'line', borderRadius: radius.card, overflow: 'hidden', flexShrink: 0,
    ...sx,
  }}>
    {cellules.slice(0, 3).map((c, i) => (
      <Cellule key={i} {...c} petite={petite} etiquetteSouple={etiquetteSouple && i === 0} />
    ))}
  </Box>
)

export default BandeauChiffres
