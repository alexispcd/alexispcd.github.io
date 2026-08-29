import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync } from 'node:fs'
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

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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