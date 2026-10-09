import FitnessCenter from '@mui/icons-material/FitnessCenter'

const renfo = {
  id: 'renfo',
  name: 'Renfo',
  description: 'Renforcement à la maison',
  category: 'Sport',
  adminOnly: false,
  icon: FitnessCenter,
  path: '/renfo',
  routes: [
    { path: '/renfo', load: () => import('./RenfoHome'), handle: { title: 'Renfo', backTo: '/' } },
    { path: '/renfo/settings', load: () => import('./SettingsPage'), handle: { title: 'Réglages', backTo: '/renfo' } },
    { path: '/renfo/session/:sessionId', load: () => import('./session/SessionPage'), handle: { title: 'Séance', backTo: '/renfo' } },
  ],
}

export default renfo
