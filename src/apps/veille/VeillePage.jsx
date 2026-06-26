import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, IconButton, Typography, Chip, CircularProgress } from '@mui/material'
import { Sync } from '@mui/icons-material'
import ArticleCard from './ArticleCard'
import { fetchRssFeeds, loadArticles } from '../../lib/rss'
import supabase from '../../lib/supabase'
import { HEADER_HEIGHT } from '../../components/AppHeader'

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

const VeillePage = () => {
  const navigate = useNavigate()
  const [articles, setArticles] = useState([])
  const [filter, setFilter] = useState('Tous')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

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

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

  const unreadCount = articles.filter(a => !a.is_read).length

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', pt: `${HEADER_HEIGHT}px` }}>

      {/* Barre d'action (refresh + compteur) */}
      <Box sx={{
        display: 'flex', alignItems: 'center',
        px: 2, py: 0.75,
        borderBottom: '1px solid', borderColor: 'divider',
        flexShrink: 0,
      }}>
        <Box sx={{ flex: 1 }}>
          {!loading && unreadCount > 0 && (
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
            </Typography>
          )}
          {syncing && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={11} thickness={5} />
              <Typography variant="caption" color="text.secondary">
                Synchronisation en cours...
              </Typography>
            </Box>
          )}
        </Box>
        <IconButton size="small" onClick={sync} disabled={syncing || loading} sx={{ p: 0.75 }}>
          <Sync
            fontSize="small"
            sx={{
              transition: 'none',
              animation: syncing ? 'veilleSync 1s linear infinite' : 'none',
              '@keyframes veilleSync': {
                '0%': { transform: 'rotate(0deg)' },
                '100%': { transform: 'rotate(360deg)' },
              },
            }}
          />
        </IconButton>
      </Box>

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
            onClick={() => setFilter(theme)}
            sx={{ flexShrink: 0, fontSize: '0.7rem' }}
          />
        ))}
      </Box>

      {/* Liste articles */}
      <Box sx={{
        flex: 1, overflowY: 'auto',
        px: 2, pb: 4,
        display: 'flex', flexDirection: 'column', gap: 1.5,
      }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}>
            <CircularProgress size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 6, textAlign: 'center' }}>
            Aucun article pour ce thème
          </Typography>
        ) : (
          filtered.map(article => (
            <ArticleCard
              key={article.id}
              article={article}
              onClick={() => handleSelect(article)}
              onToggleFavorite={(e) => handleToggleFavorite(article.id, e)}
            />
          ))
        )}
      </Box>
    </Box>
  )
}

export default VeillePage
