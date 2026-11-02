import { Box, ButtonBase, InputBase, Typography } from '@mui/material'
import { border, radius, size, space, textStyles } from '../styles/tokens'
import { DURATION, transition } from '../styles/motion'
import { appuiLigne, focusContourInterieur, sansMouvement } from './appui'
import { ChevronDroit, Coche } from './Icones'

// Valeur à droite : 16 px semi-gras tabulaire (la fiche dit 15 ; 16 évite le zoom
// d'iOS à l'entrée dans un champ, même règle que le thème).
const VALEUR = { ...textStyles.bouton, fontVariantNumeric: 'tabular-nums' }

const ligne = (hauteur) => ({
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  gap: space[12],
  width: '100%',
  minHeight: hauteur,
  py: space[8],
  px: space[16],
  boxSizing: 'border-box',
  textAlign: 'left',
  color: 'ink',
  // Filet line entre deux lignes, dans les marges de 16 px ; ::after reste au calque d'appui.
  '[data-ligne] + &::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: space[16],
    right: space[16],
    height: border.filet,
    backgroundColor: 'var(--line)',
  },
})

const champ = {
  flex: '0 1 50%',
  minWidth: 0,
  color: 'ink',
  '& input': {
    ...VALEUR,
    textAlign: 'right',
    p: 0,
    height: 'auto',
  },
  '& input::placeholder': { color: 'var(--muted)', opacity: 1, fontWeight: 400 },
}

const Libelle = ({ libelle, sousLigne, avant, fort, double }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minWidth: 0 }}>
    <Typography variant={fort || double ? 'corps-fort' : 'corps'} component="span">{libelle}</Typography>
    {sousLigne && (
      <Typography variant={double ? 'secondaire' : 'legende'} component="span" sx={{ color: 'muted' }}>{sousLigne}</Typography>
    )}
    {avant != null && (
      <Typography variant="legende" component="span" sx={{ color: 'muted' }}>{`avant ${avant}`}</Typography>
    )}
  </Box>
)

const Chevron = () => (
  <Box component="span" sx={{ display: 'flex', color: 'muted', flexShrink: 0 }}><ChevronDroit taille={16} /></Box>
)

const CaseRonde = ({ coche }) => (
  <Box
    component="span"
    sx={{
      width: '24px',
      height: '24px',
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      borderRadius: radius.pill,
      border: `${border.contour} solid`,
      borderColor: coche ? 'ink' : 'muted',
      bgcolor: coche ? 'ink' : 'transparent',
      color: 'on-ink',
      transition: transition(['background-color', 'border-color'], DURATION.fade),
      ...sansMouvement(),
    }}
  >
    {coche && <Coche taille={16} />}
  </Box>
)

/**
 * Ligne de réglage dans une Carte `sansMarge` : libellé à gauche, valeur à droite.
 * Les lignes sœurs sont séparées par un filet line.
 * - type 'texte' ou 'nombre' : valeur à taper (`valeur`, `onChange(texte)`,
 *   `placeholder`) ; toute la ligne est le label du champ.
 * - type 'choix' : la ligne entière est un bouton (`onClick`), valeur puis chevron.
 * - type 'action' : action de fin de liste, libellé muted et chevron.
 * - type 'cocher' : case ronde de 24 px (`coche`, `onClick`) ; `double` pour une
 *   activité (64 px, sous-ligne en secondaire, `aria-pressed`), sinon un module
 *   (52 px, `role="checkbox"`).
 * - type 'grande' : grande saisie d'un écran de l'assistant, `etiquette` au-dessus
 *   et champ en 26 px gras.
 * - avant : ancienne valeur d'une valeur changée, en legende sous le libellé.
 * - gauche, droite : emplacements libres (logo d'une source, pastille d'état ou de
 *   bande) ; `droite` remplace la valeur d'une ligne à choisir.
 */
const LigneSaisie = ({
  type = 'choix',
  libelle,
  sousLigne,
  avant,
  libelleFort = false,
  valeur,
  onChange,
  placeholder,
  inputProps,
  gauche,
  droite,
  coche = false,
  double = false,
  sx,
  ...rest
}) => {
  if (type === 'texte' || type === 'nombre') {
    return (
      <Box component="label" data-ligne="" sx={{ ...ligne(size.ligne), cursor: 'text', ...sx }} {...rest}>
        {gauche}
        <Libelle libelle={libelle} sousLigne={sousLigne} avant={avant} fort={libelleFort} />
        <InputBase
          value={valeur ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          inputProps={{ inputMode: type === 'nombre' ? 'decimal' : undefined, ...inputProps }}
          sx={champ}
        />
      </Box>
    )
  }

  if (type === 'grande') {
    return (
      <Box
        component="label"
        data-ligne=""
        sx={{ ...ligne(size.ligne), flexDirection: 'column', alignItems: 'stretch', gap: space[8], py: space[16], cursor: 'text', ...sx }}
        {...rest}
      >
        <Typography variant="etiquette" sx={{ color: 'muted' }}>{libelle}</Typography>
        <InputBase
          value={valeur ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          inputProps={inputProps}
          sx={{
            color: 'ink',
            '& input': { ...textStyles['chiffre-widget'], p: 0, height: 'auto' },
            '& input::placeholder': { color: 'var(--muted)', opacity: 1 },
          }}
        />
      </Box>
    )
  }

  const aCocher = type === 'cocher'
  const aria = aCocher
    ? (double ? { 'aria-pressed': coche } : { role: 'checkbox', 'aria-checked': coche })
    : {}

  return (
    <ButtonBase
      data-ligne=""
      {...aria}
      sx={{
        ...ligne(aCocher && double ? size.ligneDouble : size.ligne),
        justifyContent: 'flex-start',
        ...appuiLigne,
        ...focusContourInterieur,
        ...sx,
      }}
      {...rest}
    >
      {gauche}
      {type === 'action'
        ? <Typography variant="corps" component="span" sx={{ flex: '1 1 0', color: 'muted' }}>{libelle}</Typography>
        : <Libelle libelle={libelle} sousLigne={sousLigne} avant={avant} fort={libelleFort} double={aCocher && double} />}
      {type === 'choix' && (droite ?? (valeur != null && (
        <Typography component="span" sx={{ ...textStyles['corps-fort'], fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{valeur}</Typography>
      )))}
      {type === 'choix' && <Chevron />}
      {type === 'action' && <Chevron />}
      {aCocher && <CaseRonde coche={coche} />}
    </ButtonBase>
  )
}

export default LigneSaisie
