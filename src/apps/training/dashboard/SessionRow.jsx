import { useRef } from 'react'
import { motion, useMotionValue, useTransform } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import Check from '@mui/icons-material/Check'
import Redo from '@mui/icons-material/Redo'
import { ZONE_STYLE, TYPE_LABEL, formatKm, shortDayLabel, cleanText } from '../constants'

// Déclenchement franc : il faut dépasser ce déplacement horizontal du doigt pour
// qu'un swipe compte. En deçà, la carte revient à l'origine (dragSnapToOrigin).
const SWIPE_THRESHOLD = 80

/** Sous-titre « volume » dérivé de l'agrégat des steps ou du renfo. */
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

/** Pastille de jour : uniquement une fois la séance faite (jour réel) ou sautée. */
const DayPill = ({ session }) => {
  if (session.status === 'done') {
    const day = shortDayLabel(session.completed_at ?? session.scheduled_date)
    return (
      <Box sx={{ ...pillBase, color: ZONE_STYLE.A.main, bgcolor: ZONE_STYLE.A.bg }}>
        <Check sx={{ fontSize: 13 }} />{day}
      </Box>
    )
  }
  if (session.status === 'skipped') {
    return (
      <Box sx={{ ...pillBase, color: 'text.disabled', bgcolor: 'action.hover' }}>
        <Redo sx={{ fontSize: 13 }} />Sautée
      </Box>
    )
  }
  return null
}

const pillBase = {
  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 0.4,
  fontSize: '0.66rem', fontWeight: 700, px: 1, py: 0.4, borderRadius: '999px',
  fontVariantNumeric: 'tabular-nums',
}

const SessionRow = ({ session, onSkip, onOpen, canSkip }) => {
  const x = useMotionValue(0)
  // Révélations d'arrière-plan pilotées par le déplacement réel.
  const skipOpacity = useTransform(x, [8, 60], [0, 1])
  const openOpacity = useTransform(x, [-60, -8], [1, 0])
  const draggingRef = useRef(false)

  const isDone = session.status === 'done'
  const isSkipped = session.status === 'skipped'

  const handleDragEnd = (_e, info) => {
    const dx = info.offset.x
    if (dx > SWIPE_THRESHOLD && canSkip) onSkip(session)
    else if (dx < -SWIPE_THRESHOLD) onOpen(session)
    // Un tick avant de rouvrir le tap, pour ne pas enchaîner drag → tap.
    requestAnimationFrame(() => { draggingRef.current = false })
  }

  return (
    <Box sx={{ position: 'relative', borderRadius: '20px', overflow: 'hidden' }}>
      {/* Fond révélé au swipe */}
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5 }}>
        {canSkip && (
          <Typography component={motion.p} style={{ opacity: skipOpacity }} sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'text.secondary' }}>
            Sauter
          </Typography>
        )}
        <Typography component={motion.p} style={{ opacity: openOpacity }} sx={{ fontSize: '0.78rem', fontWeight: 700, color: 'primary.main', ml: 'auto' }}>
          Ouvrir
        </Typography>
      </Box>

      {/* Carte — drag horizontal avec verrouillage d'axe */}
      <Box
        component={motion.div}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        dragSnapToOrigin
        style={{ x }}
        onDragStart={() => { draggingRef.current = true }}
        onDragEnd={handleDragEnd}
        onTap={() => { if (!draggingRef.current) onOpen(session) }}
        sx={{
          position: 'relative',
          bgcolor: 'background.paper',
          border: '1px solid', borderColor: 'divider', borderRadius: '20px',
          px: 1.9, py: 1.6, cursor: 'pointer', userSelect: 'none',
          touchAction: 'pan-y',
          opacity: isDone ? 0.64 : isSkipped ? 0.55 : 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <Typography
            variant="body2"
            fontWeight={650}
            noWrap
            sx={{ minWidth: 0, fontSize: '0.92rem', textDecoration: isDone ? 'line-through' : 'none', textDecorationColor: 'text.disabled' }}
          >
            {cleanText(session.title)}
          </Typography>
          <DayPill session={session} />
        </Box>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
          {subtitle(session)}
        </Typography>
      </Box>
    </Box>
  )
}

export default SessionRow
