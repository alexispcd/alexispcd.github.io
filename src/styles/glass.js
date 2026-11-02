// Ancien style verre, aplati pour le Design System : mêmes exports pour les fichiers
// qui les importent encore, mais fond `surface`, sans flou, ombre ni dégradé.
// Retiré quand les écrans seront refaits avec src/ui.
import { veil } from './tokens'

const flat = {
  background: (t) => t.palette.background.paper,
  boxShadow: 'none',
  border: 'none',
}

export const glassSx = flat

export const cardSx = flat

// Voile du Design System derrière les dialogues.
export const GLASS_BACKDROP = { sx: { bgcolor: (t) => veil(t.palette.mode) } }
