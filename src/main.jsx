import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Avant App : son listener popstate doit précéder celui du router (voir le module).
import './lib/viewTransition'
import App from './App.jsx'
import { appliquerVariante, lireVarianteStockee } from './lib/appui'

// Écouteur vide et passif : sans lui, :active ne réagit pas au doigt sur iPhone (testé
// sur le banc d'essai L0), donc aucun calque d'appui. Il ne bloque rien.
document.addEventListener('touchstart', () => {}, { passive: true })

// Variante du calque d'appui (lot P1) posée sur <html> avant le premier rendu.
appliquerVariante(lireVarianteStockee())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
