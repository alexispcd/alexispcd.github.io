import { createBrowserRouter, RouterProvider, Outlet, useLocation, useMatches } from 'react-router-dom'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { useApparence } from './hooks/useApparence'
import createTheme from './styles/theme'
import Home from './apps/home/Home'
import { moduleRoutes } from './apps/registry'
import AuthGate from './components/AuthGate'
import AccessGate from './components/AccessGate'
import FullScreenLoader from './components/FullScreenLoader'
import RouteError from './components/RouteError'
import AppHeader, { HEADER_HEIGHT } from './components/AppHeader'
import UpdatePrompt from './components/UpdatePrompt'
import MessageProvider from './ui/MessageProvider'
import supabase from './lib/supabase'
import { AppCtx, useAppCtx } from './lib/context'
import { fetchAccess, publishAccess, clearAccess } from './lib/access'
import { clearDataCache } from './lib/pwa'
import { useAppNavigate } from './hooks/useAppNavigate'
import { useRetourConnexion } from './hooks/useRetourConnexion'

const AppLayout = () => {
  const { headerActions, headerTitre, headerPastille, headerTitreBarre, overlay } = useAppCtx()
  const matches = useMatches()
  const lastMatch = matches.at(-1)
  const handle = lastMatch?.handle ?? {}
  const location = useLocation()
  const navigate = useAppNavigate()
  // Retour d'une connexion OAuth (?source=&connexion=), sur n'importe quelle page.
  useRetourConnexion()

  // backTo peut être une string ou une fonction (params) => string (route dynamique).
  const backTo = typeof handle.backTo === 'function'
    ? handle.backTo(lastMatch?.params ?? {})
    : handle.backTo

  // Retour d'où l'on vient quand la page a été ouverte avec state.retour (Compte vers
  // Administration, Accueil vers Administration), sinon backTo. Toujours animé vers
  // l'arrière : la profondeur du chemin ne dit pas le sens (/admin vers /compte).
  // state.retourEtat : état rendu à la page cible, pour qu'elle garde son propre
  // retour (séance ouverte depuis l'Historique, voir src/lib/retour.js).
  const cible = location.state?.retour ?? backTo
  const retourEtat = location.state?.retourEtat
  const handleBack = cible !== undefined
    ? () => navigate(cible, { direction: 'back', ...(retourEtat !== undefined ? { state: retourEtat } : {}) })
    : undefined
  // Accueil : ni barre ni fond, l'en-tête de la page défile avec elle.
  const barre = !overlay && !handle.sansBarre

  return (
    <Box sx={{ position: 'relative', height: '100dvh', overflow: 'hidden' }}>
      {/* viewport-fit=cover (config B, voir CLAUDE.md, section PWA iOS) : la page va
          jusqu'en bas de l'écran ; mesuré sur iPhone, inset haut 0 et bas 34 px. Chaque
          page gère sa propre marge basse et défile dans son propre conteneur en height
          100%, sans rebond (overscroll-behavior sur l'enfant direct, la page). */}
      <Box sx={{
        height: '100%', overflow: 'hidden',
        pt: 'env(safe-area-inset-top, 0px)',
        '& > *': { overscrollBehavior: 'none' },
      }}>
        <Outlet />
      </Box>
      {/* Masqué pendant qu'un overlay plein écran (player d'un module) occupe l'écran :
          le header flotte au-dessus de tout et son bouton retour se superpose aux
          contrôles de l'overlay. */}
      {barre && (
        <>
          {/* Fond du header : plein, en bg comme le body, sur toute la hauteur du header,
              pour que le contenu qui défile ne passe pas sous les pastilles (et qu'aucune
              teinte ne se pose sous la barre d'état). Derrière le header (zIndex 1200) et
              devant le contenu. */}
          <Box sx={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
            height: `calc(env(safe-area-inset-top, 0px) + ${HEADER_HEIGHT}px)`,
            pointerEvents: 'none',
            viewTransitionName: 'app-header-fade',
            bgcolor: 'background.default',
          }} />
          <AppHeader
            titre={headerTitreBarre ?? handle.title ?? null}
            pastille={headerPastille}
            actions={headerActions}
            titreActions={headerTitre}
            onBack={handleBack}
            // zIndex 1200 : sous les Dialog MUI (1300) pour que le backdrop recouvre le header.
            // pt : la barre porte l'inset haut et ne passe pas sous l'heure ; ses 48 px suivent.
            // viewTransitionName : capturé à part, il reste immobile pendant les transitions de page.
            sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200, pt: 'env(safe-area-inset-top, 0px)', viewTransitionName: 'app-header' }}
          />
        </>
      )}
    </Box>
  )
}

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    errorElement: <RouteError />,
    // Premier chargement d'une route (lien profond, retour OAuth Coros) : loader
    // plein ecran tant que l'acces et le chunk de la page ne sont pas arrives.
    hydrateFallbackElement: <FullScreenLoader />,
    children: [
      { path: '/', element: <Home />, handle: { sansBarre: true } },
      ...moduleRoutes(),
    ],
  },
])

