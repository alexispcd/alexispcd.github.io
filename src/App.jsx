import { createBrowserRouter, RouterProvider, Outlet, useMatches } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'
import { useDarkMode } from './hooks/useDarkMode'
import createTheme from './styles/theme'
import Home from './apps/home/Home'
import { moduleRoutes } from './apps/registry'
import AuthGate from './components/AuthGate'
import AccessGate from './components/AccessGate'
import FullScreenLoader from './components/FullScreenLoader'
import RouteError from './components/RouteError'
import AppHeader, { HEADER_HEIGHT } from './components/AppHeader'
import UpdatePrompt from './components/UpdatePrompt'
import OfflineIndicator from './components/OfflineIndicator'
import MessageProvider from './ui/MessageProvider'
import supabase from './lib/supabase'
import { AppCtx, useAppCtx } from './lib/context'
import { fetchAccess, publishAccess, clearAccess } from './lib/access'
import { clearDataCache } from './lib/pwa'
import { useAppNavigate } from './hooks/useAppNavigate'

const AppLayout = () => {
  const { dark, setDark, user, access, headerActions, overlay } = useAppCtx()
  const matches = useMatches()
  const lastMatch = matches.at(-1)
  const handle = lastMatch?.handle ?? {}
  const navigate = useAppNavigate()

  // backTo peut être une string ou une fonction (params) => string (route dynamique).
  const backTo = typeof handle.backTo === 'function'
    ? handle.backTo(lastMatch?.params ?? {})
    : handle.backTo

  const showBack = handle.showBack !== false && backTo !== undefined
  const handleBack = backTo !== undefined
    ? () => navigate(backTo)
    : () => navigate(-1)

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
      {!overlay && (
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
          toolName={handle.title ?? null}
          actions={headerActions}
          showBack={showBack}
          onBack={handleBack}
          dark={dark}
          setDark={setDark}
          user={user}
          isAdmin={access?.role === 'admin'}
          // zIndex 1200 : sous les Dialog MUI (1300) pour que le backdrop recouvre le header.
          // pt : le header porte l'inset haut et ne passe plus sous l'heure (py:1.5 = 12px conservés).
          // viewTransitionName : capturé à part, il reste immobile pendant les transitions de page.
          sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200, pt: 'calc(env(safe-area-inset-top, 0px) + 12px)', viewTransitionName: 'app-header' }}
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
      { path: '/', element: <Home />, handle: { showBack: false } },
      ...moduleRoutes(),
    ],
  },
])

const App = () => {
  const [user, setUser] = useState(null)
  const [dark, setDark] = useDarkMode(user)
  const [headerActions, setHeaderActions] = useState([])
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
        <AppCtx.Provider value={{ dark, setDark, user, access, refreshAccess, headerActions, setHeaderActions, overlay, setOverlay }}>
          <AuthGate>
            <AccessGate>
              <RouterProvider router={router} />
            </AccessGate>
          </AuthGate>
          <OfflineIndicator />
          <UpdatePrompt />
        </AppCtx.Provider>
      </MessageProvider>
    </ThemeProvider>
  )
}

export default App
