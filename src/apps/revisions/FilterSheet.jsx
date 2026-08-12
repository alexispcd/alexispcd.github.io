import { useState } from 'react'
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Typography,
} from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../styles/glass'
import { cardAngles, cardTypes, themes } from './data'
import { EMPTY_FILTERS } from './leitner'

// Libelles connus, avec repli sur la valeur brute pour toute valeur nouvelle
// apparaissant dans un JSON depose plus tard.
const LABELS = {
  definition: 'Définition',
  evenement: 'Événement',
  chiffre: 'Chiffre',
  acteur: 'Acteur',
  controverse: 'Controverse',
  technique: 'Technique',
  economique: 'Économique',
  souverainete: 'Souveraineté',
  securite: 'Sécurité',
  organisationnel: 'Organisationnel',
}

const labelOf = (value) => LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)

const FilterGroup = ({ label, options, selected, onToggle, onClear }) => (
  <Box sx={{ mt: 2, '&:first-of-type': { mt: 0 } }}>
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

// Trois groupes de filtres cumulables, dont les valeurs sont deduites des
// donnees chargees. Le brouillon n'est applique qu'a la validation.
const FilterSheet = ({ open, filters, onApply, onClose, countFor }) => {
  const [draft, setDraft] = useState(filters)
  const [wasOpen, setWasOpen] = useState(open)

  // Resynchronise le brouillon a chaque ouverture, pendant le rendu.
  if (open && !wasOpen) {
    setWasOpen(true)
    setDraft(filters)
  } else if (!open && wasOpen) {
    setWasOpen(false)
  }

  const toggle = (group, value) => setDraft((prev) => ({
    ...prev,
    [group]: prev[group].includes(value)
      ? prev[group].filter((item) => item !== value)
      : [...prev[group], value],
  }))

  const clear = (group) => setDraft((prev) => ({ ...prev, [group]: [] }))

  const count = countFor(draft)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      slotProps={{ backdrop: GLASS_BACKDROP, paper: { sx: { ...glassSx, borderRadius: '28px', m: 2 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Filtrer la session</DialogTitle>
      <DialogContent>
        <FilterGroup
          label="Thème"
          options={themes.map((theme) => ({ value: theme.themeId, label: theme.theme }))}
          selected={draft.themes}
          onToggle={(value) => toggle('themes', value)}
          onClear={() => clear('themes')}
        />
        <FilterGroup
          label="Type"
          options={cardTypes.map((type) => ({ value: type, label: labelOf(type) }))}
          selected={draft.types}
          onToggle={(value) => toggle('types', value)}
          onClear={() => clear('types')}
        />
        <FilterGroup
          label="Angle"
          options={cardAngles.map((angle) => ({ value: angle, label: labelOf(angle) }))}
          selected={draft.angles}
          onToggle={(value) => toggle('angles', value)}
          onClear={() => clear('angles')}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => setDraft(EMPTY_FILTERS)} color="inherit">Tout effacer</Button>
        <Button onClick={() => onApply(draft)} variant="contained">
          Voir {count} carte{count > 1 ? 's' : ''}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default FilterSheet
