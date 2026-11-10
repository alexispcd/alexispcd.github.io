import DirectionsRun from '@mui/icons-material/DirectionsRun'

const training = {
  id: 'training',
  name: 'Training',
  description: 'Plans et suivi de course',
  adminOnly: false,
  icon: DirectionsRun,
  path: '/training',
  routes: [
    { path: '/training', load: () => import('./TrainingEntree'), handle: { title: 'Training', backTo: '/' } },
    { path: '/training/wizard', load: () => import('./wizard/PlanWizard'), handle: { title: 'Nouveau plan', backTo: '/training' } },
    // Ancienne page des réglages : redirigée vers Sources de données (lot Src2).
    { path: '/training/settings', load: () => import('./RedirectionSources'), handle: { title: 'Sources de données', backTo: '/compte' } },
    { path: '/training/plan/:planId', load: () => import('./dashboard/PlanDashboard'), handle: { title: 'Training', backTo: '/' } },
    { path: '/training/plan/:planId/session/:sessionId', load: () => import('./session/SessionPage'), handle: { title: 'Séance', backTo: (p) => `/training/plan/${p.planId}` } },
    { path: '/training/plan/:planId/session/:sessionId/valider', load: () => import('./session/ValiderPage'), handle: { title: 'Valider la séance', backTo: (p) => `/training/plan/${p.planId}/session/${p.sessionId}` } },
  ],
}

export default training
