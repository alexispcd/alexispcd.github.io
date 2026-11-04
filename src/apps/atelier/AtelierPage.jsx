// Atelier : chaque composant de src/ui dans tous ses états, pour les regarder sur
// l'iPhone pendant la refonte. Exemples fictifs : rien n'est chargé ni enregistré, sauf
// les trois essais de la section Réseau (lecture seule, ou écriture qui ne vise aucune ligne).
// Page temporaire, retirée avec sa ligne du menu du compte à la fin de la refonte (F1).
import { useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { SPACE_BAS, border, radius, space } from '../../styles/tokens'
import { PAIN_CHIPS } from '../../lib/feedback'
import { BAND_PALETTE } from '../renfo/bandColor'
import {
  ChevronRetour, ChevronDroit, ChevronBas, ChevronHaut, TroisPoints, Montre, Croix, Partager,
  Coche, Moins, Plus,
} from '../../ui/Icones'
import Bouton from '../../ui/Bouton'
import Carte from '../../ui/Carte'
import Pastille from '../../ui/Pastille'
import PastilleACocher from '../../ui/PastilleACocher'
import BoutonIcone from '../../ui/BoutonIcone'
import ControleSegmente from '../../ui/ControleSegmente'
import Compteur from '../../ui/Compteur'
import Option from '../../ui/Option'
import LigneSaisie from '../../ui/LigneSaisie'
import BarreProgression from '../../ui/BarreProgression'
import BarreStructure from '../../ui/BarreStructure'
import MarqueSeance from '../../ui/MarqueSeance'
import { useValeurAnimee } from '../../ui/useValeurAnimee'
import FeuilleFlottante from '../../ui/FeuilleFlottante'
import BarreAttente from '../../ui/BarreAttente'
import { useFinAttente } from '../../ui/useFinAttente'
import { useMessage, useBarreBasMessage } from '../../ui/useMessage'
import { useAction } from '../../ui/useAction'
import { PAS_DE_CONNEXION, estErreurReseau } from '../../lib/reseau'
import { DUREES } from '../../lib/durees'
import { getCorosStatus } from '../../lib/training'
import supabase from '../../lib/supabase'

const Section = ({ titre, children }) => (
  <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
    <Typography variant="etiquette" component="h2" sx={{ color: 'muted' }}>{titre}</Typography>
    {children}
  </Box>
)

const Rangee = ({ children, sx }) => (
  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space[8], ...sx }}>{children}</Box>
)

const Note = ({ children }) => (
  <Typography variant="legende" sx={{ color: 'muted' }}>{children}</Typography>
)

const ICONES = [
  ['Retour', ChevronRetour], ['Droit', ChevronDroit], ['Bas', ChevronBas], ['Haut', ChevronHaut],
  ['Actions', TroisPoints], ['Montre', Montre], ['Croix', Croix], ['Partager', Partager],
  ['Coche', Coche], ['Moins', Moins], ['Plus', Plus],
]

// Exemple : 6 × 1000 m, 15 min d'échauffement, récup 1:30, 10 min de retour au calme.
const FRACTIONNE = [
  { duree: 900, type: 'calme' },
  ...Array.from({ length: 6 }).flatMap((_, i) => [
    { duree: 243, type: 'effort' },
    ...(i < 5 ? [{ duree: 90, type: 'recup' }] : []),
  ]),
  { duree: 600, type: 'calme' },
]
const LONGUE = [{ duree: 600, type: 'calme' }, { duree: 5100, type: 'effort' }, { duree: 300, type: 'calme' }]

const KM = [7.9, 18.4, 33, 0, 12.6]
const ETATS = ['faite', 'aFaire', 'adaptee', 'sautee', 'aucune', 'course']
const ZONES = ['facile', 'qualite', 'longue', 'ink']
const ACTIVITES = [
  { id: 'a1', date: 'mar 27 oct', chiffres: '9,58 km · 49:29 · 5:10 /km' },
  { id: 'a2', date: 'lun 26 oct', chiffres: '7,90 km · 45:48 · 5:48 /km' },
  { id: 'a3', date: 'sam 24 oct', chiffres: '17,02 km · 1:35:58 · 5:38 /km' },
]
const MODULES = ['Training', 'Renfo', 'Côtes']
const BANDES = [BAND_PALETTE[0], BAND_PALETTE[2], BAND_PALETTE[6], BAND_PALETTE[10]]

