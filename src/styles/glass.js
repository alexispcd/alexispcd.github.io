// Style glassmorphism unifié — une seule variante appliquée partout.
// La lisibilité texte est assurée par le blur fort (28px) plutôt que par l'opacité.

export const glassSx = {
  backdropFilter: 'blur(28px) saturate(180%)',
  WebkitBackdropFilter: 'blur(28px) saturate(180%)',
  background: (t) => t.palette.mode === 'dark'
    ? 'linear-gradient(180deg, rgba(52,52,68,0.28) 0%, rgba(18,18,28,0.36) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(228,234,252,0.24) 100%)',
  boxShadow: (t) => t.palette.mode === 'dark'
    ? 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.12), 0 4px 24px rgba(0,0,0,0.38), 0 1px 6px rgba(0,0,0,0.20)'
    : 'inset 0 1px 0 rgba(255,255,255,0.80), inset 0 -1px 0 rgba(0,0,0,0.03), 0 4px 24px rgba(0,0,0,0.09), 0 1px 6px rgba(0,0,0,0.05)',
  border: (t) => t.palette.mode === 'dark'
    ? '1px solid rgba(255,255,255,0.07)'
    : '1px solid rgba(0,0,0,0.06)',
}

export const GLASS_BACKDROP = { sx: { bgcolor: 'rgba(0,0,0,0.25)' } }
