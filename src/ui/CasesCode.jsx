import { Box } from '@mui/material'
import { border, radius, size, space, textStyles } from '../styles/tokens'

const LONGUEUR = 8

/**
 * Code de connexion à 8 chiffres : un seul vrai champ, invisible, posé sur 8 cases
 * dessinées. Le code proposé par le clavier ou un collage remplit tout d'un coup.
 * - valeur : les chiffres saisis (déjà filtrés par le consommateur).
 * - onChange(texte) : reçoit la chaîne brute du champ, espaces compris.
 * - lectureSeule : readOnly, jamais disabled, pour garder le focus et le clavier
 *   quand un code est refusé.
 * Pas de maxLength : le navigateur couperait un collage « 1234 5678 » avant le filtrage.
 */
const CasesCode = ({ valeur = '', onChange, lectureSeule = false }) => {
  const chiffres = String(valeur)
  const courante = chiffres.length < LONGUEUR ? chiffres.length : -1

  return (
    <Box sx={{ position: 'relative', display: 'flex', gap: space[4] }}>
      {Array.from({ length: LONGUEUR }, (_, i) => (
        <Box
          key={i}
          aria-hidden
          sx={{
            ...textStyles['titre-section'],
            fontVariantNumeric: 'tabular-nums',
            flex: '1 1 0',
            height: size.ligne,
            ml: i === 4 ? space[8] : 0,
            bgcolor: 'chip',
            color: 'ink',
            borderRadius: radius.inner,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            ...(i === courante
              ? { outline: `${border.contour} solid var(--ink)`, outlineOffset: `-${border.contour}` }
              : {}),
          }}
        >
          {chiffres[i] ?? ''}
        </Box>
      ))}
      <Box
        component="input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        aria-label="Code à 8 chiffres"
        autoFocus
        readOnly={lectureSeule}
        value={chiffres}
        onChange={(e) => onChange?.(e.target.value)}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          m: 0,
          p: 0,
          border: 0,
          opacity: 0,
          fontSize: '16px',
          color: 'transparent',
          caretColor: 'transparent',
          bgcolor: 'transparent',
        }}
      />
    </Box>
  )
}

export default CasesCode
