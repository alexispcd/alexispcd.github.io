import { createBrowserRouter, RouterProvider, Outlet, useMatches, useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { useDarkMode } from './hooks/useDarkMode'
import createTheme from './styles/theme'
import Home from './apps/home/Home'
import Cotes from './apps/cotes/Cotes'
import VeillePage from './apps/veille/VeillePage'
import ArticleDetail from './apps/veille/ArticleDetail'
import TrainingPage from './apps/training/TrainingPage'
import PlanDashboard from './apps/training/dashboard/PlanDashboard'
import PlanWizard from './apps/training/wizard/PlanWizard'
import AuthGate from './components/AuthGate'
import AppHeader from './components/AppHeader'
import supabase from './lib/supabase'
import { AppCtx, useAppCtx } from './lib/context'

const AppLayout = () => {
  const { dark, setDark, user, headerActions } = useAppCtx()
  const matches = useMatches()
  const handle = matches.at(-1)?.handle ?? {}
  const navigate = useNavigate()

  const showBack = handle.showBack !== false && handle.backTo !== undefined
  const handleBack = handle.backTo !== undefined
    ? () => navigate(handle.backTo)
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
      { path: '/training', element: <TrainingPage />, handle: { title: 'Training', backTo: '/' } },
      { path: '/training/wizard', element: <PlanWizard />, handle: { title: 'Nouveau plan', backTo: '/training' } },
      { path: '/training/plan/:planId', element: <PlanDashboard />, handle: { title: 'Training', backTo: '/training' } },
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
