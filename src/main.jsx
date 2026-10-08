import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// Avant App : son listener popstate doit précéder celui du router (voir le module).
import './lib/viewTransition'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
