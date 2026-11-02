import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAppCtx } from '../lib/context'
import { useMessage } from '../ui/useMessage'

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

// « Nouvelle version disponible » en Message fixe, jusqu'au toucher. Jamais pendant
// un overlay plein écran (player Renfo) : il revient tout seul à sa fermeture.
const UpdatePrompt = () => {
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({ onRegisteredSW })
  const { overlay } = useAppCtx()
  const { afficherFixe, retirerFixe } = useMessage()
  const visible = needRefresh && !overlay

  useEffect(() => {
    if (!visible) {
      retirerFixe()
      return
    }
    afficherFixe({
      texte: 'Nouvelle version disponible',
      action: { libelle: 'Recharger', onClick: () => updateServiceWorker(true) },
      onFermer: () => setNeedRefresh(false),
    })
  }, [visible, afficherFixe, retirerFixe, updateServiceWorker, setNeedRefresh])

  return null
}

export default UpdatePrompt
