import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { DarkMode, LightMode } from '@mui/icons-material'
import AppCard from '../../components/AppCard'

const apps = [
  {
    id: 'cotes-run',
    name: 'Côtes.Run',
    desc: 'Dénivelé pour séances running',
    icon: 'ti-trending-up',
    status: 'active',
    href: '/cotes-run',
  },
  {
    id: 'veille',
    name: 'Veille',
    desc: 'Ressources tech à suivre',
    icon: 'ti-rss',
    status: 'soon',
    href: '/veille',
  },
  {
    id: 'new',
    name: 'Nouvelle app',
    desc: 'Prochainement…',
    icon: 'ti-plus',
    status: 'soon',
    href: null,
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

      {/* Grid */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
        {apps.map(app => (
          <AppCard key={app.id} app={app} dark={dark} />
        ))}
      </Box>

    </Box>
  )
}

export default Home