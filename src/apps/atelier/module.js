import Palette from '@mui/icons-material/Palette'

// Atelier : page temporaire de démonstration des composants src/ui, pour les voir
// sur l'iPhone pendant la refonte. Réservée à l'admin, ouverte depuis le menu du
// compte. Elle et sa ligne de menu seront retirées à la fin de la refonte (lot F1).
const atelier = {
  id: 'atelier',
  name: 'Atelier',
  description: 'Composants du Design System',
  category: null,
  adminOnly: true,
  icon: Palette,
  path: '/atelier',
  routes: [
    { path: '/atelier', load: () => import('./AtelierPage'), handle: { title: 'Atelier', backTo: '/' } },
  ],
}

export default atelier
