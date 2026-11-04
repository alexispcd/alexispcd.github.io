import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import supabase from '../lib/supabase'
import { colors } from '../styles/tokens'
import { CLES_PREFERENCES, REGLAGES, lireReglage, reglagesDepuisPreferences, resoudreSombre } from '../lib/apparence'

// ─── Stockage local ─────────────────────────────────────────────────────────
// Lu au premier rendu pour éviter le flash du mauvais thème. Indisponible (navigation
// privée, stockage bloqué) : valeurs par défaut, rien n'est écrit.

const lireStockage = (nom) => {
  try {
    return lireReglage(nom, localStorage.getItem(REGLAGES[nom].stockage))
  } catch {
    return REGLAGES[nom].defaut
  }
}

const ecrireStockage = (nom, valeur) => {
  try {
    localStorage.setItem(REGLAGES[nom].stockage, valeur)
  } catch {
    // Stockage indisponible : le réglage vaut pour cette ouverture seulement.
  }
}

const lireTout = () => ({
  theme: lireStockage('theme'),
  pression: lireStockage('pression'),
  retour: lireStockage('retour'),
})

// ─── Thème du système ───────────────────────────────────────────────────────

const SOMBRE = '(prefers-color-scheme: dark)'

const abonnerSysteme = (rappel) => {
  const m = window.matchMedia(SOMBRE)
  m.addEventListener('change', rappel)
  return () => m.removeEventListener('change', rappel)
}

const systemeSombre = () => window.matchMedia(SOMBRE).matches

const memes = (a, b) => a.theme === b.theme && a.pression === b.pression && a.retour === b.retour

/**
 * Apparence de l'app, réglée sur la page Compte et appliquée tout de suite.
 * - theme : 'auto' (suit l'iPhone), 'light' ou 'dark' ; dark : thème affiché.
 * - pression : 'fond' ou 'agrandit' ; retour : 'sobre' ou 'ressort'.
 * Stockage local d'abord, puis user_preferences à la connexion : la base l'emporte.
 * Chaque changement est écrit dans les deux, l'échec en base part en console.
 */
export const useApparence = (user) => {
  const [reglages, setReglages] = useState(lireTout)
  const sombreSysteme = useSyncExternalStore(abonnerSysteme, systemeSombre, () => false)
  const dark = resoudreSombre(reglages.theme, sombreSysteme)
  const { theme, pression, retour } = reglages

  // Avant le premier affichage : body.dark (lu par src/lib/barreEtat.js) et theme-color
  // sur le fond bg du thème affiché. Les deux metas media reçoivent la même valeur :
  // le thème de l'app prime sur celui du système.
  useLayoutEffect(() => {
    document.body.classList.toggle('dark', dark)
    const couleur = colors[dark ? 'dark' : 'light'].bg
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', couleur))
  }, [dark])

  // Réglage Animations : lu par le thème (src/styles/theme.js) sur <html>.
  useLayoutEffect(() => {
    document.documentElement.dataset.pression = pression
  }, [pression])

  useLayoutEffect(() => {
    document.documentElement.dataset.retour = retour
  }, [retour])

  useEffect(() => { ecrireStockage('theme', theme) }, [theme])
  useEffect(() => { ecrireStockage('pression', pression) }, [pression])
  useEffect(() => { ecrireStockage('retour', retour) }, [retour])

  // Réconciliation : une fois le compte connu, la base prend le dessus.
  const userId = user?.id
  useEffect(() => {
    if (!userId) return undefined
    let annule = false
    supabase
      .from('user_preferences')
      .select('key, value')
      .eq('user_id', userId)
      .in('key', CLES_PREFERENCES)
      .then(({ data, error }) => {
        if (error) {
          console.error('[useApparence] lecture de user_preferences :', error)
          return
        }
        if (annule) return
        const distant = reglagesDepuisPreferences(data)
        setReglages((r) => {
          const suivant = { ...r, ...distant }
          return memes(r, suivant) ? r : suivant
        })
      })
    return () => { annule = true }
  }, [userId])

  const changer = useCallback((nom, valeur) => {
    const suivant = lireReglage(nom, valeur)
    setReglages((r) => (r[nom] === suivant ? r : { ...r, [nom]: suivant }))
    if (!userId) return
    supabase
      .from('user_preferences')
      .upsert({ user_id: userId, key: REGLAGES[nom].cle, value: suivant })
      .then(({ error }) => {
        if (error) console.error('[useApparence] écriture de user_preferences :', error)
      })
  }, [userId])

  const setTheme = useCallback((v) => changer('theme', v), [changer])
  const setPression = useCallback((v) => changer('pression', v), [changer])
  const setRetour = useCallback((v) => changer('retour', v), [changer])

  return { theme, setTheme, dark, pression, setPression, retour, setRetour }
}
