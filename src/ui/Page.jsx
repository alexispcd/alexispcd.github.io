import { Box } from '@mui/material'
import { HEADER_HEIGHT } from '../components/AppHeader'
import { SPACE_BAS, space } from '../styles/tokens'

/**
 * Page qui défile dans son propre conteneur, sans rebond : gouttière space-16,
 * colonne espacée de `gap` (12 par défaut), marge basse SPACE_BAS.
 * - Haut : sous la barre du haut (48 px) plus 8 px ; `sansBarre` (Accueil) : 16 px.
 * - children : les groupes frères de la page, écartés par `gap`.
 * - bas : facultatif, la BarreBas de la page, posée en dernier enfant du conteneur
 *   qui défile (sticky) ; le contenu garde alors 24 px sous lui au lieu de SPACE_BAS.
 */
const Page = ({ sansBarre = false, gap = space[12], bas = null, children, sx }) => (
  <Box sx={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'none', display: 'flex', flexDirection: 'column' }}>
    <Box
      sx={{
        flex: '1 0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap,
        px: space[16],
        pt: sansBarre ? space[16] : `calc(${HEADER_HEIGHT}px + ${space[8]})`,
        pb: bas ? space[24] : SPACE_BAS,
        ...sx,
      }}
    >
      {children}
    </Box>
    {bas}
  </Box>
)

export default Page
