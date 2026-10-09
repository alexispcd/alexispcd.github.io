import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync } from 'node:fs'
import process from 'node:process'
import pkg from './package.json'

// GitHub Pages sert un 404 sur toute URL profonde rechargee directement. Copier
// index.html vers 404.html rend le routage client operationnel (retour OAuth Coros
// sur /training/settings, notamment).
const spaFallback = () => ({
  name: 'spa-404-fallback',
  closeBundle() {
    copyFileSync('dist/index.html', 'dist/404.html')
  },
})

// Tables lues hors ligne : Training et Renfo en lecture seule, plus les droits du
// compte (fetchAccess). Aucune Edge Function, aucun appel d'auth, aucune autre table.
const OFFLINE_TABLES = [
  'training_plans', 'training_weeks', 'training_sessions',
  'strength_profiles', 'strength_bands', 'strength_cycles', 'strength_sessions',
  'profiles', 'user_modules',
]

// Photos des exercices Renfo (public/renfo) : hors précache, mises en cache à la
// première consultation pour rester visibles dans le player hors ligne.
const renfoImagesRule = {
  urlPattern: /\/renfo\/[^/]+\.webp$/,
  method: 'GET',
  handler: 'CacheFirst',
  options: {
    cacheName: 'cairn-renfo-images',
    expiration: { maxEntries: 200, maxAgeSeconds: 90 * 24 * 60 * 60 },
    cacheableResponse: { statuses: [200] },
  },
}

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')

// urlPattern est sérialisé dans sw.js : une fonction ne pourrait pas lire de variable
// externe. La RegExp est donc construite ici, en littéral, au moment du build.
const dataCacheRule = (supabaseUrl) => {
  if (!supabaseUrl) {
    console.warn('[pwa] VITE_SUPABASE_URL absente : pas de cache de données hors ligne')
    return []
  }
  const origin = new URL(supabaseUrl).origin
  return [{
    urlPattern: new RegExp(`^${escapeRegExp(origin)}/rest/v1/(?:${OFFLINE_TABLES.join('|')})(?:\\?|$)`),
    method: 'GET',
    handler: 'NetworkFirst',
    options: {
      cacheName: 'cairn-data',
      networkTimeoutSeconds: 4,
      expiration: { maxEntries: 200, maxAgeSeconds: 14 * 24 * 60 * 60 },
      cacheableResponse: { statuses: [200] },
    },
  }]
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      react(),
      VitePWA({
        // L'utilisateur choisit quand recharger (UpdatePrompt).
        registerType: 'prompt',
        manifest: {
          id: '/',
          lang: 'fr',
          name: 'Le Cairn',
          short_name: 'Cairn',
          description: 'Mes outils perso',
          theme_color: '#1D9E75',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          runtimeCaching: [...dataCacheRule(env.VITE_SUPABASE_URL), renfoImagesRule],
        },
      }),
      spaFallback(),
    ],
    base: '/',
  }
})
