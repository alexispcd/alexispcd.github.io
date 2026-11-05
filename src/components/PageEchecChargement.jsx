import Page from '../ui/Page'
import CarteSysteme from './CarteSysteme'

/**
 * Page d'échec du chargement d'un écran : CarteSysteme avec « Les données n'ont pas
 * pu être chargées. » et « Réessayer » (onReessayer relance le chargement).
 * Utilisée par le dashboard Training et l'entrée /training.
 */
const PageEchecChargement = ({ titre, onReessayer }) => (
  <Page>
    <CarteSysteme
      titre={titre}
      phrase="Les données n'ont pas pu être chargées."
      bouton="Réessayer"
      onClick={onReessayer}
    />
  </Page>
)

export default PageEchecChargement
