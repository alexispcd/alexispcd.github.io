import { Box, Typography, Divider } from '@mui/material'
import AppCard from '../../components/AppCard'
import { HEADER_HEIGHT } from '../../components/AppHeader'

const categories = [
  {
    label: 'Sport',
    apps: [
      {
        id: 'cotes',
        name: 'Côtes',
        desc: 'Dénivelé pour séances running',
        icon: 'ti-trending-up',
        status: 'active',
        href: '/cotes',
      },
      {
        id: 'training',
        name: 'Training',
        desc: 'Plans et suivi Coros',
        icon: 'ti-run',
        status: 'soon',
        href: null,
      },
    ],
  },
  {
    label: 'Dev',
    apps: [
      {
        id: 'veille',
        name: 'Veille',
        desc: 'Ressources tech à suivre',
        icon: 'ti-rss',
        status: 'active',
        href: '/veille',
      },
    ],
  },
]

const Home = () => {
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
                {cat.apps.map(app => (
                  <AppCard key={app.id} app={app} />
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
