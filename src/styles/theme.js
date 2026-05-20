import { createTheme } from '@mui/material/styles'

const theme = (dark) => createTheme({
  palette: {
    mode: dark ? 'dark' : 'light',
    primary: {
      main: dark ? '#5a9e78' : '#3d6b51',
      light: dark ? '#0e1f16' : '#eaf3ee',
    },
    background: {
      default: dark ? '#0f0f12' : '#ffffff',
      paper: dark ? '#161620' : '#f7f7f7',
    },
    text: {
      primary: dark ? '#e2e8f0' : '#111111',
      secondary: dark ? '#444444' : '#aaaaaa',
    },
    divider: dark ? '#1e1e2a' : '#ebebeb',
  },
  typography: {
    fontFamily: 'Geist, sans-serif',
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${dark ? '#1e1e2a' : '#ebebeb'}`,
          boxShadow: 'none',
        },
      },
    },
  },
})

export default theme