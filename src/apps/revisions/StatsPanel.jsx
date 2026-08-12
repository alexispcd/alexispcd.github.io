import { Box, Card, CardContent, Typography } from '@mui/material'
import { cardSx } from '../../styles/glass'
import { MAX_BOX, boxOf } from './leitner'

// Opacite croissante de la boite 1 a la boite 5 : une seule teinte, la
// progression se lit a la densite.
const BOX_OPACITY = [0.3, 0.48, 0.66, 0.84, 1]

// Repartition des cartes dans les 5 boites, par theme. Calcul client a partir
// des donnees deja chargees, aucune requete supplementaire. Une carte jamais
// vue compte en boite 1, conformement au moteur.
const StatsPanel = ({ cards, rows }) => {
  const byTheme = new Map()
  for (const card of cards) {
    if (!byTheme.has(card.themeId)) {
      byTheme.set(card.themeId, { theme: card.theme, total: 0, boxes: Array(MAX_BOX).fill(0) })
    }
    const entry = byTheme.get(card.themeId)
    entry.total += 1
    entry.boxes[boxOf(rows[card.id]) - 1] += 1
  }
  const themes = [...byTheme.values()]

  return (
    <Card sx={cardSx}>
      <CardContent>
        {themes.map((entry, index) => (
          <Box key={entry.theme} sx={{ mt: index === 0 ? 0 : 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
              <Typography variant="body2">{entry.theme}</Typography>
              <Typography variant="caption" color="text.secondary">
                {entry.total} carte{entry.total > 1 ? 's' : ''}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', height: 10, borderRadius: '5px', overflow: 'hidden', bgcolor: 'divider' }}>
              {entry.boxes.map((count, box) => (
                count > 0 && (
                  <Box
                    key={box}
                    sx={{
                      width: `${(count / entry.total) * 100}%`,
                      bgcolor: 'primary.main',
                      opacity: BOX_OPACITY[box],
                    }}
                  />
                )
              ))}
            </Box>
          </Box>
        ))}

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
          {BOX_OPACITY.map((opacity, box) => (
            <Box key={box} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: 'primary.main', opacity }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                {box === 0 ? 'Boîte 1' : box + 1}
              </Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}

export default StatsPanel
