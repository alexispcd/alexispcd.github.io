import { useRef, useEffect, useCallback } from 'react'
import { Box, Typography } from '@mui/material'

// Sélecteur de durée « à roues » (heures / minutes / secondes) construit sur le
// scroll-snap natif : inertie iOS d'origine, snap au centre, aucune dépendance
// ajoutée. Chaque colonne est un conteneur scrollable ; la valeur sélectionnée
// est celle qui s'immobilise sur la bande centrale.

const ITEM_H = 38
const VISIBLE = 5
const PAD = ITEM_H * Math.floor(VISIBLE / 2) // marge haut/bas pour centrer les extrêmes

const range = (max) => Array.from({ length: max + 1 }, (_, i) => i)
const HOURS = range(9)
const SIXTY = range(59)

const Wheel = ({ items, value, onChange }) => {
  const ref = useRef(null)
  const settleTimer = useRef(null)
  const programmatic = useRef(false)

  const idx = Math.max(0, items.indexOf(value))

  // Aligne la position de scroll quand la valeur change hors interaction.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const target = idx * ITEM_H
    if (Math.abs(el.scrollTop - target) < 1) return
    programmatic.current = true
    el.scrollTop = target
    requestAnimationFrame(() => { programmatic.current = false })
  }, [idx])

  const handleScroll = useCallback(() => {
    if (programmatic.current) return
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM_H)))
      if (items[i] !== value) onChange(items[i])
    }, 110)
  }, [items, value, onChange])

  useEffect(() => () => clearTimeout(settleTimer.current), [])

  return (
    <Box
      ref={ref}
      onScroll={handleScroll}
      sx={{
        flex: 1, height: ITEM_H * VISIBLE, overflowY: 'scroll',
        scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        py: `${PAD}px`,
      }}
    >
      {items.map((n) => {
        const sel = n === value
        const dist = Math.abs(n - value)
        return (
          <Box key={n} sx={{ height: ITEM_H, scrollSnapAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{
              fontSize: sel ? '1.5rem' : '1.1rem',
              fontWeight: sel ? 700 : 500,
              fontVariantNumeric: 'tabular-nums',
              color: sel ? 'text.primary' : 'text.disabled',
              opacity: sel ? 1 : Math.max(0.22, 1 - dist * 0.3),
              transition: 'font-size .12s ease, color .12s ease',
            }}>
              {String(n).padStart(2, '0')}
            </Typography>
          </Box>
        )
      })}
    </Box>
  )
}

const Column = ({ items, value, onChange, unit }) => (
  <Box sx={{ position: 'relative', flex: 1 }}>
    <Wheel items={items} value={value} onChange={onChange} />
    <Typography sx={{
      position: 'absolute', right: 10, top: `${PAD}px`, height: ITEM_H,
      display: 'flex', alignItems: 'center', pointerEvents: 'none',
      fontSize: '0.7rem', fontWeight: 600, color: 'text.disabled',
    }}>
      {unit}
    </Typography>
  </Box>
)

const WheelTimePicker = ({ valueSec, onChange }) => {
  const v = Number.isFinite(valueSec) ? valueSec : 0
  const h = Math.floor(v / 3600)
  const m = Math.floor((v % 3600) / 60)
  const s = Math.floor(v % 60)
  const set = (nh, nm, ns) => onChange(nh * 3600 + nm * 60 + ns)

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderRadius: '16px', border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
      {/* Bande centrale de sélection */}
      <Box sx={{
        position: 'absolute', left: 8, right: 8, top: `${PAD}px`, height: ITEM_H,
        borderRadius: '10px', bgcolor: 'action.hover', pointerEvents: 'none',
      }} />
      {/* Voiles de fondu haut/bas */}
      <Box sx={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        background: (t) => `linear-gradient(180deg, ${t.palette.background.paper} 0%, transparent 34%, transparent 66%, ${t.palette.background.paper} 100%)`,
      }} />
      <Box sx={{ display: 'flex', position: 'relative' }}>
        <Column items={HOURS} value={h} onChange={(x) => set(x, m, s)} unit="h" />
        <Column items={SIXTY} value={m} onChange={(x) => set(h, x, s)} unit="min" />
        <Column items={SIXTY} value={s} onChange={(x) => set(h, m, x)} unit="s" />
      </Box>
    </Box>
  )
}

export default WheelTimePicker
