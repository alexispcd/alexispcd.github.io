import { ThemeProvider, CssBaseline } from '@mui/material'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useMemo } from 'react'
import { useDarkMode } from './hooks/useDarkMode'
import createTheme from './styles/theme'
import Home from './apps/home/Home'
import Cotes from './apps/cotes/Cotes'

const App = () => {
  const [dark, setDark] = useDarkMode()
  const theme = useMemo(() => createTheme(dark), [dark])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home dark={dark} setDark={setDark} />} />
          <Route path="/cotes" element={<Cotes dark={dark} setDark={setDark} />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App