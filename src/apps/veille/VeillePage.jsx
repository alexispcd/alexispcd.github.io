import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Chip, CircularProgress, Typography } from '@mui/material'
import Sync from '@mui/icons-material/Sync'
import GridView from '@mui/icons-material/GridView'
import ViewList from '@mui/icons-material/ViewList'
import ArticleCard from './ArticleCard'
import { fetchRssFeeds, loadArticles } from '../../lib/rss'
import supabase from '../../lib/supabase'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { useAppCtx } from '../../lib/context'

const THEMES = [
  'Tous',
  'SI et environnement',
  'Cybersécurité',
  'Cloud et virtualisation',
  'Big Data',
  'Développement',
  'Mobilité',
  'Management et stratégie',
  'Blockchain',
  'Intelligence artificielle',
  'Optimisation du SI',
]

const PREF_KEY = 'veille_display_mode'
const SCROLL_KEY = 'veille:scrollTop'
const FILTER_KEY = 'veille:filter'

const VeillePage = () => {
  const navigate = useNavigate()
  const { setHeaderActions, user } = useAppCtx()

  const [articles, setArticles] = useState([])
  // Restaure le filtre AVANT le premier rendu pour éviter le flash "Tous"
  const [filter, setFilter] = useState(() => sessionStorage.getItem(FILTER_KEY) || 'Tous')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [displayMode, setDisplayMode] = useState('list')

  const scrollRef = useRef(null)
  const scrollSaveTimer = useRef(null)
  const didRestoreScroll = useRef(false)

  const reload = useCallback(async () => {
    const data = await loadArticles()
    setArticles(data)
  }, [])

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      await fetchRssFeeds()
    } catch (err) {
      console.error('fetch-rss error:', err)
    }
    try {
      await reload()
    } catch (err) {
      console.error('loadArticles error:', err)
    }
    setSyncing(false)
  }, [reload])

  const toggleDisplayMode = useCallback(async () => {
    const next = displayMode === 'list' ? 'mosaic' : 'list'
    setDisplayMode(next)
    if (user?.id) {
      try {
        await supabase.from('user_preferences').upsert({
          user_id: user.id,
          key: PREF_KEY,
          value: next,
        })
      } catch (err) {
        console.error('user_preferences upsert error:', err)
      }
    }
  }, [displayMode, user?.id])

  // Fetch saved display mode on mount
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('user_preferences')
      .select('value')
      .eq('user_id', user.id)
      .eq('key', PREF_KEY)
      .single()
      .then(({ data }) => {
        if (data?.value === 'list' || data?.value === 'mosaic') {
          setDisplayMode(data.value)
        }
      })
  }, [user?.id])

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Enregistre les actions du pill centre — re-runs quand syncing, loading ou displayMode change
  useEffect(() => {
    setHeaderActions([
      {
        label: 'Synchroniser',
        icon: syncing
          ? <CircularProgress size={16} color="inherit" />
          : <Sync fontSize="small" />,
        onClick: sync,
        disabled: syncing || loading,
      },
      {
        label: displayMode === 'mosaic' ? 'Vue liste' : 'Vue mosaïque',
        icon: displayMode === 'mosaic'
          ? <ViewList fontSize="small" />
          : <GridView fontSize="small" />,
        onClick: toggleDisplayMode,
      },
    ])
    return () => setHeaderActions([])
  }, [syncing, loading, displayMode, sync, toggleDisplayMode, setHeaderActions])

  // Sauvegarde throttlée du scroll pour le restaurer au retour depuis un article
  const handleScroll = useCallback(() => {
    if (scrollSaveTimer.current) return
    scrollSaveTimer.current = setTimeout(() => {
      scrollSaveTimer.current = null
      if (scrollRef.current) {
        sessionStorage.setItem(SCROLL_KEY, String(scrollRef.current.scrollTop))
      }
    }, 150)
  }, [])

  // Une fois les articles chargés et rendus, restaure le scroll sauvegardé (une seule fois)
  useEffect(() => {
    if (loading || didRestoreScroll.current || !scrollRef.current) return
    const saved = sessionStorage.getItem(SCROLL_KEY)
    if (saved) scrollRef.current.scrollTop = parseInt(saved, 10) || 0
    didRestoreScroll.current = true
  }, [loading])

  // Changement de filtre par l'utilisateur : persiste + remonte en haut immédiatement.
  // La restauration au montage passe par l'état initial de useState, donc ne déclenche pas ce reset.
  const handleFilterChange = (theme) => {
    setFilter(theme)
    sessionStorage.setItem(FILTER_KEY, theme)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    sessionStorage.setItem(SCROLL_KEY, '0')
  }

  const filtered = filter === 'Tous'
    ? articles
    : articles.filter(a => a.tags?.includes(filter))

  const handleSelect = (article) => {
    if (!article.is_read) {
      supabase
        .from('watch_items')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', article.id)
    }
    navigate(`/veille/article/${article.id}`, { state: { article: { ...article, is_read: true } } })
  }

  const handleToggleFavorite = async (id, e) => {
    e?.stopPropagation()
    const article = articles.find(a => a.id === id)
    if (!article) return
    const newVal = !article.is_favorite
    setArticles(prev => prev.map(a => a.id === id ? { ...a, is_favorite: newVal } : a))
    await supabase.from('watch_items').update({ is_favorite: newVal }).eq('id', id)
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', pt: `${HEADER_HEIGHT}px` }}>

      {/* Filtres thème */}
      <Box sx={{
        display: 'flex', gap: 1, overflowX: 'auto',
        px: 2, py: 1.5, flexShrink: 0,
        '&::-webkit-scrollbar': { display: 'none' },
        msOverflowStyle: 'none', scrollbarWidth: 'none',
      }}>
        {THEMES.map(theme => (
          <Chip
            key={theme}
            label={theme}
            size="small"
            variant={filter === theme ? 'filled' : 'outlined'}
            color={filter === theme ? 'primary' : 'default'}
            onClick={() => handleFilterChange(theme)}
            sx={{ flexShrink: 0, fontSize: '0.7rem' }}
          />
        ))}
      </Box>

      {/* Liste / mosaïque articles */}
      <Box
        ref={scrollRef}
        onScroll={handleScroll}
        sx={{ flex: 1, overflowY: 'auto', px: 2, pb: 4, display: 'flex', flexDirection: 'column' }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 6, textAlign: 'center' }}>
            Aucun article pour ce thème
          </Typography>
        ) : (
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: displayMode === 'mosaic' ? '1fr 1fr' : '1fr',
            gap: 1.5,
            pb: 4,
          }}>
            {filtered.map(article => (
              <ArticleCard
                key={article.id}
                article={article}
                onClick={() => handleSelect(article)}
                onToggleFavorite={(e) => handleToggleFavorite(article.id, e)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default VeillePage
