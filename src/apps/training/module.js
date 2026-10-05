import DirectionsRun from '@mui/icons-material/DirectionsRun'

const training = {
  id: 'training',
  name: 'Training',
  description: 'Plans et suivi Coros',
  category: 'Sport',
  enabled: true,
  icon: DirectionsRun,
  path: '/training',
  routes: [
    { path: '/training', load: () => import('./TrainingHome'), handle: { title: 'Training', backTo: '/' } },
    { path: '/training/wizard', load: () => import('./wizard/PlanWizard'), handle: { title: 'Nouveau plan', backTo: '/training' } },
    { path: '/training/settings', load: () => import('./SettingsPage'), handle: { title: 'Réglages', backTo: '/training' } },
    { path: '/training/plan/:planId', load: () => import('./dashboard/PlanDashboard'), handle: { title: 'Training', backTo: '/' } },
    { path: '/training/plan/:planId/session/:sessionId', load: () => import('./session/SessionPage'), handle: { title: 'Séance', backTo: (p) => `/training/plan/${p.planId}` } },
  ],
}

export default training
