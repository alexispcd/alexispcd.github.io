import { useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import Check from '@mui/icons-material/Check'
import Redo from '@mui/icons-material/Redo'
import AutoAwesome from '@mui/icons-material/AutoAwesome'
import { ZONE_STYLE, TYPE_LABEL, formatKm } from '../constants'

const THRESHOLD = 80
const MAX = 110

const DOW = ['DIM', 'LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM']

const dayParts = (dateStr) => {
  const d = new Date(dateStr)
  return { dow: DOW[d.getDay()], num: d.getDate() }
}

/** Sous-titre "volume" dérivé de l'agrégat des steps ou du renfo. */
const subtitle = (s) => {
  if (s.type === 'renfo') {
    const sc = s.strength_content
    const min = sc?.target_duration_min
    const blocks = Array.isArray(sc?.blocks) ? sc.blocks.length : null
    return [min ? `${min} min` : null, blocks ? `${blocks} bloc${blocks > 1 ? 's' : ''}` : null]
      .filter(Boolean).join(' · ') || TYPE_LABEL[s.type]
  }
  const km = formatKm(s.agg_distance_m)
  const min = s.agg_duration_sec ? Math.round(s.agg_duration_sec / 60) : null
  return [km ? `${km} km` : null, min ? `~${min} min` : null].filter(Boolean).join(' · ')
    || TYPE_LABEL[s.type]
}

const StatusMark = ({ status }) => {
  if (status === 'done') return <Check sx={{ fontSize: 17, color: ZONE_STYLE.A.main }} />
  if (status === 'skipped') return <Redo sx={{ fontSize: 16, color: 'text.disabled' }} />
  if (status === 'adapted') return <AutoAwesome sx={{ fontSize: 15, color: '#a78bfa' }} />
  return null
}

const SessionRow = ({ session, onSkip, onOpen, canSkip }) => {
  const [dx, setDx] = useState(0)
  const [settling, setSettling] = useState(false)
  const start = useRef(0)
  const dragging = useRef(false)
  const moved = useRef(0)

  const z = ZONE_STYLE[session.zone] ?? ZONE_STYLE.A
  const { dow, num } = dayParts(session.scheduled_date)
  const isDone = session.status === 'done'

  const onDown = (e) => {
    start.current = e.clientX
    moved.current = 0
    dragging.current = true
    setSettling(false)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e) => {
    if (!dragging.current) return
    let d = e.clientX - start.current
    moved.current = Math.abs(d)
    if (d > 0 && !canSkip) d = 0 // pas de saut si lecture seule
    setDx(Math.max(-MAX, Math.min(MAX, d)))
  }
  const onUp = () => {
    if (!dragging.current) return
    dragging.current = false
    const d = dx
    setSettling(true)
    setDx(0)
    if (d > THRESHOLD && canSkip) onSkip(session)
    else if (d < -THRESHOLD) onOpen(session)
    else if (moved.current < 10) onOpen(session)
  }

  return (
    <Box sx={{ position: 'relative', borderRadius: 4, overflow: 'hidden' }}>
      {/* Fond révélé au swipe */}
      <Box sx={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
        px: 2.5, borderRadius: 4,
      }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', opacity: dx > 8 ? 1 : 0 }}>
          Sauter
        </Typography>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: 'primary.main', opacity: dx < -8 ? 1 : 0, ml: 'auto' }}>
          Ouvrir
        </Typography>
      </Box>

      {/* Ligne */}
      <Box
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        sx={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 1.5,
          p: 1.5, borderRadius: 4,
          bgcolor: 'background.paper',
          border: '1px solid', borderColor: 'divider',
          touchAction: 'pan-y', cursor: 'pointer', userSelect: 'none',
          transform: `translateX(${dx}px)`,
          transition: settling ? 'transform .25s ease' : 'none',
          opacity: isDone ? 0.62 : 1,
        }}
      >
        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: z.main, flexShrink: 0 }} />

        <Box sx={{ width: 38, textAlign: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em', color: 'text.disabled' }}>
            {dow}
          </Typography>
          <Typography sx={{ fontSize: '1.05rem', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
            {num}
          </Typography>
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="body2"
            fontWeight={600}
            noWrap
            sx={{ textDecoration: isDone ? 'line-through' : 'none' }}
          >
            {session.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
            {subtitle(session)}
          </Typography>
        </Box>

        <Box sx={{ width: 20, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <StatusMark status={session.status} />
        </Box>
      </Box>
    </Box>
  )
}

export default SessionRow
