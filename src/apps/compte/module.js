// Compte : page commune à tous les comptes (apparence, déconnexion), ouverte par le
// bouton compte de l'Accueil. Hors de l'Accueil et de l'Administration.
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
  ],
}

export default compte
