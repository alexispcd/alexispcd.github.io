import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Avant App : son listener popstate doit précéder celui du router (voir le module).
import './lib/viewTransition'
import App from './App.jsx'

// Écouteur vide et passif : sans lui, :active ne réagit pas au doigt sur iPhone (testé
// sur le banc d'essai L0), donc aucun calque d'appui. Il ne bloque rien.
document.addEventListener('touchstart', () => {}, { passive: true })

// Ancien choix de variante d'appui (test du lot P1, retiré au lot P2) : clé effacée.
try {
  localStorage.removeItem('cairn-appui')
} catch {
  // Stockage indisponible : rien à effacer.
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
