import { useState, useEffect, useRef, useCallback } from 'react'
import supabase from '../lib/supabase'

const PREF_KEY = 'dark_mode'

export function useDarkMode(user) {
  // Cache localStorage lu au premier rendu : évite le flash du mauvais thème
  const [dark, setDarkState] = useState(() => localStorage.getItem('cairn-theme') === 'dark')

  // Ref pour lire la valeur courante sans recréer setDark à chaque changement
  const darkRef = useRef(dark)
  darkRef.current = dark

  // Applique le thème au body + met à jour le cache localStorage à chaque changement
  // (toggle utilisateur comme reconciliation Supabase)
  useEffect(() => {
    document.body.classList.toggle('dark', dark)
    localStorage.setItem('cairn-theme', dark ? 'dark' : 'light')
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
  const setDark = useCallback((value) => {
    const next = typeof value === 'function' ? value(darkRef.current) : value
    setDarkState(next)
    if (user?.id) {
      supabase
        .from('user_preferences')
        .upsert({ user_id: user.id, key: PREF_KEY, value: next ? 'dark' : 'light' })
        .then(({ error }) => {
          if (error) console.error('user_preferences upsert error:', error)
        })
    }
  }, [user?.id])

  return [dark, setDark]
}
