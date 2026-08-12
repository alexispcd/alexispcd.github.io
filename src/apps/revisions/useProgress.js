import { useCallback, useEffect, useRef, useState } from 'react'
import supabase from '../../lib/supabase'

const EMPTY = {}

// Lecture de la progression de l'utilisateur courant. Volume maximal 400 lignes :
// pas de pagination, pas de filtre serveur, tout tient en memoire.
const fetchProgress = async () => {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth?.user) throw new Error('Session expirée.')

  const { data, error } = await supabase.from('revision_progress').select('*')
  if (error) throw error

  return {
    userId: auth.user.id,
    rows: Object.fromEntries((data ?? []).map((row) => [row.card_id, row])),
  }
}

// Etat de progression et ecriture optimiste des reponses.
const useProgress = () => {
  // rows suit les reponses de la session ; snapshot fige l'etat au chargement,
  // pour qu'une file composee a partir de lui ne se recompose pas a chaque reponse.
  const [rows, setRows] = useState(EMPTY)
  const [snapshot, setSnapshot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const userId = useRef(null)

  const run = useCallback(() => {
    let cancelled = false
    fetchProgress()
      .then(({ userId: id, rows: map }) => {
        if (cancelled) return
        userId.current = id
        setRows(map)
        setSnapshot(map)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err.message || 'Chargement impossible.')
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => run(), [run])

  const reload = useCallback(() => {
    setLoading(true)
    setError(null)
    run()
  }, [run])

  // Ecrit une reponse. L'etat local est mis a jour immediatement pour que la
  // carte suivante s'affiche sans temps mort ; la promesse retournee permet a
  // l'appelant d'arreter la session si le reseau lache.
  const save = useCallback((card, next) => {
    const row = {
      user_id: userId.current,
      card_id: card.id,
      theme_id: card.themeId,
      box: next.box,
      due_on: next.due_on,
      last_reviewed_at: new Date().toISOString(),
    }
    setRows((prev) => ({ ...prev, [card.id]: row }))

    return supabase
      .from('revision_progress')
      .upsert(row, { onConflict: 'user_id,card_id' })
      .then(({ error: upsertError }) => {
        if (upsertError) throw upsertError
      })
  }, [])

  return { rows, snapshot, loading, error, reload, save }
}

export default useProgress
