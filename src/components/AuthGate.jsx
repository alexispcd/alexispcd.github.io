import { useState, useEffect, useRef } from 'react'
import { Box, Typography, InputBase } from '@mui/material'
import supabase from '../lib/supabase'
import { texteErreur } from '../lib/reseau'
import { radius, size, space, textStyles } from '../styles/tokens'
import FullScreenLoader from './FullScreenLoader'
import Carte from '../ui/Carte'
import Bouton from '../ui/Bouton'
import CasesCode from '../ui/CasesCode'
import BarreAttente from '../ui/BarreAttente'
import { useFinAttente } from '../ui/useFinAttente'
import { useMessage } from '../ui/useMessage'
import { DUREES } from '../lib/durees'

// Inscriptions fermées : Supabase refuse l'OTP d'un email sans compte (code otp_disabled).
const isUnknownAccount = (error) =>
  error.code === 'otp_disabled' || /signups? not allowed/i.test(error.message ?? '')

const AuthGate = ({ children }) => {
  const { afficher } = useMessage()
  const [session, setSession] = useState(undefined)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email') // email | code
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const attenteEnvoi = useFinAttente(sending)
  const attenteConnexion = useFinAttente(verifying)
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
    if (!email.trim() || sending) return
    setSending(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // Comptes créés uniquement depuis le module Admin.
      options: { shouldCreateUser: false },
    })
    setSending(false)
    if (error) {
      // L'e-mail reste saisi.
      afficher(isUnknownAccount(error)
        ? 'Ce compte n\'existe pas. Demande une invitation.'
        : texteErreur(error, 'L\'envoi du code n\'a pas abouti. Réessaie.'))
    } else {
      setStep('code')
    }
  }

  const verifyCode = async (token) => {
    if (token.length !== 8 || verifyingRef.current) return
    verifyingRef.current = true
    setVerifying(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token,
      type: 'email',
    })
    setVerifying(false)
    verifyingRef.current = false
    if (error) {
      // Cases vidées, échec réseau compris : le message dit de réessayer.
      afficher(texteErreur(error, 'Code invalide ou expiré.'))
      setCode('')
    }
  }

  const handleVerifyCode = () => verifyCode(code)

  // Chiffres uniquement (un code collé ou proposé par le clavier peut contenir des
  // espaces), tronqués à 8. Pas de maxLength sur l'input (CasesCode) : le navigateur
  // couperait un collage « 1234 5678 » avant ce filtrage. Vérification lancée dès
  // que le code devient complet.
  const handleCodeChange = (texte) => {
    const digits = texte.replace(/\D/g, '').slice(0, 8)
    setCode(digits)
    if (digits.length === 8 && code.length !== 8) verifyCode(digits)
  }

  // Pendant la connexion, le toucher est ignoré, sans disabled : un bouton
  // désactivé doit dire pourquoi.
  const changerEmail = () => {
    if (verifying) return
    setStep('email')
    setCode('')
  }

  if (session === undefined) return <FullScreenLoader />

  if (session) return children

  // L'étape du code s'affiche quand la barre de l'envoi a fini.
  const etape = attenteEnvoi.visible ? 'email' : step

  return (
    <Box sx={{
      height: '100dvh',
      bgcolor: 'background.default',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      px: space[16],
      pb: '60px',
      boxSizing: 'border-box',
    }}>
      <Carte sx={{ gap: space[14] }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[8], pt: space[12], px: space[4], pb: space[4] }}>
          <Typography variant="titre-app" component="h1">Le Cairn</Typography>
          <Typography variant="secondaire" sx={{ color: 'muted', overflowWrap: 'anywhere' }}>
            {etape === 'email' ? 'Connexion par code e-mail' : `Code envoyé à ${email.trim()}`}
          </Typography>
        </Box>

        {etape === 'email' ? (
          <>
            <Box
              component="label"
              sx={{
                bgcolor: 'chip',
                borderRadius: radius.inner,
                minHeight: size.ligne,
                py: space[8],
                px: space[14],
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: space[2],
                cursor: 'text',
              }}
            >
              <Typography variant="etiquette" component="span" sx={{ color: 'muted' }}>E-mail</Typography>
              <InputBase
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                placeholder="ton@e-mail.fr"
                readOnly={sending}
                inputProps={{ autoComplete: 'email', autoCapitalize: 'none', inputMode: 'email' }}
                sx={{
                  color: 'ink',
                  '& input': { ...textStyles.bouton, p: 0, height: 'auto' },
                  '& input::placeholder': { color: 'var(--muted)', opacity: 1, fontWeight: 400 },
                }}
              />
            </Box>
            {attenteEnvoi.visible
              ? <BarreAttente place="barre" phrase="Envoi du code" duree={DUREES.envoiCode} {...attenteEnvoi} />
              : (
                <Bouton
                  pleineLargeur
                  onClick={handleSendCode}
                  disabled={!email.trim()}
                  raison="Saisis ton e-mail."
                >
                  Recevoir le code
                </Bouton>
              )}
          </>
        ) : (
          <>
            <CasesCode valeur={code} onChange={handleCodeChange} lectureSeule={verifying} />
            {attenteConnexion.visible
              ? <BarreAttente place="barre" phrase="Connexion" duree={DUREES.connexion} {...attenteConnexion} />
              : (
                <Bouton
                  pleineLargeur
                  onClick={handleVerifyCode}
                  disabled={code.length !== 8}
                  raison="Saisis les 8 chiffres du code."
                >
                  Se connecter
                </Bouton>
              )}
            <Bouton variante="texte" petit onClick={changerEmail} sx={{ alignSelf: 'flex-start', px: space[4] }}>
              Changer d'e-mail
            </Bouton>
          </>
        )}
      </Carte>
    </Box>
  )
}

export default AuthGate
