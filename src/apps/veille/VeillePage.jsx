import { useState, useCallback, useEffect } from 'react'
import { Box, IconButton, Typography, Chip, CircularProgress } from '@mui/material'
import { ArrowBack, Sync } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import ArticleCard from './ArticleCard'
import ArticleDetail from './ArticleDetail'
import { fetchRssFeeds, loadArticles } from '../../lib/rss'
import supabase from '../../lib/supabase'

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
  const [selectedId, setSelectedId] = useState(null)
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

  const handleSelect = async (article) => {
    setArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_read: true } : a))
    setSelectedId(article.id)
    if (!article.is_read) {
      await supabase
        .from('watch_items')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', article.id)
    }
  }

  const handleToggleFavorite = async (id, e) => {
    e?.stopPropagation()
    const article = articles.find(a => a.id === id)
    if (!article) return
    const newVal = !article.is_favorite
    setArticles(prev => prev.map(a => a.id === id ? { ...a, is_favorite: newVal } : a))
    await supabase.from('watch_items').update({ is_favorite: newVal }).eq('id', id)
  }

  const handleUpdateNote = async (id, note) => {
    setArticles(prev => prev.map(a => a.id === id ? { ...a, note } : a))
    await supabase.from('watch_items').update({ note }).eq('id', id)
  }

  const handleSetSummary = useCallback((id, { summary, key_points, tags }) => {
    setArticles(prev => prev.map(a =>
      a.id === id
        ? { ...a, summary, key_points, tags: [...new Set([...(a.tags ?? []), ...tags])] }
        : a
    ))
  }, [])

  const selectedArticle = articles.find(a => a.id === selectedId)

  if (selectedArticle) {
    return (
      <ArticleDetail
        article={selectedArticle}
        onBack={() => setSelectedId(null)}
        onToggleFavorite={(e) => handleToggleFavorite(selectedArticle.id, e)}
        onUpdateNote={(note) => handleUpdateNote(selectedArticle.id, note)}
        onSetSummary={(data) => handleSetSummary(selectedArticle.id, data)}
      />
    )
  }

  const unreadCount = articles.filter(a => !a.is_read).length

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, pt: 3, pb: 2,
        position: 'sticky', top: 0, zIndex: 10,
        bgcolor: 'background.default',
        borderBottom: '1px solid', borderColor: 'divider',
      }}>
        <IconButton size="small" onClick={() => navigate('/')}>
          <ArrowBack fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant="h6" fontWeight={600}>Veille</Typography>
          {!loading && unreadCount > 0 && (
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              {unreadCount} non lu{unreadCount > 1 ? 's' : ''}
            </Typography>
          )}
        </Box>
        <IconButton size="small" onClick={sync} disabled={syncing || loading}>
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

      {/* Sync banner */}
      {syncing && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 0.75,
          bgcolor: 'action.hover',
          borderBottom: '1px solid', borderColor: 'divider',
        }}>
          <CircularProgress size={12} thickness={5} />
          <Typography variant="caption" color="text.secondary">
            Synchronisation en cours...
          </Typography>
        </Box>
      )}

      {/* Theme chips */}
      <Box sx={{
        display: 'flex', gap: 1, overflowX: 'auto',
        px: 2, py: 1.5,
        flexShrink: 0,
        '&::-webkit-scrollbar': { display: 'none' },
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
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

      {/* Article list */}
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
