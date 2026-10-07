import { useState, useEffect, useRef, useCallback } from 'react'
import supabase from '../lib/supabase'

const PREF_KEY = 'dark_mode'

export function useDarkMode(user) {
  // Cache localStorage lu au premier rendu : évite le flash du mauvais thème
  const [dark, setDarkState] = useState(() => localStorage.getItem('cairn-theme') === 'dark')

  // Ref pour lire la valeur courante sans recréer setDark à chaque changement.
  // Mise à jour dans l'effet ci-dessous, jamais pendant le rendu.
  const darkRef = useRef(dark)

  // Applique le thème au body + met à jour le cache localStorage à chaque changement
  // (toggle utilisateur comme reconciliation Supabase)
  useEffect(() => {
    darkRef.current = dark
    document.body.classList.toggle('dark', dark)
    localStorage.setItem('cairn-theme', dark ? 'dark' : 'light')
    // theme-color dynamique pour Chrome et Android (iOS est couvert par black-translucent).
    // Les deux metas media reçoivent la meme valeur : le thème applicatif prime sur le systeme.
    const color = dark ? '#0f0f12' : '#1D9E75'
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color))
  }, [dark])

  // Reconciliation : une fois l'utilisateur connu, Supabase prend le dessus
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('user_preferences')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', PREF_KEY)
      .single()
      .then(({ data }) => {
        if (data?.value === 'dark' || data?.value === 'light') {
          const remote = data.value === 'dark'
          if (remote !== darkRef.current) setDarkState(remote)
        }
      })
  }, [user?.id])

  // Toggle : met à jour l'état (donc localStorage via l'effet) + upsert Supabase si connecté
  const userId = user?.id
  const setDark = useCallback((value) => {
    const next = typeof value === 'function' ? value(darkRef.current) : value
    setDarkState(next)
    if (userId) {
      supabase
        .from('user_preferences')
        .upsert({ user_id: userId, key: PREF_KEY, value: next ? 'dark' : 'light' })
        .then(({ error }) => {
          if (error) console.error('user_preferences upsert error:', error)
        })
    }
  }, [userId])

  return [dark, setDark]
}
