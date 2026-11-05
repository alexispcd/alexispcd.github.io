import { useEffect, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { bandeLaPlusProche } from '../../../supabase/functions/_shared/strength/compose.ts'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import CarteSysteme from '../../components/CarteSysteme'
import { DUREES } from '../../lib/durees'
import { enregistrerReglages, getBands, getExerciseBases, getProfile, saveProfile } from '../../lib/renfo'
import { SPACE_BAS, space } from '../../styles/tokens'
import BarreAttente from '../../ui/BarreAttente'
import BarreBas from '../../ui/BarreBas'
import Bouton from '../../ui/Bouton'
import Carte from '../../ui/Carte'
import ControleSegmente from '../../ui/ControleSegmente'
import FeuilleFlottante from '../../ui/FeuilleFlottante'
import GardeChangements from '../../ui/GardeChangements'
import LigneSaisie from '../../ui/LigneSaisie'
import Pastille from '../../ui/Pastille'
import { useAction } from '../../ui/useAction'
import { useFinAttente } from '../../ui/useFinAttente'
import { formatKg } from './bandColor'
import {
  appliquerReport, lirePoids, memesReglages, nombreExercices, phraseSuppression, planDeReport,
} from './reglages'
import FeuilleElastique from './settings/FeuilleElastique'

const PROFIL_DEFAUT = { frequency: 2, equipment: [] }
const COULEUR_DEFAUT = '#2F68CC'

const OBJETS = {
  bar: {
    libelle: 'Barre de traction',
    phrase: 'Les exercices à la barre ne seront plus proposés dans tes prochaines séances.',
    retirer: 'Retirer la barre de traction',
  },
  chair: {
    libelle: 'Chaise',
    phrase: 'Les exercices avec chaise ne seront plus proposés dans tes prochaines séances.',
    retirer: 'Retirer la chaise',
  },
}
const ORDRE_OBJETS = ['bar', 'chair']

// Sans profil, il est créé avec les valeurs par défaut, sans rien afficher ; si
// l'écriture échoue, la page continue avec ces valeurs (l'ouverture suivante réessaiera).
const chargerReglages = async () => {
  const [profil, bands, bases] = await Promise.all([getProfile(), getBands(), getExerciseBases()])
  let p = profil
  if (!p) {
    try {
      p = await saveProfile(PROFIL_DEFAUT)
    } catch (e) {
      console.error('[renfo settings] création du profil', e)
      p = PROFIL_DEFAUT
    }
  }
  return {
    enregistre: {
      frequency: p.frequency,
      equipment: p.equipment ?? [],
      bands: bands.map(({ kg, color }) => ({ kg, color })),
    },
    bases,
  }
}

// Brouillon tiré de l'enregistré : chaque élastique vient de son propre poids.
const brouillonDe = (enregistre) => ({
  ...enregistre,
  equipment: [...enregistre.equipment],
  bands: enregistre.bands.map((b) => ({ ...b, origine: b.kg })),
})

const parPoids = (bands) => [...bands].sort((a, b) => a.kg - b.kg)

const Etiquette = ({ children }) => (
  <Typography variant="etiquette" component="h2" sx={{ color: 'muted', px: space[4], pt: space[8] }}>{children}</Typography>
)

/** Réglages Renfo : objectif par semaine et matériel, enregistrés d'un coup par la barre du bas. */
const SettingsPage = () => {
  const [chargement, setChargement] = useState({ status: 'loading', essai: 0 })
  const [brouillon, setBrouillon] = useState(null)
  // Feuille ouverte et sa cible (kg d'un élastique, 'bar' ou 'chair'), gardée pendant la fermeture.
  const [feuille, setFeuille] = useState(null) // 'choix' | 'actions' | 'elastique' | 'suppression' | 'retrait' | null
  const [cible, setCible] = useState(null)
  const [saisie, setSaisie] = useState(null) // { kgTexte, color } de la feuille élastique
  const attente = useFinAttente(chargement.status === 'loading')
  const action = useAction({
    attente: 'Enregistrement de tes réglages', duree: DUREES.enregistrement,
    echec: "Tes réglages n'ont pas pu être enregistrés. Réessaie.",
  })

  useEffect(() => {
    let annule = false
    chargerReglages().then(
      (res) => {
        if (annule) return
        setChargement((c) => ({ ...c, status: 'ready', ...res }))
        setBrouillon(brouillonDe(res.enregistre))
      },
      (err) => {
        console.error('[renfo settings]', err)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [chargement.essai])

  const reessayer = () => setChargement((c) => ({ status: 'loading', essai: c.essai + 1 }))

  if (attente.visible || chargement.status === 'loading') {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }
  if (chargement.status === 'error' || !brouillon) {
    return (
      <Box sx={{ px: space[16], pt: `calc(${HEADER_HEIGHT}px + ${space[8]})` }}>
        <CarteSysteme
          titre="Impossible de charger les réglages"
          phrase="Les données n'ont pas pu être chargées."
          bouton="Réessayer"
          onClick={reessayer}
        />
      </Box>
    )
  }

  const { enregistre, bases } = chargement
  const change = !memesReglages(brouillon, enregistre)
  const enAttente = action.barre.visible
  const bandes = parPoids(brouillon.bands)
  const objets = ORDRE_OBJETS.filter((id) => brouillon.equipment.includes(id))
  const avecMateriel = objets.length > 0 || bandes.length > 0

  const ouvrir = (nom, c = null) => {
    setCible(c)
    setFeuille(nom)
  }

  const fermer = () => setFeuille(null)

  const ajouterObjet = (id) => setBrouillon((b) => ({ ...b, equipment: [...b.equipment, id] }))
  const retirerObjet = (id) => setBrouillon((b) => ({ ...b, equipment: b.equipment.filter((e) => e !== id) }))

  const ouvrirElastique = (kg) => {
    const bande = kg == null ? null : brouillon.bands.find((b) => b.kg === kg)
    setSaisie({ kgTexte: bande ? formatKg(bande.kg) : '', color: bande?.color ?? COULEUR_DEFAUT })
    ouvrir('elastique', kg)
  }

  // Feuille élastique : poids pris par un autre élastique du brouillon que celui modifié.
  // Calculé seulement feuille ouverte : rien ne bouge pendant sa fermeture.
  const poidsSaisi = saisie && feuille === 'elastique' ? lirePoids(saisie.kgTexte) : NaN
  const pris = Number.isFinite(poidsSaisi) && brouillon.bands.some((b) => b.kg === poidsSaisi && b.kg !== cible)
  const saisieValide = poidsSaisi > 0 && !pris

  const enregistrerElastique = () => {
    if (!saisieValide) return
    setBrouillon((b) => ({
      ...b,
      bands: cible == null
        ? [...b.bands, { kg: poidsSaisi, color: saisie.color, origine: null }]
        : b.bands.map((x) => (x.kg === cible ? { ...x, kg: poidsSaisi, color: saisie.color } : x)),
    }))
    setCible(cible == null ? null : poidsSaisi)
    fermer()
  }

  const supprimerElastique = () => setBrouillon((b) => ({ ...b, bands: b.bands.filter((x) => x.kg !== cible) }))

  // Confirmation de suppression, calculée sur le brouillon.
  const titreSuppression = typeof cible === 'number'
    ? phraseSuppression(
        cible,
        nombreExercices(bases, planDeReport(enregistre.bands, brouillon.bands), cible),
        bandeLaPlusProche(cible, brouillon.bands.filter((b) => b.kg !== cible).map((b) => b.kg)),
      )
    : ''

  const enregistrer = async () => {
    const envoi = brouillon
    const report = planDeReport(enregistre.bands, envoi.bands)
    const { ok } = await action.lancer(() => enregistrerReglages({
      frequency: envoi.frequency, equipment: envoi.equipment, bands: envoi.bands, report,
    }))
    if (!ok) return
    const nouveau = {
      frequency: envoi.frequency,
      equipment: [...envoi.equipment],
      bands: parPoids(envoi.bands).map(({ kg, color }) => ({ kg, color })),
    }
    setChargement((c) => ({ ...c, enregistre: nouveau, bases: appliquerReport(c.bases, report) }))
    setBrouillon(brouillonDe(nouveau))
  }

  const objetRetire = OBJETS[cible] ?? null

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', overscrollBehavior: 'none', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          flex: '1 0 auto',
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: space[12],
          px: space[16],
          pt: `calc(${HEADER_HEIGHT}px + ${space[8]})`,
          pb: change || enAttente ? space[24] : SPACE_BAS,
          pointerEvents: enAttente ? 'none' : undefined,
        }}
      >
        <Etiquette>Objectif par semaine</Etiquette>
        <Carte>
          <ControleSegmente
            label="Séances par semaine"
            options={[1, 2, 3].map((n) => ({ valeur: n, libelle: String(n) }))}
            valeur={brouillon.frequency}
            onChange={(n) => setBrouillon((b) => ({ ...b, frequency: n }))}
          />
        </Carte>

        <Etiquette>Matériel</Etiquette>
        {avecMateriel ? (
          <Carte sansMarge>
            {objets.map((id) => (
              <LigneSaisie key={id} type="choix" libelle={OBJETS[id].libelle} onClick={() => ouvrir('retrait', id)} />
            ))}
            {bandes.map((b) => (
              <LigneSaisie
                key={b.kg}
                type="choix"
                libelle="Élastique"
                aria-label={`Élastique de ${formatKg(b.kg)} kg`}
                droite={<Pastille variante="bande" grande couleur={b.color}>{`${formatKg(b.kg)} kg`}</Pastille>}
                onClick={() => ouvrir('actions', b.kg)}
              />
            ))}
          </Carte>
        ) : (
          <Typography variant="secondaire" sx={{ color: 'muted', px: space[4] }}>
            Sans matériel, seuls les exercices au poids du corps sont proposés.
          </Typography>
        )}
        <Bouton niveau="page" pleineLargeur onClick={() => ouvrir('choix')} sx={{ mt: space[8] }}>
          Ajouter du matériel
        </Bouton>
      </Box>

      {(change || enAttente) && (
        <BarreBas>
          {enAttente
            ? <BarreAttente place="barre" {...action.barre} sx={{ flex: 1, minWidth: 0 }} />
            : <Bouton onClick={enregistrer} sx={{ flex: 1 }}>Enregistrer</Bouton>}
        </BarreBas>
      )}

      <FeuilleFlottante
        ouverte={feuille === 'choix'}
        onFermer={fermer}
        titre="Ajouter du matériel"
        lignes={[
          ...ORDRE_OBJETS.filter((id) => !brouillon.equipment.includes(id))
            .map((id) => ({ libelle: OBJETS[id].libelle, onClick: () => ajouterObjet(id) })),
          { libelle: 'Élastique', onClick: () => ouvrirElastique(null) },
        ]}
      />

      <FeuilleFlottante
        ouverte={feuille === 'actions'}
        onFermer={fermer}
        titre={typeof cible === 'number' ? `Élastique de ${formatKg(cible)} kg` : ''}
        lignes={[
          { libelle: "Modifier l'élastique", onClick: () => ouvrirElastique(cible) },
          { libelle: "Supprimer l'élastique", onClick: () => ouvrir('suppression', cible) },
        ]}
      />

      <FeuilleElastique
        ouverte={feuille === 'elastique'}
        titre={cible == null ? 'Ajouter un élastique' : "Modifier l'élastique"}
        valeur={saisie}
        onChange={setSaisie}
        pris={pris}
        valide={saisieValide}
        onEnregistrer={enregistrerElastique}
        onAnnuler={fermer}
      />

      <FeuilleFlottante
        ouverte={feuille === 'suppression'}
        onFermer={fermer}
        titre={titreSuppression}
        lignes={[{ libelle: "Supprimer l'élastique", onClick: supprimerElastique }]}
        fermerLibelle="Annuler"
      />

      <FeuilleFlottante
        ouverte={feuille === 'retrait'}
        onFermer={fermer}
        titre={objetRetire?.phrase ?? ''}
        lignes={objetRetire ? [{ libelle: objetRetire.retirer, onClick: () => retirerObjet(cible) }] : []}
        fermerLibelle="Annuler"
      />

      <GardeChangements actif={change} />
    </Box>
  )
}

export default SettingsPage
