import { Box, Card, Divider, Typography } from '@mui/material'
import Add from '@mui/icons-material/Add'
import { cardSx } from '../../styles/glass'
import { labelOf } from './labels'

// Pastille de qualification. L'angle est le seul accentue : c'est l'axe de
// lecture le plus utile a l'oral, le theme et le type se devinent du contenu.
const Tag = ({ label, accent }) => (
  <Box
    sx={{
      borderRadius: '8px',
      px: 1.125,
      py: 0.625,
      fontSize: '0.62rem',
      fontWeight: 500,
      letterSpacing: '0.09em',
      textTransform: 'uppercase',
      lineHeight: 1.2,
      bgcolor: accent ? 'primary.light' : 'divider',
      color: accent ? 'primary.main' : 'text.secondary',
    }}
  >
    {label}
  </Box>
)

// Carte de revision. Recto seul, puis verso apres appui n'importe ou sur la carte.
// Theme, type et angle restent affiches en tete dans les deux etats, pour savoir
// a quel domaine rattacher la carte avant meme d'avoir repondu.
// Le verso peut depasser 900 caracteres : interligne genereux et scroll interne,
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
      p: 2.5,
      overflow: 'hidden',
      cursor: revealed ? 'default' : 'pointer',
    }}
  >
    <Box sx={{ flex: 'none', display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
      <Tag label={card.theme} />
      <Tag label={labelOf(card.type)} />
      <Tag label={labelOf(card.angle)} accent />
    </Box>

    {revealed ? (
      <>
        <Typography sx={{ flex: 'none', fontSize: '1.05rem', fontWeight: 500, lineHeight: 1.45 }}>
          {card.recto}
        </Typography>
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
    ) : (
      /* Recto seul : centre verticalement, le theme restant ancre en haut. */
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Typography sx={{ fontSize: '1.45rem', fontWeight: 500, lineHeight: 1.45 }}>
          {card.recto}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, mt: 2.5, color: 'text.secondary' }}>
          <Add sx={{ fontSize: 15 }} />
          <Typography variant="caption">Touchez la carte pour voir la réponse</Typography>
        </Box>
      </Box>
    )}
  </Card>
)

export default FlashCard
