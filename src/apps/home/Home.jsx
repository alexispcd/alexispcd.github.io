import { Box, Typography, Divider } from '@mui/material'
import AppCard from '../../components/AppCard'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { homeCategories } from '../registry'
import { useAppCtx } from '../../lib/context'

const Home = () => {
  const { access } = useAppCtx()
  const categories = homeCategories(access)

  return (
    <Box sx={{ height: '100%', overflowY: 'auto' }}>
      <Box sx={{ maxWidth: 720, mx: 'auto', px: 4, pt: `${HEADER_HEIGHT + 16}px`, pb: 6 }}>

        {/* Branding */}
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h1"
            sx={{
              fontFamily: '"DM Serif Display", serif',
              fontSize: '2.5rem',
              fontWeight: 400,
              lineHeight: 1,
              mb: 0.5,
              '& em': { fontStyle: 'italic' }
            }}
            dangerouslySetInnerHTML={{ __html: 'Le <em>Cairn</em>' }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
              variant="overline"
              sx={{ color: 'text.secondary', letterSpacing: '0.15em', fontSize: '0.65rem' }}
            >
              Mes outils perso
            </Typography>
            <Typography
              variant="overline"
              sx={{ color: 'text.disabled', letterSpacing: '0.1em', fontSize: '0.6rem' }}
            >
              v{__APP_VERSION__}
            </Typography>
          </Box>
        </Box>

        {categories.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Aucun module pour l'instant. Demande l'accès à l'administrateur.
          </Typography>
        )}

        {/* Catégories */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {categories.map(cat => (
            <Box key={cat.label}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Typography
                  variant="overline"
                  sx={{ color: 'text.disabled', letterSpacing: '0.15em', fontSize: '0.6rem', whiteSpace: 'nowrap' }}
                >
                  {cat.label}
                </Typography>
                <Divider sx={{ flex: 1 }} />
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
                {cat.modules.map(module => (
                  <AppCard key={module.id} module={module} />
                ))}
              </Box>
            </Box>
          ))}
        </Box>

      </Box>
    </Box>
  )
}

export default Home
