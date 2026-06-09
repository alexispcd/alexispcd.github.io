import { useState, useEffect } from 'react'
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import supabase from '../lib/supabase'

const AuthGate = ({ children }) => {
  const theme = useTheme()
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // email | code
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSendCode = async () => {
    if (!email.trim()) return
    setLoading(true)
    setErrorMsg('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    })
    setLoading(false)
    if (error) {
      setErrorMsg(error.message)
    } else {
      setStep('code')
    }
  }

  const handleVerifyCode = async () => {
    if (code.length !== 8) return
    setLoading(true)
    setErrorMsg('')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setLoading(false)
    if (error) {
      setErrorMsg('Code invalide ou expiré')
      setCode('')
    }
  }

  if (session === undefined) {
    return (
      <Box sx={{ height: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress size={32} sx={{ color: 'primary.main' }} />
      </Box>
    )
  }

  if (session) return children

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
          <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '1.5rem', fontWeight: 400, mb: 0.5 }}>
            Le <em>Cairn</em>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {step === 'email' ? 'Connexion par code email' : `Code envoyé à ${email}`}
          </Typography>
        </Box>

        {step === 'email' ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Adresse email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendCode()}
              disabled={loading}
              size="small"
              fullWidth
              autoComplete="email"
            />
            {errorMsg && <Typography variant="caption" color="error">{errorMsg}</Typography>}
            <Button
              variant="contained"
              onClick={handleSendCode}
              disabled={loading || !email.trim()}
              fullWidth
              sx={{ textTransform: 'none' }}
            >
              {loading ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : 'Envoyer le code'}
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Code à 8 chiffres"
              type="number"
              value={code}
              onChange={e => setCode(e.target.value.slice(0, 8))}
              onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
              disabled={loading}
              size="small"
              fullWidth
              autoFocus
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
            />
            {errorMsg && <Typography variant="caption" color="error">{errorMsg}</Typography>}
            <Button
              variant="contained"
              onClick={handleVerifyCode}
              disabled={loading || code.length !== 8}
              fullWidth
              sx={{ textTransform: 'none' }}
            >
              {loading ? <CircularProgress size={18} sx={{ color: 'inherit' }} /> : 'Se connecter'}
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => { setStep('email'); setCode(''); setErrorMsg('') }}
              sx={{ alignSelf: 'flex-start', px: 0, color: 'text.secondary', textTransform: 'none' }}
            >
              ← Changer d'email
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default AuthGate
