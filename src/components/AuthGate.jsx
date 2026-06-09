import { useState, useEffect } from 'react'
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import supabase from '../lib/supabase'

const AuthGate = ({ children }) => {
  const theme = useTheme()
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSend = async () => {
    if (!email.trim()) return
    setStatus('loading')
    setErrorMsg('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    if (error) {
      setErrorMsg(error.message)
      setStatus('error')
    } else {
      setStatus('success')
    }
  }

  // En attente de la session initiale
  if (session === undefined) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress size={32} sx={{ color: 'primary.main' }} />
      </Box>
    )
  }

  // Connecté
  if (session) return children

  // Écran login
  return (
    <Box sx={{
      height: '100dvh',
      bgcolor: 'background.default',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      px: 4,
    }}>
      <Box sx={{
        width: '100%',
        maxWidth: 360,
        bgcolor: 'background.paper',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 3,
        p: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
      }}>
        <Box>
          <Typography
            sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '1.5rem', fontWeight: 400, mb: 0.5 }}
          >
            Le <em>Cairn</em>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Connexion par lien magique
          </Typography>
        </Box>

        {status === 'success' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="primary.main" fontWeight={500}>
              Lien envoyé !
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Vérifie ta boîte mail et clique sur le lien pour te connecter.
            </Typography>
            <Button
              variant="text"
              size="small"
              sx={{ alignSelf: 'flex-start', px: 0, color: 'text.secondary' }}
              onClick={() => { setStatus('idle'); setEmail('') }}
            >
              Renvoyer
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Adresse email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={status === 'loading'}
              size="small"
              fullWidth
              autoComplete="email"
            />
            {status === 'error' && (
              <Typography variant="caption" color="error">
                {errorMsg}
              </Typography>
            )}
            <Button
              variant="contained"
              onClick={handleSend}
              disabled={status === 'loading' || !email.trim()}
              fullWidth
              sx={{ textTransform: 'none' }}
            >
              {status === 'loading'
                ? <CircularProgress size={18} sx={{ color: 'inherit' }} />
                : 'Envoyer le lien'}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default AuthGate