const App = () => {
  const [user, setUser] = useState(null)
  const apparence = useApparence(user)
  const { dark } = apparence
  // Actions de la barre du haut et titre facultatif de leur feuille, posés par la page.
  // Options facultatives : `pastille` (texte d'une Pastille à contour avant les trois
  // points) et `titreBarre` (remplace handle.title). Tout est remis à zéro par
  // setHeaderActions([]) au nettoyage de l'effet de la page.
  const [header, setHeader] = useState({ actions: [], titre: null, pastille: null, titreBarre: null })
  // Stable : les pages la mettent dans les dépendances de leur effet.
  const setHeaderActions = useCallback((actions, titre, options = {}) => {
    setHeader({
      actions: actions ?? [],
      titre: titre ?? null,
      pastille: options.pastille ?? null,
      titreBarre: options.titreBarre ?? null,
    })
  }, [])
  // Vrai quand un overlay plein écran est monté : le header applicatif s'efface.
  const [overlay, setOverlay] = useState(false)
  const theme = useMemo(() => createTheme(dark), [dark])
  // Droits du compte connecté ({ userId, role, modules } ou { userId, error }).
  const [loadedAccess, setLoadedAccess] = useState(null)
  // Ignoré tant qu'il appartient à un autre compte : rechargé à chaque changement d'utilisateur.
  const access = loadedAccess?.userId === user?.id ? loadedAccess : null

  useEffect(() => {
    // Hors ligne, getUser() échoue sur l'appel réseau et renverrait user null alors que la
    // session locale est valide : cet échec réseau est ignoré, la session locale arrive
    // par onAuthStateChange (INITIAL_SESSION). Un refus du serveur garde son effet.
    supabase.auth.getUser().then(({ data, error }) => {
      if (isAuthRetryableFetchError(error)) return
      setUser(data.user ?? null)
    })
    // Dernier compte vu : le cache hors ligne (indexé par URL, pas par compte) est vidé
    // à la déconnexion et au passage d'un compte à un autre.
    let lastUserId = null
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null
      if (event === 'SIGNED_OUT' || (lastUserId && nextUserId && nextUserId !== lastUserId)) {
        clearDataCache()
      }
      if (nextUserId) lastUserId = nextUserId
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // Les loaders de route attendent le nouvel accès plutôt que de lire l'ancien.
    clearAccess()
    if (!user?.id) return
    let cancelled = false
    fetchAccess(user.id).then(
      (next) => {
        if (cancelled) return
        publishAccess(next)
        setLoadedAccess(next)
        // Le router survit au changement de compte : on rejoue les gardes de route.
        router.revalidate()
      },
      (err) => {
        console.error('fetchAccess error:', err)
        if (!cancelled) setLoadedAccess({ userId: user.id, error: true })
      },
    )
    return () => { cancelled = true }
  }, [user?.id])

  // Recharge l'accès du compte courant sans changement de compte (l'admin a modifié
  // ses propres modules) : même publication que ci-dessus, la home et les gardes de
  // route se mettent à jour sans recharger la page. Lève en cas d'échec.
  const refreshAccess = async () => {
    if (!user?.id) return
    const next = await fetchAccess(user.id)
    publishAccess(next)
    setLoadedAccess(next)
    router.revalidate()
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Messages en bas de l'écran (useMessage), au-dessus d'AuthGate pour servir aussi à l'écran de connexion. */}
      <MessageProvider>
        <AppCtx.Provider value={{
          apparence, user, access, refreshAccess,
          headerActions: header.actions, headerTitre: header.titre,
          headerPastille: header.pastille, headerTitreBarre: header.titreBarre, setHeaderActions,
          overlay, setOverlay,
        }}>
          <AuthGate>
            <AccessGate>
              <RouterProvider router={router} />
            </AccessGate>
          </AuthGate>
          <UpdatePrompt />
        </AppCtx.Provider>
      </MessageProvider>
    </ThemeProvider>
  )
}

export default App
