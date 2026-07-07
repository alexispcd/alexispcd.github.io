import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Chip, CircularProgress, Typography } from '@mui/material'
import Sync from '@mui/icons-material/Sync'
import GridView from '@mui/icons-material/GridView'
import ViewList from '@mui/icons-material/ViewList'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
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
const UNREAD_KEY = 'veille:unreadOnly'

const VeillePage = () => {
  const navigate = useNavigate()
  const { setHeaderActions, user } = useAppCtx()

  const [articles, setArticles] = useState([])
  // Restaure filtre + toggle non-lus AVANT le premier rendu pour éviter le flash
  const [filter, setFilter] = useState(() => sessionStorage.getItem(FILTER_KEY) || 'Tous')
  const [unreadOnly, setUnreadOnly] = useState(() => sessionStorage.getItem(UNREAD_KEY) === 'true')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [displayMode, setDisplayMode] = useState('list')

  const scrollRef = useRef(null)
  const sentinelRef = useRef(null)
  const scrollSaveTimer = useRef(null)
  const didRestoreScroll = useRef(false)
  const pendingRestore = useRef(null) // scrollTop cible à restaurer (px) ou null

  // Refs miroir pour les closures stables (observer, chargement page suivante)
  const filterRef = useRef(filter)
  const unreadRef = useRef(unreadOnly)
  const hasMoreRef = useRef(hasMore)
  const articlesRef = useRef(articles)
  const loadingMoreRef = useRef(false)

  useEffect(() => { filterRef.current = filter }, [filter])
  useEffect(() => { unreadRef.current = unreadOnly }, [unreadOnly])
  useEffect(() => { hasMoreRef.current = hasMore }, [hasMore])
  useEffect(() => { articlesRef.current = articles }, [articles])

  // Charge la page 1 (remplace le tableau) pour un couple (thème, non-lus) donné.
  const applyFirstPage = useCallback(async (theme, unread) => {
    setLoading(true)
    try {
      const { articles: rows, hasMore: more } = await loadArticles({ theme, unreadOnly: unread, offset: 0 })
      articlesRef.current = rows
      setArticles(rows)
      hasMoreRef.current = more
      setHasMore(more)
    } catch (err) {
      console.error('loadArticles error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Charge la page suivante (append). Guardé contre les appels concurrents et hasMore=false.
  const loadNextPage = useCallback(async () => {
    if (loadingMoreRef.current || !hasMoreRef.current) return
    loadingMoreRef.current = true
    setLoadingMore(true)
    try {
      const offset = articlesRef.current.length
      const { articles: rows, hasMore: more } = await loadArticles({
        theme: filterRef.current,
        unreadOnly: unreadRef.current,
        offset,
      })
      const next = [...articlesRef.current, ...rows]
      articlesRef.current = next
      setArticles(next)
      hasMoreRef.current = more
      setHasMore(more)
    } catch (err) {
      console.error('loadArticles (page suivante) error:', err)
    } finally {
      loadingMoreRef.current = false
      setLoadingMore(false)
    }
  }, [])

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      await fetchRssFeeds()
    } catch (err) {
      console.error('fetch-rss error:', err)
    }
    // Recharge page 1 avec les filtres actifs, remonte en haut
    didRestoreScroll.current = true
    pendingRestore.current = null
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    sessionStorage.setItem(SCROLL_KEY, '0')
    await applyFirstPage(filterRef.current, unreadRef.current)
    setSyncing(false)
  }, [applyFirstPage])

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

  const toggleUnread = useCallback(() => {
    const next = !unreadRef.current
    setUnreadOnly(next)
    unreadRef.current = next
    sessionStorage.setItem(UNREAD_KEY, String(next))
    // Action utilisateur : pas de restauration, on remonte en haut
    didRestoreScroll.current = true
    pendingRestore.current = null
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    sessionStorage.setItem(SCROLL_KEY, '0')
    applyFirstPage(filterRef.current, next)
  }, [applyFirstPage])

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

  // Montage : mémorise le scroll à restaurer puis charge la page 1
  useEffect(() => {
    const saved = parseInt(sessionStorage.getItem(SCROLL_KEY) || '0', 10) || 0
    pendingRestore.current = saved > 0 ? saved : null
    applyFirstPage(filter, unreadOnly)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Enregistre les actions du pill centre
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
        label: unreadOnly ? 'Tous les articles' : 'Non lus uniquement',
        icon: unreadOnly
          ? <Visibility fontSize="small" />
          : <VisibilityOff fontSize="small" />,
        onClick: toggleUnread,
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
  }, [syncing, loading, unreadOnly, displayMode, sync, toggleUnread, toggleDisplayMode, setHeaderActions])

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

  // Restauration du scroll : charge autant de pages que nécessaire pour couvrir
  // la position sauvegardée, puis applique le scrollTop (une seule fois).
  useLayoutEffect(() => {
    if (loading || didRestoreScroll.current) return
    const el = scrollRef.current
    if (!el) return
    const target = pendingRestore.current
    if (!target) {
      didRestoreScroll.current = true
      return
    }
    if (el.scrollHeight >= target + el.clientHeight || !hasMoreRef.current) {
      el.scrollTop = target
      didRestoreScroll.current = true
      return
    }
    // Pas encore assez de contenu chargé : charge la page suivante puis on réévalue
    loadNextPage()
  }, [loading, articles, hasMore, loadNextPage])

  // Scroll infini : charge la page suivante quand le sentinel approche du bas
  useEffect(() => {
    const el = sentinelRef.current
    const root = scrollRef.current
    if (!el || !root) return
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadNextPage() },
      { root, rootMargin: '400px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [loading, hasMore, loadNextPage])

  // Changement de filtre thème par l'utilisateur
  const handleFilterChange = (theme) => {
    setFilter(theme)
    filterRef.current = theme
    sessionStorage.setItem(FILTER_KEY, theme)
    didRestoreScroll.current = true
    pendingRestore.current = null
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    sessionStorage.setItem(SCROLL_KEY, '0')
    applyFirstPage(theme, unreadRef.current)
  }

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
    const article = articlesRef.current.find(a => a.id === id)
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
        ) : articles.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 6, textAlign: 'center' }}>
            {unreadOnly ? 'Aucun article non lu' : 'Aucun article pour ce thème'}
          </Typography>
        ) : (
          <>
            <Box sx={{
              display: 'grid',
              gridTemplateColumns: displayMode === 'mosaic' ? '1fr 1fr' : '1fr',
              gap: 1.5,
              pb: 2,
            }}>
              {articles.map(article => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => handleSelect(article)}
                  onToggleFavorite={(e) => handleToggleFavorite(article.id, e)}
                />
              ))}
            </Box>

            {/* Sentinel scroll infini + indicateur de chargement */}
            {hasMore && (
              <Box ref={sentinelRef} sx={{ display: 'flex', justifyContent: 'center', py: 2, minHeight: 32 }}>
                {loadingMore && <CircularProgress size={20} />}
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  )
}

export default VeillePage
