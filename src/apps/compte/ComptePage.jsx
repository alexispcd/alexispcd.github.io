import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { useAppCtx } from '../../lib/context'
import supabase from '../../lib/supabase'
import { DUREES } from '../../lib/durees'
import { border, radius, size, space, textStyles } from '../../styles/tokens'
import { modules, canAccess } from '../registry'
import Page from '../../ui/Page'
import Carte from '../../ui/Carte'
import ControleSegmente from '../../ui/ControleSegmente'
import LigneSaisie from '../../ui/LigneSaisie'
import Bouton from '../../ui/Bouton'
import FeuilleFlottante from '../../ui/FeuilleFlottante'
import BarreAttente from '../../ui/BarreAttente'
import { useAction } from '../../ui/useAction'

const THEMES = [
  { valeur: 'auto', libelle: 'Automatique' },
  { valeur: 'light', libelle: 'Clair' },
  { valeur: 'dark', libelle: 'Sombre' },
]
const PRESSIONS = [
  { valeur: 'fond', libelle: 'Fond seul' },
  { valeur: 'agrandit', libelle: 'Agrandit' },
]
const RETOURS = [
  { valeur: 'sobre', libelle: 'Sobre' },
  { valeur: 'ressort', libelle: 'Ressort' },
]

// Filet line entre deux réglages de la carte Apparence, comme sur la planche.
const SEPARE = { borderTop: `${border.filet} solid`, borderColor: 'line', pt: space[12] }

// La carte d'attente annule l'écart de la colonne : son propre écart s'ouvre et se
// replie avec elle.
const ATTENTE_SX = { mb: `-${space[12]}`, '& .MuiCollapse-wrapperInner': { pb: space[12] } }

const Reglage = ({ libelle, legende, options, valeur, onChange, separe = false }) => (
  <>
    <Typography variant="corps" component="span" sx={separe ? SEPARE : undefined}>{libelle}</Typography>
    <ControleSegmente label={libelle} options={options} valeur={valeur} onChange={onChange} />
    {legende && <Typography variant="legende" sx={{ color: 'muted' }}>{legende}</Typography>}
  </>
)

const ComptePage = () => {
  const { apparence, user, access } = useAppCtx()
  const navigate = useAppNavigate()
  const [confirmation, setConfirmation] = useState(false)
  const deconnexion = useAction({
    attente: 'Déconnexion',
    duree: DUREES.actionCourte,
    echec: 'La déconnexion n\'a pas abouti. Réessaie.',
  })

  const email = user?.email ?? ''
  const initiale = email[0]?.toUpperCase() ?? '?'
  const admin = access?.role === 'admin'
  const training = modules.find((m) => m.id === 'training')
  const sources = Boolean(access && training && canAccess(training, access))

  const ouvrir = (chemin) => navigate(chemin, { direction: 'forward', state: { retour: '/compte' } })

  const lignes = [
    sources && { id: 'sources', libelle: 'Sources de données', chemin: '/compte/sources' },
    admin && { id: 'admin', libelle: 'Administration', chemin: '/admin' },
    // Atelier : page temporaire de la refonte, retirée avec cette ligne au lot F1.
    admin && { id: 'atelier', libelle: 'Atelier', chemin: '/atelier' },
  ].filter(Boolean)

  // Hors ligne, signOut échoue sans retirer la session : on reste connecté et le
  // Message le dit. Le cache de données est vidé par SIGNED_OUT (App.jsx), pas ici.
  const seDeconnecter = async () => {
    const { ok } = await deconnexion.lancer(async () => {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    })
    // La connexion suivante arrive sur l'Accueil, pas sur Compte.
    if (ok) navigate('/', { replace: true, viewTransition: false })
  }

  return (
    <Page>
      <BarreAttente place="carte" {...deconnexion.barre} sx={ATTENTE_SX} />

      <Carte sx={{ flexDirection: 'row', alignItems: 'center', gap: space[12] }}>
        <Box
          aria-hidden="true"
          sx={{
            ...textStyles['corps-fort'],
            fontWeight: 700,
            width: size.cible, height: size.cible, flexShrink: 0, borderRadius: radius.pill,
            bgcolor: 'chip', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {initiale}
        </Box>
        <Typography variant="corps-fort" noWrap sx={{ minWidth: 0 }}>{email}</Typography>
      </Carte>

      <Typography variant="etiquette" component="h2" sx={{ color: 'muted', px: space[4], mt: space[4] }}>
        Apparence
      </Typography>
      <Carte sx={{ gap: space[12] }}>
        <Reglage libelle="Thème" options={THEMES} valeur={apparence.theme} onChange={apparence.setTheme} />
        <Reglage
          separe
          libelle="Pression"
          options={PRESSIONS}
          valeur={apparence.pression}
          onChange={apparence.setPression}
          legende="Quand tu touches un bouton : le fond s'assombrit, ou il grandit aussi un peu."
        />
        <Reglage
          separe
          libelle="Retour en place"
          options={RETOURS}
          valeur={apparence.retour}
          onChange={apparence.setRetour}
          legende="Au relâchement : retour net, ou petit rebond. « Réduire les animations » de l'iPhone passe avant."
        />
      </Carte>

      {lignes.length > 0 && (
        <Carte sansMarge>
          {lignes.map((l) => (
            <LigneSaisie key={l.id} type="choix" libelle={l.libelle} onClick={() => ouvrir(l.chemin)} />
          ))}
        </Carte>
      )}

      <Bouton variante="chip" niveau="page" pleineLargeur onClick={() => setConfirmation(true)}>
        Se déconnecter
      </Bouton>
      <Typography variant="legende" sx={{ color: 'muted', textAlign: 'center' }}>
        {`Le Cairn ${__APP_VERSION__}`}
      </Typography>

      <FeuilleFlottante
        ouverte={confirmation}
        onFermer={() => setConfirmation(false)}
        titre="Pour revenir, il faudra ton e-mail et le code reçu. Les données gardées sur ce téléphone seront effacées."
        lignes={[{ libelle: 'Se déconnecter', onClick: seDeconnecter }]}
        fermerLibelle="Annuler"
      />
    </Page>
  )
}

export default ComptePage
