import { useState } from 'react'

/**
 * Relie une attente (`enCours`) à la BarreAttente : `visible` passe à vrai au
 * départ et le reste après la réponse (`fini`), le temps que la barre finisse et
 * s'efface ; la barre appelle alors `onFin` et `visible` repasse à faux. Ce qui
 * attendait la réponse (la page, le bouton) s'affiche quand `visible` est faux.
 * Partout, y compris au centre d'une page.
 */
export const useFinAttente = (enCours) => {
  const [visible, setVisible] = useState(enCours)
  const [avant, setAvant] = useState(enCours)
  // Ajustement au rendu (pas dans un effet) : une nouvelle attente rend la barre visible.
  if (enCours !== avant) {
    setAvant(enCours)
    if (enCours) setVisible(true)
  }
  const onFin = () => {
    if (!enCours) setVisible(false)
  }
  return { visible: visible || enCours, fini: (visible || enCours) && !enCours, onFin }
}
