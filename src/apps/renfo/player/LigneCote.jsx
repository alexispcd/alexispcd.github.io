import { Box, Typography } from '@mui/material'
import { libelleCote } from './labels'

/** Côté travaillé sous le chiffre : « Gauche » en 22 px gras, « · 1 / 2 » en muted. Rien sur les deux côtés. */
const LigneCote = ({ side }) => {
  const libelle = libelleCote(side)
  if (!libelle) return null
  return (
    <Typography component="span" sx={{ fontSize: '22px', lineHeight: '26px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
      {libelle.cote}
      <Box component="span" sx={{ color: 'muted', fontWeight: 600 }}>{` · ${libelle.rang}`}</Box>
    </Typography>
  )
}

export default LigneCote
