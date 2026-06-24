import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { useDarkMode } from './hooks/useDarkMode'
import createTheme from './styles/theme'
import Home from './apps/home/Home'
import Cotes from './apps/cotes/Cotes'
import VeillePage from './apps/veille/VeillePage'
import AuthGate from './components/AuthGate'
import AppHeader from './components/AppHeader'
import supabase from './lib/supabase'

const TOOL_NAMES = {
  '/cotes': 'Côtes',
  '/veille': 'Veille',
  '/training': 'Training',
}

const AppLayout = ({ dark, setDark, user, children }) => {
  const location = useLocation()
  const showBack = location.pathname !== '/'
  const toolName = TOOL_NAMES[location.pathname] ?? null

  return (
    <Box sx={{ position: 'relative', height: '100dvh', overflow: 'hidden' }}>
      {/* Le contenu remplit toute la hauteur, le header flotte par-dessus */}
      <Box sx={{ height: '100%', overflow: 'hidden' }}>
        {children}
      </Box>
      <AppHeader
        toolName={toolName}
        showBack={showBack}
        dark={dark}
        setDark={setDark}
        user={user}
        sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1200 }}
      />
    </Box>
  )
}

const App = () => {
  const [dark, setDark] = useDarkMode()
  const [user, setUser] = useState(null)
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
      <BrowserRouter>
        <AuthGate>
          <AppLayout dark={dark} setDark={setDark} user={user}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/cotes" element={<Cotes dark={dark} />} />
              <Route path="/veille" element={<VeillePage />} />
            </Routes>
          </AppLayout>
        </AuthGate>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
