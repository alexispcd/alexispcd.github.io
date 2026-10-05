import Style from '@mui/icons-material/Style'

const revisions = {
  id: 'revisions',
  name: 'Révisions',
  description: 'Cartes de révision',
  category: 'Études',
  enabled: false,
  adminOnly: false,
  icon: Style,
  path: '/revisions',
  routes: [
    { path: '/revisions', load: () => import('./RevisionsHome'), handle: { title: 'Révisions', backTo: '/' } },
    { path: '/revisions/session', load: () => import('./ReviewSession'), handle: { title: 'Révision', backTo: '/revisions' } },
  ],
}

export default revisions
