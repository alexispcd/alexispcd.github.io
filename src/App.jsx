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
import TrainingPlaceholder from './apps/training/TrainingPlaceholder'
import AuthGate from './components/AuthGate'
import AppHeader from './components/AppHeader'
import supabase from './lib/supabase'
import { AppCtx, useAppCtx } from './lib/context'

const AppLayout = () => {
  const { dark, setDark, user, headerActions } = useAppCtx()
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
      <Box sx={{ height: '100%', overflow: 'hidden' }}>
        <Outlet />
      </Box>
      <AppHeader
        toolName={handle.title ?? null}
        actions={headerActions}
        showBack={showBack}
        onBack={handleBack}
        dark={dark}
        setDark={setDark}
        user={user}
        sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1301 }}
      />
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
      { path: '/training/wizard', element: <TrainingPlaceholder label="Nouveau plan" />, handle: { title: 'Nouveau plan', backTo: '/training' } },
      { path: '/training/plan/:planId', element: <PlanDashboard />, handle: { title: 'Training', backTo: '/training' } },
      { path: '/training/plan/:planId/session/:sessionId', element: <SessionPage />, handle: { title: 'Séance', backTo: (p) => `/training/plan/${p.planId}` } },
    ],
  },
])

const App = () => {
  const [user, setUser] = useState(null)
  const [dark, setDark] = useDarkMode(user)
  const [headerActions, setHeaderActions] = useState([])
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
      <AppCtx.Provider value={{ dark, setDark, user, headerActions, setHeaderActions }}>
        <AuthGate>
          <RouterProvider router={router} />
        </AuthGate>
      </AppCtx.Provider>
    </ThemeProvider>
  )
}

export default App