const attendre = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

// ─── Feuille flottante ──────────────────────────────────────────────────────

const LONGUE_FEUILLE = Array.from({ length: 18 }, (_, i) => `Exercice ${i + 1}`)

const DemoFeuille = () => {
  const { afficher } = useMessage()
  const [ouverte, setOuverte] = useState(null)
  const fermer = () => setOuverte(null)
  const ligne = (libelle) => ({ libelle, onClick: () => afficher(`« ${libelle} » touché`) })

  return (
    <Section titre="Feuille flottante">
      <Rangee>
        <Bouton petit variante="chip" onClick={() => setOuverte('actions')}>Actions</Bouton>
        <Bouton petit variante="chip" onClick={() => setOuverte('confirmation')}>Confirmation</Bouton>
        <Bouton petit variante="chip" onClick={() => setOuverte('sauter')}>Sauter, 2 lignes</Bouton>
        <Bouton petit variante="chip" onClick={() => setOuverte('longue')}>Feuille longue</Bouton>
      </Rangee>
      <FeuilleFlottante
        ouverte={ouverte === 'actions'}
        onFermer={fermer}
        titre="Tempo continu 20 min"
        lignes={[ligne('Envoyer sur la montre'), ligne('Voir l\'analyse'), ligne('Sauter la séance')]}
      />
      <FeuilleFlottante
        ouverte={ouverte === 'confirmation'}
        onFermer={fermer}
        titre="Corps complet sera supprimée. Tu pourras en créer une autre depuis l'accueil."
        lignes={[ligne('Supprimer la séance')]}
        fermerLibelle="Annuler"
      />
      <FeuilleFlottante
        ouverte={ouverte === 'sauter'}
        onFermer={fermer}
        titre="Tu sautes Tempo continu 20 min. Elle reste sur ta montre (jeu 29 oct) : supprime-la dans l'app Coros. Adapter les séances des 10 prochains jours pour compenser ?"
        lignes={[ligne('Sauter et adapter'), ligne('Sauter sans adapter')]}
        fermerLibelle="Annuler"
      />
      <FeuilleFlottante
        ouverte={ouverte === 'longue'}
        onFermer={fermer}
        titre="Remplacer l'exercice"
        lignes={[...LONGUE_FEUILLE.map(ligne), { libelle: 'Exercice indisponible', disabled: true }]}
      />
    </Section>
  )
}

// ─── Barre d'attente ────────────────────────────────────────────────────────

const DUREES_DEMO = [
  { valeur: 150, libelle: '150 ms' },
  { valeur: 1200, libelle: '1,2 s' },
  { valeur: 4000, libelle: '4 s' },
  { valeur: 15000, libelle: '15 s' },
]

// Une attente simulée : `reponse` ms avant la réponse, rythme de DUREES.chargementPage.
const useAttenteSimulee = (reponse) => {
  const [enCours, setEnCours] = useState(false)
  const fin = useFinAttente(enCours)
  const lancer = () => {
    if (enCours) return
    setEnCours(true)
    setTimeout(() => setEnCours(false), reponse)
  }
  return { lancer, enCours, ...fin }
}

