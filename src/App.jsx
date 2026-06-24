import { ThemeProvider, CssBaseline } from '@mui/material'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useMemo } from 'react'
import { useDarkMode } from './hooks/useDarkMode'
import createTheme from './styles/theme'
import Home from './apps/home/Home'
import Cotes from './apps/cotes/Cotes'
import VeillePage from './apps/veille/VeillePage'
import AuthGate from './components/AuthGate'

const App = () => {
  const [dark, setDark] = useDarkMode()
  const theme = useMemo(() => createTheme(dark), [dark])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route path="/" element={<Home dark={dark} setDark={setDark} />} />
            <Route path="/cotes" element={<Cotes dark={dark} setDark={setDark} />} />
            <Route path="/veille" element={<VeillePage dark={dark} setDark={setDark} />} />
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App