import { Card, CardContent, Box, Typography, Chip, IconButton } from '@mui/material'
import Star from '@mui/icons-material/Star'
import StarBorder from '@mui/icons-material/StarBorder'
import { useTheme } from '@mui/material/styles'

const formatDate = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const ArticleCard = ({ article, onClick, onToggleFavorite }) => {
  const theme = useTheme()

  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        flexShrink: 0,
        opacity: article.is_read ? 0.6 : 1,
        border: `1px solid ${theme.palette.divider}`,
        transition: 'all 0.15s',
        '&:hover': { borderColor: theme.palette.primary.main },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Unread dot + title */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
              {!article.is_read && (
                <Box sx={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0, mt: '5px',
                  bgcolor: 'primary.main',
                }} />
              )}
              <Typography
                variant="body2"
                fontWeight={article.is_read ? 400 : 600}
                lineHeight={1.4}
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {article.title}
              </Typography>
            </Box>

            {/* Source + date */}
            <Typography variant="caption" color="text.secondary">
              {article.source} · {formatDate(article.published_at)}
            </Typography>

            {/* Theme chips */}
            {article.tags.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                {article.tags.map(tag => (
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
            )}
          </Box>

          {/* Favorite */}
          <IconButton
            size="small"
            onClick={onToggleFavorite}
            sx={{ mt: -0.5, mr: -0.5, flexShrink: 0, color: article.is_favorite ? 'warning.main' : 'text.disabled' }}
          >
            {article.is_favorite
              ? <Star sx={{ fontSize: 18 }} />
              : <StarBorder sx={{ fontSize: 18 }} />
            }
          </IconButton>
        </Box>
      </CardContent>
    </Card>
  )
}

export default ArticleCard
