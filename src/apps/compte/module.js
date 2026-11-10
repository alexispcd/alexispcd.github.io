// Compte : page commune à tous les comptes (apparence, déconnexion), ouverte par le
// bouton compte de l'Accueil. Hors de l'Accueil et de l'Administration. Sources de
// données : sous-page commune, sans contrôle de module (coros-oauth non plus).
const compte = {
  id: 'compte',
  name: 'Compte',
  description: 'Apparence et déconnexion',
  adminOnly: false,
  commun: true,
  canAccess: () => true,
  path: '/compte',
  routes: [
    { path: '/compte', load: () => import('./ComptePage'), handle: { title: 'Compte', backTo: '/' } },
    { path: '/compte/sources', load: () => import('./SourcesPage'), handle: { title: 'Sources de données', backTo: '/compte' } },
  ],
}

export default compte