const DemoAttente = () => {
  const [reponse, setReponse] = useState(1200)
  const page = useAttenteSimulee(reponse)
  const carte = useAttenteSimulee(reponse)
  const barre = useAttenteSimulee(reponse)
  const section = useAttenteSimulee(reponse)
  const [pageChargee, setPageChargee] = useState(false)
  const duree = DUREES.chargementPage
  const props = (a) => ({ duree, visible: a.visible, fini: a.fini, onFin: a.onFin })

  return (
    <Section titre="Barre d'attente">
      <ControleSegmente label="Durée de la réponse" valeur={reponse} onChange={setReponse} options={DUREES_DEMO} />
      <Note>{`Durée habituelle : ${duree} ms. La réponse arrive après la durée choisie.`}</Note>

      <Note>Page : la zone se remplit à la fin de la barre</Note>
      <Carte sx={{ height: '160px', justifyContent: 'center' }}>
        {page.visible
          ? <BarreAttente place="page" phrase="Chargement de la page" {...props(page)} />
          : (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[8] }}>
              <Typography variant="corps">{pageChargee ? 'Page chargée.' : 'Page vide.'}</Typography>
              <Bouton petit variante="chip" onClick={() => { setPageChargee(true); page.lancer() }}>Charger</Bouton>
            </Box>
          )}
      </Carte>

      <Note>Carte en tête de page</Note>
      <BarreAttente place="carte" phrase="Envoi sur ta montre" detail="Sortie longue modérée · sam 31 oct" {...props(carte)} />
      <Bouton petit variante="chip" disabled={carte.visible} raison="Une attente est en cours." onClick={carte.lancer}>Lancer la carte</Bouton>

      <Note>Barre du bas ou place d'un bouton</Note>
      <Carte>
        {barre.visible
          ? <BarreAttente place="barre" phrase="Validation et analyse de ta séance" {...props(barre)} />
          : <Bouton pleineLargeur onClick={barre.lancer}>Valider</Bouton>}
      </Carte>

      <Note>Section qui se remplit seule</Note>
      <Carte sx={{ gap: space[12] }}>
        <Typography variant="secondaire" sx={{ color: 'muted' }}>Recherche sur ta source autour du créneau.</Typography>
        {section.visible
          ? <BarreAttente place="section" phrase="Recherche des activités" {...props(section)} />
          : <Bouton petit variante="chip" onClick={section.lancer}>Chercher</Bouton>}
      </Carte>
    </Section>
  )
}

// ─── Message ────────────────────────────────────────────────────────────────

const DemoMessage = () => {
  const { afficher, afficherFixe, retirerFixe } = useMessage()
  const [barreBas, setBarreBas] = useState(false)
  const barreRef = useRef(null)
  useBarreBasMessage(barreRef, barreBas)

  return (
    <Section titre="Message">
      <Rangee>
        <Bouton petit variante="chip" onClick={() => afficher('Montre mise à jour')}>Court</Bouton>
        <Bouton petit variante="chip" onClick={() => afficher('Séance envoyée. Supprime l\'ancienne copie dans l\'app Coros.')}>Long</Bouton>
        <Bouton petit variante="chip" onClick={() => afficher('2 séances adaptées')}>Un second</Bouton>
      </Rangee>
      <Rangee>
        <Bouton petit variante="chip" onClick={() => afficherFixe({
          texte: 'Nouvelle version disponible',
          action: { libelle: 'Recharger', onClick: () => afficher('« Recharger » touché') },
        })}
        >
          Fixe
        </Bouton>
        <Bouton petit variante="chip" onClick={retirerFixe}>Retirer le fixe</Bouton>
        <Bouton petit variante="chip" onClick={() => setBarreBas(!barreBas)}>
          {barreBas ? 'Sans barre du bas' : 'Avec barre du bas'}
        </Bouton>
      </Rangee>
      <Note>« Un second » remplace le premier. Un court passe devant le fixe, qui revient après 4 s.</Note>
      {barreBas && (
        <Box
          ref={barreRef}
          sx={{
            position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1100,
            bgcolor: 'surface', borderTop: `${border.filet} solid`, borderColor: 'line',
            pt: space[12], px: space[16], pb: SPACE_BAS,
          }}
        >
          <Bouton pleineLargeur onClick={() => afficher('Message posé au-dessus de la barre')}>Fausse barre du bas</Bouton>
        </Box>
      )}
    </Section>
  )
}

// ─── Action ─────────────────────────────────────────────────────────────────

const DemoUneAction = ({ libelle, options, fn }) => {
  const { lancer, barre } = useAction(options)
  return barre.visible
    ? <BarreAttente place="barre" {...barre} />
    : <Bouton pleineLargeur variante="chip" onClick={() => lancer(fn)}>{libelle}</Bouton>
}

