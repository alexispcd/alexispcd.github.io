import TrendingUp from '@mui/icons-material/TrendingUp'

const cotes = {
  id: 'cotes',
  name: 'Côtes',
  description: 'Dénivelé pour séances running',
  category: 'Sport',
  enabled: true,
  adminOnly: false,
  icon: TrendingUp,
  path: '/cotes',
  routes: [
    { path: '/cotes', load: () => import('./Cotes'), handle: { title: 'Côtes', backTo: '/' } },
  ],
}

export default cotes
