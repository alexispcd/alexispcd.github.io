import { createBrowserRouter, RouterProvider, Outlet, useMatches, useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { useDarkMode } from './hooks/useDarkMode'
import createTheme from './styles/theme'
import Home from './apps/home/Home'
import Cotes from './apps/cotes/Cotes'
import VeillePage from './apps/veille/VeillePage'
import ArticleDetail from './apps/veille/ArticleDetail'
import TrainingHome from './apps/training/TrainingHome'
import PlanDashboard from './apps/training/dashboard/PlanDashboard'
import SessionPage from './apps/training/session/SessionPage'
import PlanWizard from './apps/training/wizard/PlanWizard'
import AuthGate from './components/AuthGate'
import AppHeader from './components/AppHeader'
import supabase from './lib/supabase'
import { AppCtx, useAppCtx } from './lib/context'

const AppLayout = () => {
  const { dark, setDark, user, headerActions, overlay } = useAppCtx()
  const matches = useMatches()
  const lastMatch = matches.at(-1)
  const handle = lastMatch?.handle ?? {}
  const navigate = useNavigate()

  // backTo peut être une string ou une fonction (params) => string (route dynamique).
  const backTo = typeof handle.backTo === 'function'
    ? handle.backTo(lastMatch?.params ?? {})
    : handle.backTo

  const showBack = handle.showBack !== false && backTo !== undefined
  const handleBack = backTo !== undefined
    ? () => navigate(backTo)
    : () => navigate(-1)

  return (
    <Box sx={{ position: 'relative', height: '100dvh', overflow: 'hidden' }}>
      {/* La webview passe sous la barre de statut iOS (viewport-fit=cover). Le contenu de
          page descend de l'inset haut (header) et reserve l'inset bas pour ne pas finir
          sous l'indicateur d'accueil. Chaque page scrolle dans son propre conteneur en
          height 100% : ce padding raccourcit d'autant leur zone utile. */}
      <Box sx={{
        height: '100%', overflow: 'hidden',
        pt: 'env(safe-area-inset-top, 0px)',
        pb: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <Outlet />
      </Box>
      {/* Bande peinte sous l'heure iOS. Sous le z-index des Dialog (1300) : le backdrop la recouvre. */}
      <Box sx={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: 'env(safe-area-inset-top, 0px)',
        bgcolor: (t) => t.palette.statusBar,
        zIndex: 1200,
        pointerEvents: 'none',
      }} />
      {/* Symetrique en bas, sur la zone de l'indicateur d'accueil. Couleur homeIndicator
          (= background.default) : la bande se fond dans la page au repos, et comme elle
          partage la couleur du contenu, le backdrop d'une modale l'assombrit a l'identique. */}
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        height: 'env(safe-area-inset-bottom, 0px)',
        bgcolor: (t) => t.palette.homeIndicator,
        zIndex: 1200,
        pointerEvents: 'none',
      }} />
      {/* Masqué pendant qu'un overlay plein écran (player renfo) occupe l'écran :
          le header flotte au-dessus de tout et son bouton retour se superpose aux
          contrôles de l'overlay. */}
      {!overlay && (
        <AppHeader
          toolName={handle.title ?? null}
          actions={headerActions}
          showBack={showBack}
          onBack={handleBack}
          dark={dark}
          setDark={setDark}
          user={user}
          // zIndex 1200 : sous les Dialog MUI (1300) pour que le backdrop recouvre le header.
          // pt : le header porte l'inset haut et ne passe plus sous l'heure (py:1.5 = 12px conservés).
          sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200, pt: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
        />
      )}
    </Box>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <Home />, handle: { showBack: false } },
      { path: '/cotes', element: <Cotes />, handle: { title: 'Côtes', backTo: '/' } },
      { path: '/veille', element: <VeillePage />, handle: { title: 'Veille', backTo: '/' } },
      { path: '/veille/article/:articleId', element: <ArticleDetail />, handle: { title: 'Veille', backTo: '/veille' } },
      { path: '/training', element: <TrainingHome />, handle: { title: 'Training', backTo: '/' } },
      { path: '/training/wizard', element: <PlanWizard />, handle: { title: 'Nouveau plan', backTo: '/training' } },
      { path: '/training/plan/:planId', element: <PlanDashboard />, handle: { title: 'Training', backTo: '/' } },
      { path: '/training/plan/:planId/session/:sessionId', element: <SessionPage />, handle: { title: 'Séance', backTo: (p) => `/training/plan/${p.planId}` } },
    ],
  },
])

const App = () => {
  const [user, setUser] = useState(null)
  const [dark, setDark] = useDarkMode(user)
  const [headerActions, setHeaderActions] = useState([])
  // Vrai quand un overlay plein écran est monté : le header applicatif s'efface.
  const [overlay, setOverlay] = useState(false)
  const theme = useMemo(() => createTheme(dark), [dark])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppCtx.Provider value={{ dark, setDark, user, headerActions, setHeaderActions, overlay, setOverlay }}>
        <AuthGate>
          <RouterProvider router={router} />
        </AuthGate>
      </AppCtx.Provider>
    </ThemeProvider>
  )
}

export default App
