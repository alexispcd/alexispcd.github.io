import FitnessCenter from '@mui/icons-material/FitnessCenter'

const renfo = {
  id: 'renfo',
  name: 'Renfo',
  description: 'Renforcement à la maison',
  adminOnly: false,
  icon: FitnessCenter,
  path: '/renfo',
  routes: [
    { path: '/renfo', load: () => import('./RenfoHome'), handle: { title: 'Renfo', backTo: '/' } },
    { path: '/renfo/composer', load: () => import('./compose/ComposerPage'), handle: { title: 'Nouvelle séance', backTo: '/renfo' } },
    { path: '/renfo/settings', load: () => import('./SettingsPage'), handle: { title: 'Réglages', backTo: '/renfo' } },
    { path: '/renfo/session/:sessionId', load: () => import('./session/SessionPage'), handle: { title: 'Séance', backTo: '/renfo' } },
    { path: '/renfo/session/:sessionId/valider', load: () => import('./session/ValiderPage'), handle: { title: 'Valider la séance', backTo: (p) => `/renfo/session/${p.sessionId}` } },
  ],
}

export default renfo
