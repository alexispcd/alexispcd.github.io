import { Box, Card, Divider, Typography } from '@mui/material'
import Add from '@mui/icons-material/Add'
import { cardSx } from '../../styles/glass'

// Carte de revision. Recto seul, puis verso apres appui n'importe ou sur la carte.
// Le verso peut atteindre 700 caracteres : interligne genereux et scroll interne,
// pour que les boutons de reponse ne bougent jamais.
const FlashCard = ({ card, revealed, onReveal }) => (
  <Card
    onClick={revealed ? undefined : onReveal}
    sx={{
      ...cardSx,
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: revealed ? 'flex-start' : 'center',
      p: 2.5,
      overflow: 'hidden',
      cursor: revealed ? 'default' : 'pointer',
    }}
  >
    <Typography
      sx={{
        fontSize: revealed ? '1.05rem' : '1.45rem',
        fontWeight: 500,
        lineHeight: 1.45,
        flex: 'none',
      }}
    >
      {card.recto}
    </Typography>

    {!revealed && (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mt: 2.5, color: 'text.secondary' }}>
        <Add sx={{ fontSize: 15 }} />
        <Typography variant="caption">Touchez la carte pour voir la réponse</Typography>
      </Box>
    )}

    {revealed && (
      <>
        <Divider sx={{ my: 2.25 }} />
        {/* Contenu statique du repo, jamais de saisie utilisateur : HTML limite
            a <br>, <b> et <i>, rendu directement. */}
        <Box
          sx={{
            overflowY: 'auto',
            fontSize: '0.93rem',
            lineHeight: 1.75,
            '& b': { fontWeight: 600 },
            '& i': { color: 'text.secondary', fontStyle: 'italic' },
          }}
          dangerouslySetInnerHTML={{ __html: card.verso }}
        />
      </>
    )}
  </Card>
)

export default FlashCard
