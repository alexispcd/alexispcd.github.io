import { Suspense, lazy } from 'react'
import { Box, Typography } from '@mui/material'
import InstallBanner from '../../components/InstallBanner'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { useAppCtx } from '../../lib/context'
import { hasModule } from '../../lib/access'
import { space } from '../../styles/tokens'
import { homeModules } from '../registry'
import Page from '../../ui/Page'
import Carte from '../../ui/Carte'
import Bouton from '../../ui/Bouton'
import BoutonIcone from '../../ui/BoutonIcone'
import LigneModule from '../../ui/LigneModule'
import EnTeteAujourdhui from './EnTeteAujourdhui'
import { todayISO } from '../training/constants'

// Bloc chargé à part : ses calculs (Training et Renfo) restent hors du chunk d'entrée.
const BlocAujourdhui = lazy(() => import('./BlocAujourdhui'))

// Pendant le chargement du bloc : le titre et la place des widgets, sans saut.
const PlaceAujourdhui = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
    <EnTeteAujourdhui aujourdhui={todayISO()} />
    <Box sx={{ height: '170px' }} />
  </Box>
)

// Accueil sans barre du haut : l'en-tête et le bouton compte défilent avec la page,
// puis le bloc « Aujourd'hui » (lot A2) et la liste des modules, affichée tout de suite.
const Home = () => {
  const { access, user } = useAppCtx()
  const navigate = useAppNavigate()
  const liste = access ? homeModules(access) : []
  const admin = access?.role === 'admin'
  const initiale = user?.email?.[0]?.toUpperCase() ?? '?'
  const training = Boolean(access) && hasModule(access, 'training')
  const renfo = Boolean(access) && hasModule(access, 'renfo')

  return (
    <Page sansBarre gap={space[24]}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[12], pt: space[8] }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4], minWidth: 0 }}>
          <Typography variant="titre-app">Le Cairn</Typography>
          <Typography variant="secondaire" sx={{ color: 'muted' }}>Mes outils perso</Typography>
        </Box>
        <BoutonIcone compte label="Mon compte" onClick={() => navigate('/compte', { direction: 'forward' })}>
          {initiale}
        </BoutonIcone>
      </Box>

      <InstallBanner />

      {(training || renfo) && (
        <Suspense fallback={training ? <PlaceAujourdhui /> : null}>
          <BlocAujourdhui userId={user?.id} training={training} renfo={renfo} />
        </Suspense>
      )}

      {liste.length > 0 ? (
        <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
          <Typography variant="titre-barre" sx={{ mb: space[4] }}>Modules</Typography>
          {liste.map((m) => (
            <LigneModule
              key={m.id}
              nom={m.name}
              description={m.description}
              onClick={() => navigate(m.path, { direction: 'forward' })}
            />
          ))}
        </Box>
      ) : (
        <Carte sx={{ p: space[16], gap: space[8] }}>
          <Typography variant="titre-section">Aucun module pour l'instant</Typography>
          <Typography variant="secondaire" sx={{ color: 'muted' }}>
            {admin
              ? 'Tu peux t\'attribuer des modules depuis l\'Administration.'
              : 'Un administrateur doit t\'attribuer un module pour que tes outils apparaissent ici.'}
          </Typography>
          {admin && (
            <Bouton
              petit
              pleineLargeur
              sx={{ mt: space[8] }}
              onClick={() => navigate('/admin', { direction: 'forward', state: { retour: '/' } })}
            >
              Ouvrir l'Administration
            </Bouton>
          )}
        </Carte>
      )}
    </Page>
  )
}

export default Home
