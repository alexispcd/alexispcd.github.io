import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Box, Typography, Button, Chip, Alert } from '@mui/material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { cardSx } from '../../styles/glass'
import FeuilleFlottante from '../../ui/FeuilleFlottante'
import BarreAttente from '../../ui/BarreAttente'
import { useAction } from '../../ui/useAction'
import { useFinAttente } from '../../ui/useFinAttente'
import { DUREES } from '../../lib/durees'
import { getCorosStatus, startCorosOauth, disconnectCoros } from '../../lib/training'
import { texteErreur } from '../../lib/reseau'

// Coins concentriques : radius carte = inset (16 = p 2) + radius bouton (12) = 28.
const CARD_INSET = 2
const CARD_RADIUS = '28px'

// La palette du projet ne definit ni success ni error : valeurs litterales.
// Vert aligne sur primary.main, orange deja utilise pour la zone B.
// L'état de la connexion se dit par le texte, pas par la couleur : jetons neutres.
const connectedColor = 'ink'
const DISCONNECTED_COLOR = 'muted'

// Bandeau unique de la page. Une seule source d'alerte, alimentee par le retour
// OAuth (parametre de requete), par la deconnexion et par les erreurs d'appel.
const noticeFromParam = (result) => {
  if (!result) return null
  return result === 'ok'
    ? { severity: 'success', text: 'Compte Coros connecté.' }
    : { severity: 'error', text: 'La connexion Coros a échoué. Réessaie.' }
}

const SectionLabel = ({ children }) => (
  <Typography
    variant="overline"
    sx={{ display: 'block', color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.62rem', fontWeight: 600, mt: 2.5, mb: 1, px: 0.5 }}
  >
    {children}
  </Typography>
)

/**
 * Reglages Training. Pour l'instant une seule section : la connexion OAuth Coros,
 * qui se fait dans le navigateur systeme (Coros refuse l'iframe). Le retour se fait
 * sur cette page avec ?coros=ok ou ?coros=error.
 */
const SettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [connected, setConnected] = useState(null) // null = chargement
  // Resultat du retour OAuth, lu une seule fois au montage : l'URL est nettoyee
  // juste apres pour que le message ne persiste pas au rechargement.
  const [notice, setNotice] = useState(() => noticeFromParam(searchParams.get('coros')))
  const [starting, setStarting] = useState(false)

  const attenteConnexion = useFinAttente(starting)

  // Deconnexion : confirmation en feuille, attente en carte, echec en Message.
  const [deconnexionOuverte, setDeconnexionOuverte] = useState(false)
  const deconnexion = useAction({
    attente: 'Déconnexion de Coros', duree: DUREES.sources,
    echec: 'La déconnexion de Coros n\'a pas abouti. Réessaie.',
  })

  const refresh = useCallback(() => {
    getCorosStatus()
      .then((res) => setConnected(Boolean(res?.connected)))
      .catch((e) => {
        setNotice({ severity: 'error', text: texteErreur(e, 'Les données n\'ont pas pu être chargées.') })
        setConnected(false)
      })
  }, [])

  // Chargement initial + rafraichissement quand l'utilisateur revient dans la PWA
  // apres s'etre authentifie dans le navigateur.
  useEffect(() => {
    refresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [refresh])

  useEffect(() => {
    if (!searchParams.get('coros')) return
    const next = new URLSearchParams(searchParams)
    next.delete('coros')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const handleConnect = async () => {
    setStarting(true)
    setNotice(null)
    try {
      const { url } = await startCorosOauth()
      window.location.href = url
    } catch (e) {
      setNotice({ severity: 'error', text: texteErreur(e, 'La connexion à Coros n\'a pas abouti. Réessaie.') })
      setStarting(false)
    }
  }

  const handleDisconnect = async () => {
    setNotice(null)
    const { ok, valeur } = await deconnexion.lancer(() => disconnectCoros())
    if (!ok) return
    setConnected(Boolean(valeur?.connected))
    setNotice({ severity: 'success', text: 'Compte Coros déconnecté.' })
  }

  const loading = connected === null
  const attenteEtat = useFinAttente(loading)

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, pb: 'env(safe-area-inset-bottom, 0px)' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2 }}>

        <BarreAttente place="carte" {...deconnexion.barre} sx={{ '& .MuiCollapse-wrapperInner': { pt: 2 } }} />

        {notice && (
          <Alert severity={notice.severity} sx={{ mt: 2 }} onClose={() => setNotice(null)}>
            {notice.text}
          </Alert>
        )}

        <SectionLabel>Connexions</SectionLabel>

        <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, p: CARD_INSET }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="body1" fontWeight={700} sx={{ flex: 1, minWidth: 0 }}>Coros</Typography>
            {attenteEtat.visible
              ? <BarreAttente place="section" duree={DUREES.sources} {...attenteEtat} sx={{ width: '80px' }} />
              : (
                <Chip
                  size="small"
                  label={connected ? 'Connecté' : 'Déconnecté'}
                  sx={{
                    fontWeight: 600,
                    color: connected ? connectedColor : DISCONNECTED_COLOR,
                    borderColor: connected ? connectedColor : DISCONNECTED_COLOR,
                    border: '1px solid',
                    bgcolor: 'transparent',
                  }}
                />
              )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Import des activités et des laps
          </Typography>

          {attenteConnexion.visible
            ? (
              <BarreAttente
                place="barre"
                phrase="Connexion à Coros"
                duree={DUREES.sources}
                {...attenteConnexion}
                sx={{ mt: 2 }}
              />
            )
            : (
              <Button
                variant="contained"
                fullWidth
                sx={{ mt: 2 }}
                disabled={loading}
                onClick={handleConnect}
              >
                {connected ? 'Reconnecter Coros' : 'Connecter Coros'}
              </Button>
            )}

          {connected && (
            <Button
              variant="text"
              fullWidth
              sx={{ mt: 1, color: DISCONNECTED_COLOR }}
              disabled={starting || deconnexion.enCours}
              onClick={() => setDeconnexionOuverte(true)}
            >
              Déconnecter
            </Button>
          )}
        </Box>

      </Box>

      {/* Confirmation de deconnexion */}
      <FeuilleFlottante
        ouverte={deconnexionOuverte}
        onFermer={() => setDeconnexionOuverte(false)}
        titre="Sans Coros, plus de validation avec tes activités ni d'envoi sur ta montre. Les séances déjà envoyées y restent et ton compte Coros n'est pas modifié."
        lignes={[{ libelle: 'Déconnecter Coros', onClick: handleDisconnect }]}
        fermerLibelle="Annuler"
      />
    </Box>
  )
}

export default SettingsPage
