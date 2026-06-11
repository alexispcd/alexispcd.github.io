import { useState } from 'react'
import { Box, IconButton, Typography, Button, Divider, CircularProgress, Chip } from '@mui/material'
import { ArrowBack, Star, StarBorder, OpenInNew, AutoAwesome } from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'
import FicheView from './FicheView'
import supabase from '../../lib/supabase'

const formatDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const ArticleDetail = ({ article, onBack, onToggleFavorite, onUpdateNote, onSetSummary }) => {
  const theme = useTheme()
  const [summarizing, setSummarizing] = useState(false)
  const [summarizeError, setSummarizeError] = useState(null)

  const handleSummarize = async () => {
    setSummarizing(true)
    setSummarizeError(null)
    try {
      const { data, error } = await supabase.functions.invoke('summarize-article', {
        body: {
          articleId: article.id,
          url: article.url,
          title: article.title,
        },
      })
      if (error) throw error
      onSetSummary({
        summary: data.summary,
        key_points: data.keyPoints,
        tags: data.suggestedTags,
      })
    } catch (err) {
      console.error('Summarize error:', err)
      setSummarizeError('Erreur lors de la génération. Réessayer ?')
    } finally {
      setSummarizing(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100dvh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1,
        px: 2, pt: 3, pb: 2,
        position: 'sticky', top: 0, zIndex: 10,
        bgcolor: 'background.default',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}>
        <IconButton size="small" onClick={onBack}>
          <ArrowBack fontSize="small" />
        </IconButton>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {article.source}
        </Typography>
        <IconButton
          size="small"
          onClick={onToggleFavorite}
          sx={{ color: article.is_favorite ? 'warning.main' : 'text.disabled' }}
        >
          {article.is_favorite ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3, pb: 5 }}>
        {/* Title */}
        <Typography variant="h6" fontWeight={700} lineHeight={1.35} mb={1.5}>
          {article.title}
        </Typography>

        {/* Meta */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            {formatDate(article.published_at)}
          </Typography>
          {article.tags?.map(tag => (
            <Chip
              key={tag}
              label={tag}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                bgcolor: theme.palette.primary.light,
                color: theme.palette.primary.main,
                border: 'none',
              }}
            />
          ))}
        </Box>

        {/* Open link */}
        <Button
          variant="outlined"
          size="small"
          endIcon={<OpenInNew sx={{ fontSize: '14px !important' }} />}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          component="a"
          sx={{ textTransform: 'none', mb: 3, fontSize: '0.8rem' }}
        >
          Ouvrir l'article
        </Button>

        <Divider sx={{ mb: 3 }} />

        {/* Summary section */}
        {article.summary ? (
          <FicheView
            article={article}
            onUpdateNote={onUpdateNote}
          />
        ) : (
          <Box sx={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 2, py: 4, textAlign: 'center',
          }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: 3,
              bgcolor: theme.palette.primary.light,
              color: theme.palette.primary.main,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AutoAwesome />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600} mb={0.5}>
                Générer une fiche
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Résumé, points clés et thèmes suggérés par Claude
              </Typography>
            </Box>
            {summarizeError && (
              <Typography variant="caption" color="error.main">
                {summarizeError}
              </Typography>
            )}
            <Button
              variant="contained"
              size="small"
              onClick={handleSummarize}
              disabled={summarizing}
              startIcon={summarizing
                ? <CircularProgress size={14} sx={{ color: 'inherit' }} />
                : <AutoAwesome sx={{ fontSize: '16px !important' }} />
              }
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              {summarizing ? 'Analyse en cours…' : 'Résumer avec Claude'}
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default ArticleDetail