const DemoAction = () => (
  <Section titre="Action">
    <Carte sx={{ gap: space[12] }}>
      <DemoUneAction
        libelle="Réussie"
        options={{ attente: 'Mise à jour de ta montre', duree: DUREES.envoiMontre, succes: 'Montre mise à jour', echec: 'La mise à jour de ta montre n\'a pas abouti. Réessaie.' }}
        fn={() => attendre(DUREES.envoiMontre)}
      />
      <DemoUneAction
        libelle="Échec du serveur"
        options={{ attente: 'Envoi sur ta montre', duree: DUREES.envoiMontre, succes: 'Séance envoyée sur ta montre', echec: 'L\'envoi sur ta montre n\'a pas abouti. Réessaie.' }}
        fn={() => attendre(1500).then(() => { throw Object.assign(new Error('Erreur serveur (500)'), { status: 500 }) })}
      />
      <DemoUneAction
        libelle="Échec réseau simulé"
        options={{ attente: 'Enregistrement de tes réglages', duree: DUREES.enregistrement, echec: 'Les réglages n\'ont pas pu être enregistrés. Réessaie.' }}
        fn={() => attendre(800).then(() => { throw new TypeError('Load failed') })}
      />
    </Carte>
    <Note>{`Sans réseau, aucune barre : « ${PAS_DE_CONNEXION} » tout de suite.`}</Note>
  </Section>
)

// ─── Réseau ─────────────────────────────────────────────────────────────────

const champsErreur = (e) => ({
  name: e?.name ?? '',
  message: e?.message ?? String(e),
  code: e?.code ?? '',
  network: String(e?.network ?? ''),
  estErreurReseau: String(estErreurReseau(e)),
})

const DemoReseau = () => {
  const [resultat, setResultat] = useState(null)
  const [enCours, setEnCours] = useState(false)

  const essayer = async (nom, fn) => {
    if (enCours) return
    setEnCours(true)
    const enLigne = String(navigator.onLine)
    const t0 = performance.now()
    let detail
    try {
      const { error } = await fn()
      detail = error ? champsErreur(error) : { resultat: 'ok' }
    } catch (e) {
      detail = champsErreur(e)
    }
    setResultat({ nom, 'navigator.onLine': enLigne, duree: `${Math.round(performance.now() - t0)} ms`, ...detail })
    setEnCours(false)
  }

  return (
    <Section titre="Réseau">
      <Rangee>
        <Bouton petit variante="chip" onClick={() => essayer('callFunction', () => getCorosStatus().then(() => ({})))}>callFunction</Bouton>
        <Bouton petit variante="chip" onClick={() => essayer('lecture', () => supabase.from('user_preferences').select('key').limit(1))}>Lecture</Bouton>
        <Bouton petit variante="chip" onClick={() => essayer('écriture', () => supabase.from('user_preferences').update({ value: '__atelier__' }).eq('key', '__atelier__'))}>Écriture</Bouton>
      </Rangee>
      <Note>callFunction : état de la source (lecture seule). Écriture : aucune ligne visée.</Note>
      <Carte sx={{ gap: space[4] }}>
        {enCours && <Typography variant="corps" sx={{ color: 'muted' }}>En cours</Typography>}
        {!enCours && !resultat && <Typography variant="corps" sx={{ color: 'muted' }}>Aucun essai.</Typography>}
        {!enCours && resultat && Object.entries(resultat).map(([cle, valeur]) => (
          <Box key={cle} sx={{ display: 'flex', gap: space[8] }}>
            <Typography variant="legende" sx={{ color: 'muted', width: '120px', flexShrink: 0 }}>{cle}</Typography>
            <Typography variant="legende" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>{valeur}</Typography>
          </Box>
        ))}
      </Carte>
    </Section>
  )
}

