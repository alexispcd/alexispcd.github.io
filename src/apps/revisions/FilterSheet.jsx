import { Box, Chip, Typography } from '@mui/material'
import { cardAngles, cardTypes, themes } from './data'
import { labelOf } from './labels'

const FilterGroup = ({ label, options, selected, onToggle, onClear }) => (
  <Box sx={{ mb: 2.5, '&:last-of-type': { mb: 0 } }}>
    <Typography
      variant="overline"
      sx={{ display: 'block', color: 'text.secondary', letterSpacing: '0.15em', fontSize: '0.6rem', mb: 1 }}
    >
      {label}
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      <Chip
        label="Tous"
        size="small"
        onClick={onClear}
        variant={selected.length === 0 ? 'filled' : 'outlined'}
        color={selected.length === 0 ? 'primary' : 'default'}
      />
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          size="small"
          onClick={() => onToggle(option.value)}
          variant={selected.includes(option.value) ? 'filled' : 'outlined'}
          color={selected.includes(option.value) ? 'primary' : 'default'}
        />
      ))}
    </Box>
  </Box>
)

// Contenu du panneau de filtres, rendu dans la carte flottante de SessionBar.
// Trois groupes cumulables, dont les valeurs sont deduites des donnees chargees.
// Les changements s'appliquent immediatement : le compteur de la page suit.
const FilterSheet = ({ filters, onChange }) => {
  const toggle = (group, value) => onChange({
    ...filters,
    [group]: filters[group].includes(value)
      ? filters[group].filter((item) => item !== value)
      : [...filters[group], value],
  })

  const clear = (group) => onChange({ ...filters, [group]: [] })

  return (
    <Box>
      <FilterGroup
        label="Thème"
        options={themes.map((theme) => ({ value: theme.themeId, label: theme.theme }))}
        selected={filters.themes}
        onToggle={(value) => toggle('themes', value)}
        onClear={() => clear('themes')}
      />
      <FilterGroup
        label="Type"
        options={cardTypes.map((type) => ({ value: type, label: labelOf(type) }))}
        selected={filters.types}
        onToggle={(value) => toggle('types', value)}
        onClear={() => clear('types')}
      />
      <FilterGroup
        label="Angle"
        options={cardAngles.map((angle) => ({ value: angle, label: labelOf(angle) }))}
        selected={filters.angles}
        onToggle={(value) => toggle('angles', value)}
        onClear={() => clear('angles')}
      />
    </Box>
  )
}

export default FilterSheet
