import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import PageEchecChargement from '../../components/PageEchecChargement'
import { DUREES } from '../../lib/durees'
import { deconnecterSource, getPlansDeSource, getStatutSources } from '../../lib/sources'
import { useConnexionSource } from '../../hooks/useConnexionSource'
import { space } from '../../styles/tokens'
import Page from '../../ui/Page'
import Carte from '../../ui/Carte'
import LigneSaisie from '../../ui/LigneSaisie'
import Pastille from '../../ui/Pastille'
import Bouton from '../../ui/Bouton'
import FeuilleFlottante from '../../ui/FeuilleFlottante'
import BarreAttente from '../../ui/BarreAttente'
import { useAction } from '../../ui/useAction'
import { useFinAttente } from '../../ui/useFinAttente'
import { nomSource } from '../../../supabase/functions/_shared/sources/catalog.ts'
import LogoSource from './LogoSource'
import {
  phraseDeconnexion, sourcesAffichees, sourcesAjoutables, titreActions, titreExpiree,
} from './sources'

const CHEMIN = '/compte/sources'

// Ligne de source : 56 px (planche « Sources de données »).
const LIGNE_SX = { minHeight: '56px' }

// La carte d'attente annule l'écart de la colonne : son propre écart s'ouvre et se
// replie avec elle (comme la page Compte).
const ATTENTE_SX = { mb: `-${space[12]}`, '& .MuiCollapse-wrapperInner': { pb: space[12] } }

/** État des sources du compte et, pour chacune, les noms des plans en cours qui l'utilisent. */
const charger = async () => {
  const statuts = await getStatutSources()
  const plans = Object.fromEntries(await Promise.all(
    statuts.map(async (s) => [s.id, await getPlansDeSource(s.id)]),
  ))
  return { statuts, plans }
}

/**
 * Sources de données : une ligne par source connectée ou expirée, ses actions en
 * feuille, et « Ajouter une source » tant qu'une source du catalogue manque.
 * Nom, logo et capacités viennent du catalogue commun.
 */
const SourcesPage = () => {
  const [chargement, setChargement] = useState({ status: 'loading', essai: 0 })
  const attente = useFinAttente(chargement.status === 'loading')
  // Feuille ouverte et source visée ; la cible reste pendant que la feuille descend.
  const [feuille, setFeuille] = useState(null) // 'actions' | 'confirmation' | 'ajout' | null
  const [cible, setCible] = useState(null)

  const connexion = useConnexionSource()
  const nomCible = nomSource(cible)
  const deconnexion = useAction({
    attente: `Déconnexion de ${nomCible}`,
    duree: DUREES.sources,
    echec: `La déconnexion de ${nomCible} n'a pas abouti. Réessaie.`,
  })

  useEffect(() => {
    let annule = false
    charger().then(
      (donnees) => { if (!annule) setChargement((c) => ({ ...c, status: 'ready', donnees })) },
      (err) => {
        console.error('[sources] chargement :', err)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [chargement.essai])

  // Retour au premier plan (après l'autorisation chez la marque) : relu sans barre ;
  // un échec garde ce qui est affiché.
  useEffect(() => {
    const surRetour = () => {
      if (document.visibilityState !== 'visible') return
      charger().then(
        (donnees) => setChargement((c) => (c.status === 'ready' ? { ...c, donnees } : c)),
        (err) => console.error('[sources] relecture :', err),
      )
    }
    document.addEventListener('visibilitychange', surRetour)
    return () => document.removeEventListener('visibilitychange', surRetour)
  }, [])

  const reessayer = () => setChargement((c) => ({ ...c, status: 'loading', essai: c.essai + 1 }))

  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.sources} {...attente} />
      </Box>
    )
  }

  if (chargement.status === 'error') {
    return <PageEchecChargement titre="Impossible de charger tes sources" onReessayer={reessayer} />
  }

  const { statuts, plans } = chargement.donnees
  const affichees = sourcesAffichees(statuts)
  const ajoutables = sourcesAjoutables(statuts)
  const etatCible = statuts.find((s) => s.id === cible)?.etat

  const ouvrir = (type, id = cible) => {
    setCible(id)
    setFeuille(type)
  }
  const fermer = () => setFeuille(null)
  const connecter = (id) => connexion.lancer(id, CHEMIN)

  const deconnecter = async () => {
    const id = cible
    const { ok } = await deconnexion.lancer(() => deconnecterSource(id))
    if (!ok) return
    setChargement((c) => ({
      ...c,
      donnees: { ...c.donnees, statuts: c.donnees.statuts.filter((s) => s.id !== id) },
    }))
  }

  const lignesActions = etatCible === 'expiree'
    ? [
        { libelle: `Reconnecter ${nomCible}`, onClick: () => connecter(cible) },
        { libelle: `Déconnecter ${nomCible}`, sansFermer: true, onClick: () => ouvrir('confirmation') },
      ]
    : [{ libelle: `Déconnecter ${nomCible}`, sansFermer: true, onClick: () => ouvrir('confirmation') }]

  return (
    <Page>
      <BarreAttente place="carte" {...connexion.barre} sx={ATTENTE_SX} />
      <BarreAttente place="carte" {...deconnexion.barre} sx={ATTENTE_SX} />

      <Typography variant="secondaire" sx={{ color: 'muted' }}>
        Les services d'où viennent tes données. Chaque plan choisit sa source à sa création.
      </Typography>

      {affichees.length > 0 && (
        <Carte sansMarge>
          {affichees.map((s) => (
            <LigneSaisie
              key={s.id}
              type="choix"
              libelle={s.nom}
              libelleFort
              gauche={<LogoSource logo={s.logo} />}
              droite={s.etat === 'expiree'
                ? <Pastille variante="contour">Expirée</Pastille>
                : <Pastille variante="pleine">Connectée</Pastille>}
              disabled={connexion.enCours || deconnexion.enCours}
              onClick={() => ouvrir('actions', s.id)}
              sx={LIGNE_SX}
            />
          ))}
        </Carte>
      )}

      {ajoutables.length > 0 && (
        <Bouton
          variante="ink"
          niveau="page"
          pleineLargeur
          disabled={connexion.enCours || deconnexion.enCours}
          onClick={() => setFeuille('ajout')}
        >
          Ajouter une source
        </Bouton>
      )}

      <FeuilleFlottante
        ouverte={feuille === 'actions'}
        onFermer={fermer}
        titre={etatCible === 'expiree' ? titreExpiree(cible) : titreActions(cible)}
        lignes={lignesActions}
      />

      <FeuilleFlottante
        ouverte={feuille === 'confirmation'}
        onFermer={fermer}
        titre={phraseDeconnexion(cible, plans[cible] ?? [])}
        lignes={[{ libelle: `Déconnecter ${nomCible}`, onClick: deconnecter }]}
        fermerLibelle="Annuler"
      />

      <FeuilleFlottante
        ouverte={feuille === 'ajout'}
        onFermer={fermer}
        titre="Ajouter une source"
        lignes={ajoutables.map((s) => ({
          libelle: s.nom,
          icone: <LogoSource logo={s.logo} />,
          onClick: () => connecter(s.id),
        }))}
      />
    </Page>
  )
}

export default SourcesPage
