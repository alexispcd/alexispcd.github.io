import { useState, useEffect, useRef } from 'react'
import { Box, Typography, TextField, Button, CircularProgress } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import supabase from '../lib/supabase'
import FullScreenLoader from './FullScreenLoader'

// Inscriptions fermées : Supabase refuse l'OTP d'un email sans compte (code otp_disabled).
const isUnknownAccount = (error) =>
  error.code === 'otp_disabled' || /signups? not allowed/i.test(error.message ?? '')

const AuthGate = ({ children }) => {
  const theme = useTheme()
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // email | code
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  // Verrou : la vérification automatique ne part qu'une fois par code complet,
  // même si l'autocomplétion iOS déclenche plusieurs onChange de suite.
  const verifyingRef = useRef(false)

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
      // Comptes créés uniquement depuis le module Admin.
      options: { shouldCreateUser: false },
    })
    setLoading(false)
    if (error) {
      setErrorMsg(isUnknownAccount(error) ? 'Ce compte n\'existe pas. Demande une invitation.' : error.message)
    } else {
      setStep('code')
    }
  }

  const verifyCode = async (token) => {
    if (token.length !== 8 || verifyingRef.current) return
    verifyingRef.current = true
    setLoading(true)
    setErrorMsg('')
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    })
    setLoading(false)
    verifyingRef.current = false
    if (error) {
      setErrorMsg('Code invalide ou expiré')
      setCode('')
    }
  }

  const handleVerifyCode = () => verifyCode(code)

  // Chiffres uniquement (un code collé ou proposé par le clavier peut contenir des
  // espaces), tronqués à 8. Pas de maxLength sur l'input : le navigateur couperait
  // un collage « 1234 5678 » avant ce filtrage. Vérification lancée dès que le code
  // devient complet.
  const handleCodeChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8)
    setCode(digits)
    if (digits.length === 8 && code.length !== 8) verifyCode(digits)
  }

  if (session === undefined) return <FullScreenLoader />

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
              type="text"
              value={code}
              onChange={handleCodeChange}
              onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
              disabled={loading}
              size="small"
              fullWidth
              autoFocus
              autoComplete="one-time-code"
              slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*' } }}
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
