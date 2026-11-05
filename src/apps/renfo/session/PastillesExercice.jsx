import { Box } from '@mui/material'
import { space } from '../../../styles/tokens'
import Pastille from '../../../ui/Pastille'
import { bandColorFor, formatKg } from '../bandColor'
import { pastillesExercice } from './seance'

/**
 * Pastilles d'un exercice : hauteur de barre et chaise en matériel, puis la bande dans
 * sa vraie couleur (ou « Élastique » générique avec `bandeGenerique`). `children` suit
 * les pastilles sur la même rangée (« prévu 15 kg »). Rien sans pastille ni children.
 */
const PastillesExercice = ({ slug, kg = null, bands = [], bandeGenerique = false, children, sx }) => {
  const pastilles = pastillesExercice(slug, { kg, bandeGenerique })
  if (!pastilles.length && !children) return null
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: space[8], ...sx }}>
      {pastilles.map((p) => (p.variante === 'bande'
        ? <Pastille key={`bande-${p.kg}`} variante="bande" couleur={bandColorFor(bands, p.kg)}>{`${formatKg(p.kg)} kg`}</Pastille>
        : <Pastille key={p.libelle} variante="materiel">{p.libelle}</Pastille>))}
      {children}
    </Box>
  )
}

export default PastillesExercice
