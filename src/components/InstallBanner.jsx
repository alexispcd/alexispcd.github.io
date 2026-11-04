import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { space } from '../styles/tokens'
import Carte from '../ui/Carte'
import BoutonIcone from '../ui/BoutonIcone'
import { Croix, Partager } from '../ui/Icones'

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

/**
 * Guide d'installation sur l'écran d'accueil, affiché dans Safari iOS uniquement.
 * `apercu` (Atelier) : toujours affiché, sans lire ni écrire le stockage ; « Masquer »
 * n'y fait rien.
 */
const InstallBanner = ({ apercu = false }) => {
  const [visible, setVisible] = useState(() => apercu || shouldShow())

  const dismiss = () => {
    if (apercu) return
    setVisible(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // Stockage indisponible (navigation privée) : la bannière reviendra au prochain lancement.
    }
  }

  if (!apercu && !visible) return null

  return (
    <Carte sx={{ flexDirection: 'row', gap: space[4], alignItems: 'flex-start', pt: space[14], pr: space[4], pb: space[14], pl: space[16] }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4], flex: '1 1 0', minWidth: 0, pt: space[2] }}>
        <Typography variant="corps-fort">Installer Le Cairn</Typography>
        <Typography variant="secondaire" sx={{ color: 'muted' }}>
          {'Touche '}
          <Partager taille={16} titre="Partager" style={{ verticalAlign: '-3px', color: 'var(--ink)' }} />
          {' Partager, puis « Sur l\'écran d\'accueil ». L\'app s\'ouvrira en plein écran.'}
        </Typography>
      </Box>
      <BoutonIcone label="Masquer" onClick={dismiss}>
        <Croix taille={20} />
      </BoutonIcone>
    </Carte>
  )
}

export default InstallBanner
