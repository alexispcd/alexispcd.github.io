// Nom du cache runtime des lectures Supabase (voir workbox.runtimeCaching dans vite.config.js).
export const DATA_CACHE = 'cairn-data'

// Le cache est indexé par URL alors que la RLS filtre par jeton : il doit être vidé à
// la déconnexion et au changement de compte, sinon l'ancien compte resterait lisible hors ligne.
export const clearDataCache = () => {
  if (typeof caches === 'undefined') return Promise.resolve(false)
  return caches.delete(DATA_CACHE).catch((err) => {
    console.error('clearDataCache error:', err)
    return false
  })
}
