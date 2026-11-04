import { Box } from '@mui/material'
import { HEADER_HEIGHT } from '../components/AppHeader'
import { SPACE_BAS, space } from '../styles/tokens'

/**
 * Page qui défile dans son propre conteneur, sans rebond : gouttière space-16,
 * colonne espacée de `gap` (12 par défaut), marge basse SPACE_BAS.
 * - Haut : sous la barre du haut (60 px) plus 8 px ; `sansBarre` (Accueil) : 16 px.
 * - children : les groupes frères de la page, écartés par `gap`.
 */
const Page = ({ sansBarre = false, gap = space[12], children, sx }) => (
  <Box sx={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'none' }}>
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap,
        px: space[16],
        pt: sansBarre ? space[16] : `calc(${HEADER_HEIGHT}px + ${space[8]})`,
        pb: SPACE_BAS,
        ...sx,
      }}
    >
      {children}
    </Box>
  </Box>
)

export default Page
