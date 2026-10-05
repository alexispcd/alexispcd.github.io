import RssFeed from '@mui/icons-material/RssFeed'

const veille = {
  id: 'veille',
  name: 'Veille',
  description: 'Ressources tech à suivre',
  category: 'Dev',
  enabled: false,
  adminOnly: false,
  icon: RssFeed,
  path: '/veille',
  routes: [
    { path: '/veille', load: () => import('./VeillePage'), handle: { title: 'Veille', backTo: '/' } },
    { path: '/veille/article/:articleId', load: () => import('./ArticleDetail'), handle: { title: 'Veille', backTo: '/veille' } },
  ],
}

export default veille