const AtelierPage = () => {
  const [intensite, setIntensite] = useState('normale')
  const [exercices, setExercices] = useState(3)
  const [tours, setTours] = useState(1)
  const [temps, setTemps] = useState('realiste')
  const [douleurs, setDouleurs] = useState(['genou_g'])
  const [vma, setVma] = useState('16,6')
  const [seuil, setSeuil] = useState('')
  const [nom, setNom] = useState('Pr 10k')
  const [activites, setActivites] = useState(['a1'])
  const [sansActivite, setSansActivite] = useState(false)
  const [modules, setModules] = useState(['Training'])
  const [indexKm, setIndexKm] = useState(0)
  const [faite, setFaite] = useState(false)
  const [connectee, setConnectee] = useState(true)

  const km = KM[indexKm]
  const kmAffiche = useValeurAnimee(km)
  const toggle = (list, setList, item) => setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item])
  const toggleActivite = (id) => {
    setSansActivite(false)
    if (activites.includes(id)) setActivites(activites.filter((x) => x !== id))
    else if (activites.length < 3) setActivites([...activites, id])
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px` }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[24], px: space[16], pt: space[8], pb: `calc(${SPACE_BAS} + ${space[24]})` }}>
        <Typography variant="secondaire" sx={{ color: 'muted' }}>
          Composants du Design System, avec des exemples fictifs : rien n'est chargé ni enregistré, sauf les essais de la section Réseau.
        </Typography>

        <Section titre="Icônes">
          <Carte>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: space[12] }}>
              {ICONES.map(([nomIcone, Icone]) => (
                <Box key={nomIcone} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: space[4] }}>
                  <Icone taille={24} />
                  <Note>{nomIcone}</Note>
                </Box>
              ))}
            </Box>
          </Carte>
        </Section>

        <Section titre="Bouton">
          <Carte sx={{ gap: space[12] }}>
            <Note>Dans une carte : radius-inner</Note>
            <Rangee>
              <Bouton variante="chip">Recommencer</Bouton>
              <Bouton>Reprendre</Bouton>
              <Bouton variante="texte">Changer d'e-mail</Bouton>
            </Rangee>
            <Rangee>
              <Bouton petit>Ajouter</Bouton>
              <Bouton petit variante="chip">Annuler</Bouton>
            </Rangee>
            <Bouton pleineLargeur disabled raison="Choisis une date pour continuer.">Continuer</Bouton>
          </Carte>
          <Note>Au niveau des cartes : radius-card</Note>
          <Box sx={{ display: 'flex', gap: space[12] }}>
            <Bouton niveau="page" variante="chip" pleineLargeur>Archiver le plan</Bouton>
            <Bouton niveau="page" variante="chip" pleineLargeur>Supprimer le plan</Bouton>
          </Box>
          <Bouton niveau="page" pleineLargeur>Valider la séance</Bouton>
        </Section>

        <Section titre="Carte">
          <Carte>
            <Typography variant="corps-fort">Carte avec marge</Typography>
            <Typography variant="secondaire" sx={{ color: 'muted' }}>Fond surface, 14 px de marge, sans ombre.</Typography>
          </Carte>
          <Carte sansMarge>
            <LigneSaisie libelle="Carte sans marge, pour des lignes" valeur="exemple" />
            <LigneSaisie libelle="Deuxième ligne" valeur="exemple" />
          </Carte>
        </Section>

        <Section titre="Pastille">
          <Carte sx={{ gap: space[12] }}>
            <Rangee>
              <Pastille>Plan actif</Pastille>
              <Pastille variante="contour">S3 / 11</Pastille>
              <Pastille variante="aujourdhui">Aujourd'hui</Pastille>
              <Pastille variante="adaptee">Adaptée</Pastille>
            </Rangee>
            <Rangee>
              <Pastille variante="materiel">Barre en haut</Pastille>
              <Pastille variante="materiel">Chaise</Pastille>
              {BANDES.map((b, i) => (
                <Pastille key={b.hex} variante="bande" couleur={b.hex}>{`${(i + 1) * 5} kg`}</Pastille>
              ))}
              <Note>prévu 15 kg</Note>
              <Pastille variante="enCours">En cours</Pastille>
            </Rangee>
            <Rangee>
              <Pastille variante="bande" couleur={BAND_PALETTE[4].hex} grande>25 kg</Pastille>
              <Note>bande en taille normale (Réglages Renfo)</Note>
            </Rangee>
            <Rangee>
              <Pastille variante={connectee ? 'pleine' : 'contour'}>{connectee ? 'Connectée' : 'Expirée'}</Pastille>
              <Bouton petit variante="chip" onClick={() => setConnectee(!connectee)}>Changer le statut</Bouton>
            </Rangee>
          </Carte>
        </Section>

        <Section titre="Pastille à cocher">
          <Rangee>
            {PAIN_CHIPS.slice(0, 6).map((c) => (
              <PastilleACocher
                key={c.code}
                choisie={douleurs.includes(c.code)}
                onClick={() => toggle(douleurs, setDouleurs, c.code)}
              >
                {c.label}
              </PastilleACocher>
            ))}
          </Rangee>
        </Section>

        <Section titre="Bouton icône">
          <Rangee sx={{ gap: space[12] }}>
            <BoutonIcone label="Retour à l'accueil"><ChevronRetour taille={22} /></BoutonIcone>
            <BoutonIcone label="Actions du plan"><TroisPoints taille={22} /></BoutonIcone>
            <BoutonIcone label="Mon compte" compte>A</BoutonIcone>
            <BoutonIcone label="Masquer"><Croix taille={20} /></BoutonIcone>
          </Rangee>
        </Section>

        <Section titre="Contrôle segmenté">
          <ControleSegmente
            label="Intensité"
            valeur={intensite}
            onChange={setIntensite}
            options={[
              { valeur: 'legere', libelle: 'Légère' },
              { valeur: 'normale', libelle: 'Normale' },
              { valeur: 'soutenue', libelle: 'Soutenue' },
            ]}
          />
        </Section>

        <Section titre="Compteur">
          <Carte sx={{ py: space[4] }}>
            <Compteur libelle="Exercices" valeur={exercices} min={2} max={4} onChange={setExercices}
              labelMoins="Un exercice de moins" labelPlus="Un exercice de plus" />
            <Compteur libelle="Tours" valeur={tours} min={1} max={5} onChange={setTours}
              labelMoins="Un tour de moins" labelPlus="Un tour de plus" />
          </Carte>
        </Section>

        <Section titre="Option">
          <Box role="group" aria-label="Temps visé" sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
            <Option libelle="Réaliste" sousLigne="ta prédiction actuelle" valeur="44:05"
              choisie={temps === 'realiste'} onClick={() => setTemps('realiste')} />
            <Option libelle="Ambitieux" sousLigne="prédiction -2 %" valeur="43:12"
              choisie={temps === 'ambitieux'} onClick={() => setTemps('ambitieux')} />
            <Option libelle="Dans 7 semaines" sousLigne="lun 2 nov" repere="7 semaines"
              choisie={temps === 'semaines'} onClick={() => setTemps('semaines')} />
            <Option libelle="Autre temps" sousLigne="à régler toi-même" chevron
              choisie={temps === 'autre'} onClick={() => setTemps('autre')} />
            <Option libelle="Compacte, sans sous-ligne" sousLigne="masquée" compacte valeur="45:00"
              choisie={temps === 'compacte'} onClick={() => setTemps('compacte')} />
          </Box>
        </Section>

        <Section titre="Ligne de saisie">
          <Carte sansMarge>
            <LigneSaisie libelle="Source" valeur="Coros" />
            <LigneSaisie type="nombre" libelle="VMA" sousLigne="estimée d'après ta VO2max" valeur={vma} onChange={setVma} placeholder="km/h" />
            <LigneSaisie type="texte" libelle="Allure seuil" valeur={seuil} onChange={setSeuil} placeholder="m:ss /km" />
            <LigneSaisie libelle="Objectif" avant="44:00" valeur="43:30" />
            <LigneSaisie type="action" libelle="Ajouter une course" />
          </Carte>
          <Carte sansMarge>
            <LigneSaisie type="grande" libelle="Nom de la course" valeur={nom} onChange={setNom} />
          </Carte>
          <Note>Ligne de source et lignes de matériel, avec emplacements libres</Note>
          <Carte sansMarge>
            <LigneSaisie
              libelle="Coros"
              libelleFort
              aria-label="Actions de Coros"
              gauche={<Box aria-hidden sx={{ width: '28px', height: '28px', flexShrink: 0, borderRadius: radius.small, border: `${border.filet} dashed`, borderColor: 'muted' }} />}
              droite={<Pastille>Connectée</Pastille>}
            />
          </Carte>
          <Carte sansMarge>
            <LigneSaisie libelle="Barre de traction" />
            <LigneSaisie libelle="Chaise" />
            <LigneSaisie libelle="Élastique" droite={<Pastille variante="bande" couleur={BAND_PALETTE[0].hex} grande>10 kg</Pastille>} />
            <LigneSaisie libelle="Élastique" droite={<Pastille variante="bande" couleur={BAND_PALETTE[6].hex} grande>25 kg</Pastille>} />
          </Carte>
          <Note>À cocher : activités (3 au plus, « Sans activité » exclusive)</Note>
          <Carte sansMarge>
            {ACTIVITES.map((a) => (
              <LigneSaisie key={a.id} type="cocher" double libelle={a.date} sousLigne={a.chiffres}
                coche={!sansActivite && activites.includes(a.id)} onClick={() => toggleActivite(a.id)} />
            ))}
            <LigneSaisie type="cocher" double libelle="Sans activité" sousLigne="valider sans activité liée"
              coche={sansActivite} onClick={() => { setSansActivite(!sansActivite); setActivites([]) }} />
            {sansActivite && <LigneSaisie libelle="Jour de la séance" valeur="mar 27 oct" />}
          </Carte>
          <Note>À cocher : modules d'un compte</Note>
          <Carte sansMarge>
            {MODULES.map((m) => (
              <LigneSaisie key={m} type="cocher" libelle={m} coche={modules.includes(m)} onClick={() => toggle(modules, setModules, m)} />
            ))}
          </Carte>
        </Section>

        <Section titre="Barre de progression">
          <Carte sx={{ gap: space[12] }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Typography variant="etiquette" sx={{ color: 'muted' }}>Semaine</Typography>
              <Typography variant="chiffre">
                {String(kmAffiche).replace('.', ',')}
                <Typography component="span" variant="secondaire" sx={{ color: 'muted', fontWeight: 600 }}> / 33 km</Typography>
              </Typography>
            </Box>
            <BarreProgression valeur={km} max={33} label="Km de la semaine" />
            <BarreProgression valeur={km} max={33} widget label="Km de la semaine, version widget" />
            <BarreProgression valeur={km} max={33} lieeEtat label="Km de la semaine, liée à un état" />
            <Note>400 ms, puis 5 px en widget, puis 220 ms liée à un état</Note>
            <Bouton petit variante="chip" onClick={() => setIndexKm((indexKm + 1) % KM.length)}>Faire varier</Bouton>
          </Carte>
        </Section>

        <Section titre="Barre de structure">
          <Carte sx={{ gap: space[12] }}>
            <BarreStructure zone="qualite" segments={FRACTIONNE}
              label="15 minutes d'échauffement, 6 fractions de 1000 mètres avec 1 minute 30 de récupération, 10 minutes de retour au calme" />
            <BarreStructure zone="qualite" petit segments={FRACTIONNE} label="La même séance, version widget" />
            <BarreStructure zone="longue" segments={LONGUE} label="10 minutes d'échauffement, 17 kilomètres en endurance, 5 minutes de retour au calme" />
            <BarreStructure zone="facile" segments={[{ duree: 2700, type: 'effort' }]} label="45 minutes en endurance fondamentale" />
          </Carte>
        </Section>

        <Section titre="Marques de séance">
          <Carte sx={{ gap: space[12] }}>
            {ZONES.map((z) => (
              <Rangee key={z} sx={{ gap: space[16] }}>
                <Box sx={{ width: '56px' }}><Note>{z}</Note></Box>
                {ETATS.map((e) => <MarqueSeance key={e} etat={e} zone={z} label={`${e}, ${z}`} />)}
              </Rangee>
            ))}
            <Note>Ordre : faite, à faire, adaptée, sautée, aucune, course</Note>
            <Rangee sx={{ gap: space[12] }}>
              <MarqueSeance etat={faite ? 'faite' : 'aFaire'} zone="qualite" label={faite ? 'faite' : 'à faire'} />
              <MarqueSeance etat={faite ? 'sautee' : 'adaptee'} zone="longue" label={faite ? 'sautée' : 'adaptée'} />
              <Bouton petit variante="chip" onClick={() => setFaite(!faite)}>{faite ? 'Revenir' : 'Marquer faite'}</Bouton>
            </Rangee>
          </Carte>
        </Section>

        <DemoFeuille />
        <DemoAttente />
        <DemoMessage />
        <DemoAction />
        <DemoReseau />
      </Box>
    </Box>
  )
}

export default AtelierPage
