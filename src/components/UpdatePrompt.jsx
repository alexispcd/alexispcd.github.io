import { Snackbar, Alert, Button, IconButton } from '@mui/material'
import Close from '@mui/icons-material/Close'
import { useRegisterSW } from 'virtual:pwa-register/react'

let visibilityHooked = false

// Vérifie s'il existe une nouvelle version à chaque retour au premier plan (pas de
// sondage périodique). Posé une seule fois, même si l'enregistrement est rejoué.
const onRegisteredSW = (_swUrl, registration) => {
  if (!registration || visibilityHooked) return
  visibilityHooked = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    registration.update().catch(() => {})
  })
}

const UpdatePrompt = () => {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({ onRegisteredSW })

  return (
    <Snackbar open={needRefresh} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Alert
        severity="info"
        icon={false}
        sx={{ width: '100%', alignItems: 'center', borderRadius: '12px' }}
        action={(
          <>
            <Button size="small" color="inherit" onClick={() => updateServiceWorker(true)} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Recharger
            </Button>
            <IconButton size="small" color="inherit" aria-label="Fermer" onClick={() => setNeedRefresh(false)}>
              <Close fontSize="small" />
            </IconButton>
          </>
        )}
      >
        Nouvelle version disponible
      </Alert>
    </Snackbar>
  )
}

export default UpdatePrompt
