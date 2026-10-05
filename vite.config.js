import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, readdirSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
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

// Modules desactives (enabled: false dans src/apps/<id>/module.js). Leurs pages restent
// compilees a cause des import() du descripteur, mais ne doivent pas etre precachees
// par le service worker : elles ne sont jamais chargees.
const appsDir = resolve('src/apps')
const disabledDirs = readdirSync(appsDir)
  .map(id => resolve(appsDir, id))
  .filter(dir => existsSync(resolve(dir, 'module.js')) && /enabled:\s*false/.test(readFileSync(resolve(dir, 'module.js'), 'utf8')))
  .map(dir => dir + '/')

// Chunks propres aux modules desactives : au moins un fichier source d'un module desactive,
// aucun autre fichier de src (les dependances node_modules qu'ils sont seuls a utiliser
// suivent), et aucun chunk actif ne les importe statiquement.
const srcDir = resolve('src') + '/'
const disabledChunks = new Set()
const collectDisabledChunks = () => ({
  name: 'collect-disabled-chunks',
  generateBundle(_, bundle) {
    const chunks = Object.values(bundle).filter(c => c.type === 'chunk')
    const isDisabled = id => disabledDirs.some(dir => id.startsWith(dir))
    const candidates = new Set(chunks
      .filter(c => {
        const src = c.moduleIds.filter(id => id.startsWith(srcDir))
        return src.length > 0 && src.every(isDisabled)
      })
      .map(c => c.fileName))
    const importedByActive = new Set(chunks
      .filter(c => !candidates.has(c.fileName))
      .flatMap(c => c.imports))
    for (const name of candidates) {
      if (!importedByActive.has(name)) disabledChunks.add(name)
    }
  },
})

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    collectDisabledChunks(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        manifestTransforms: [
          entries => ({ manifest: entries.filter(e => !disabledChunks.has(e.url)), warnings: [] }),
        ],
      },
      manifest: {
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
    }),
    spaFallback(),
  ],
  base: '/',
})