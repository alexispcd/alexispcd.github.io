import { useState } from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import IosShare from '@mui/icons-material/IosShare'
import Close from '@mui/icons-material/Close'
import { cardSx } from '../styles/glass'

const DISMISS_KEY = 'cairn-install-banner-dismissed'

// iPadOS se présente comme un Mac : on le reconnaît à l'écran tactile.
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const isInstalled = () => window.navigator.standalone === true
  || window.matchMedia('(display-mode: standalone)').matches

const isDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

const shouldShow = () => isIos() && !isInstalled() && !isDismissed()

// Guide d'installation sur l'écran d'accueil, affiché dans Safari iOS uniquement.
const InstallBanner = () => {
  const [visible, setVisible] = useState(shouldShow)

  const dismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Stockage indisponible (navigation privée) : la bannière reviendra au prochain lancement.
    }
  }

  if (!visible) return null

  return (
    <Box sx={{ ...cardSx, borderRadius: '16px', p: 2, pr: 1, mb: 4, display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          Installer Le Cairn
        </Typography>
        <Typography variant="body2" color="text.secondary" component="div">
          Touche
          <IosShare sx={{ fontSize: 16, mx: 0.5, verticalAlign: 'text-bottom', color: 'primary.main' }} aria-label="Partager" />
          Partager, puis « Sur l'écran d'accueil ». L'app s'ouvre alors en plein écran et reste consultable hors ligne.
        </Typography>
      </Box>
      <IconButton size="small" aria-label="Masquer" onClick={dismiss}>
        <Close fontSize="small" />
      </IconButton>
    </Box>
  )
}

export default InstallBanner
