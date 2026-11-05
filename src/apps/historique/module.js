import { hasModule } from '../../lib/access'

// Historique des séances : frise commune à la course et au Renfo, ouverte par le menu
// de Training et la ligne de l'accueil Renfo. Ouverte à tout compte qui a l'un des
// deux modules ; jamais attribuable, absente de l'Accueil.
const historique = {
  id: 'historique',
  name: 'Historique des séances',
  description: 'Séances de course et de Renfo',
  adminOnly: false,
  commun: true,
  canAccess: (access) => hasModule(access, 'training') || hasModule(access, 'renfo'),
  path: '/historique',
  routes: [
    { path: '/historique', load: () => import('./HistoriquePage'), handle: { title: 'Historique des séances', backTo: '/' } },
  ],
}

export default historique
