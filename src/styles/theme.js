import { createTheme } from '@mui/material/styles'

const theme = (dark) => createTheme({
  palette: {
    mode: dark ? 'dark' : 'light',
    primary: {
      main: dark ? '#5DCAA5' : '#1D9E75',
      light: dark ? '#0e2018' : '#e6f5ef',
    },
    background: {
      default: dark ? '#0f0f12' : '#ffffff',
      paper: dark ? '#161620' : '#f7f7f7',
    },
    text: {
      primary: dark ? '#e2e8f0' : '#111111',
      secondary: dark ? '#94a3b8' : '#6b7280',
    },
    divider: dark ? '#1e1e2a' : '#ebebeb',
    // Bande peinte sous la barre de statut iOS (zone env(safe-area-inset-top)).
    // iOS y dessine l'heure toujours en blanc, la bande doit donc rester foncée.
    statusBar: dark ? '#0f0f12' : '#1D9E75',
  },
  typography: {
    fontFamily: 'Geist, sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 12 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${dark ? '#1e1e2a' : '#ebebeb'}`,
          boxShadow: 'none',
          borderRadius: 20,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 28 },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: { borderRadius: 20 },
      },
    },
  },
})

export default theme