import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings'

const admin = {
  id: 'admin',
  name: 'Administration',
  description: 'Comptes et droits',
  category: null,
  enabled: true,
  adminOnly: true,
  icon: AdminPanelSettings,
  path: '/admin',
  routes: [
    { path: '/admin', load: () => import('./AdminPage'), handle: { title: 'Administration', backTo: '/' } },
  ],
}

export default admin
