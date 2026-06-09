import { Box, Typography, IconButton, Tooltip, Divider } from '@mui/material'
import { DarkMode, LightMode } from '@mui/icons-material'
import AppCard from '../../components/AppCard'

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
        status: 'soon',
        href: null,
      },
    ],
  },
]

const Home = ({ dark, setDark }) => {
  return (
    <Box sx={{
      minHeight: '100vh',
      maxWidth: 720,
      mx: 'auto',
      px: 4,
      py: 6,
    }}>

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 6 }}>
        <Box>
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

        <Tooltip title={dark ? 'Mode clair' : 'Mode sombre'}>
          <IconButton onClick={() => setDark(!dark)} size="small" sx={{ mt: 0.5 }}>
            {dark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </IconButton>
        </Tooltip>
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
                <AppCard key={app.id} app={app} dark={dark} />
              ))}
            </Box>
          </Box>
        ))}
      </Box>

    </Box>
  )
}

export default Home
