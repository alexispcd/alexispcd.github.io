import { createBrowserRouter, RouterProvider, Outlet, useMatches, useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { useDarkMode } from './hooks/useDarkMode'
import createTheme from './styles/theme'
import Home from './apps/home/Home'
import { moduleRoutes } from './apps/registry'
import AuthGate from './components/AuthGate'
import AccessGate from './components/AccessGate'
import FullScreenLoader from './components/FullScreenLoader'
import RouteError from './components/RouteError'
import AppHeader, { HEADER_HEIGHT } from './components/AppHeader'
import supabase from './lib/supabase'
import { AppCtx, useAppCtx } from './lib/context'
import { fetchAccess, publishAccess, clearAccess } from './lib/access'

const AppLayout = () => {
  const { dark, setDark, user, access, headerActions, overlay } = useAppCtx()
  const matches = useMatches()
  const lastMatch = matches.at(-1)
  const handle = lastMatch?.handle ?? {}
  const navigate = useNavigate()

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
      {/* Pas de viewport-fit=cover (voir CLAUDE.md, section PWA iOS) : iOS remplit les
          safe-areas (barre de statut, indicateur d'accueil) avec le fond du body, et les
          env(safe-area-inset-*) valent 0. Ils ne servent que de garde-fou. Chaque page gere
          sa propre marge basse et scrolle dans son propre conteneur en height 100%. */}
      <Box sx={{
        height: '100%', overflow: 'hidden',
        pt: 'env(safe-area-inset-top, 0px)',
      }}>
        <Outlet />
      </Box>
      {/* Masqué pendant qu'un overlay plein écran (player renfo) occupe l'écran :
          le header flotte au-dessus de tout et son bouton retour se superpose aux
          contrôles de l'overlay. */}
      {!overlay && (
        <>
          {/* Fondu haut : couleur de fond opaque au tout en haut qui s'estompe de facon
              diffuse jusqu'a environ la mi-hauteur du header, pour que le contenu scrolle et
              disparaisse en douceur derriere les pastilles. Derriere le header (zIndex 1200)
              et devant le contenu. */}
          <Box sx={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
            height: `calc(env(safe-area-inset-top, 0px) + ${HEADER_HEIGHT / 2}px)`,
            pointerEvents: 'none',
            background: dark
              ? 'linear-gradient(to bottom, rgba(15,15,18,1) 0%, rgba(15,15,18,1) 12%, rgba(15,15,18,0) 100%)'
              : 'linear-gradient(to bottom, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 12%, rgba(255,255,255,0) 100%)',
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
          sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1200, pt: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
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
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
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
      <AppCtx.Provider value={{ dark, setDark, user, access, refreshAccess, headerActions, setHeaderActions, overlay, setOverlay }}>
        <AuthGate>
          <AccessGate>
            <RouterProvider router={router} />
          </AccessGate>
        </AuthGate>
      </AppCtx.Provider>
    </ThemeProvider>
  )
}

export default App
