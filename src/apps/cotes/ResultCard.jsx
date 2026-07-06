import { useState } from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import { motion, AnimatePresence } from 'framer-motion'
import { slopeColor } from './utils'

const ResultCard = ({ results, activeIdx, setActiveIdx }) => {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  const r = results[activeIdx]
  const total = results.length
  const [direction, setDirection] = useState(0)

  const glass = {
    background: dark
      ? 'linear-gradient(180deg, rgba(52,52,68,0.28) 0%, rgba(18,18,28,0.36) 100%)'
      : 'linear-gradient(180deg, rgba(255,255,255,0.32) 0%, rgba(228,234,252,0.24) 100%)',
    backdropFilter: 'blur(28px) saturate(180%)',
    WebkitBackdropFilter: 'blur(28px) saturate(180%)',
    border: dark ? '1px solid rgba(255,255,255,0.07)' : '1px solid rgba(0,0,0,0.06)',
    boxShadow: dark
      ? '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)'
      : '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.80)',
  }

  const prev = () => {
    if (activeIdx === 0) return
    setDirection(-1)
    setActiveIdx(i => i - 1)
  }

  const next = () => {
    if (activeIdx === total - 1) return
    setDirection(1)
    setActiveIdx(i => i + 1)
  }

  const variants = {
    enter: (dir) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  }

  return (
    <Box sx={{
      position: 'absolute',
      left: 8, right: 8,
      bottom: 'calc(116px + env(safe-area-inset-bottom, 0px))',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      gap: 0.5,
    }}>
      <IconButton
        onClick={prev}
        disabled={activeIdx === 0}
        size="small"
        sx={{ color: 'text.secondary', opacity: activeIdx === 0 ? 0.2 : 1 }}
      >
        <ChevronLeft />
      </IconButton>

      <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <AnimatePresence mode="popLayout" custom={direction}>
          <motion.div
            key={activeIdx}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -60) next()
              else if (info.offset.x > 60) prev()
            }}
            style={{ cursor: 'grab', width: '100%' }}
            whileTap={{ cursor: 'grabbing' }}
          >

            <Box sx={{
              ...glass,
              borderRadius: 3, // 24px, rond comme les boutons
              overflow: 'hidden',
              px: 1.5, py: 1.25,
            }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1, mr: 1 }}>
                  {r.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontSize: '0.65rem' }}>
                  {activeIdx + 1} / {total}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" fontWeight={600} sx={{ color: slopeColor(parseFloat(r.slope)), flexShrink: 0 }}>
                  ▲ {r.slope}%
                </Typography>
                <Box sx={{ width: '1px', height: 12, bgcolor: 'divider' }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <ArrowUpward sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">{r.gain}m</Typography>
                </Box>
                <Box sx={{ width: '1px', height: 12, bgcolor: 'divider' }} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <SwapHoriz sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">{r.len}m</Typography>
                </Box>
              </Box>
            </Box>
          </motion.div>
        </AnimatePresence>
      </Box>

      <IconButton
        onClick={next}
        disabled={activeIdx === total - 1}
        size="small"
        sx={{ color: 'text.secondary', opacity: activeIdx === total - 1 ? 0.2 : 1 }}
      >
        <ChevronRight />
      </IconButton>
    </Box>
  )
}

export default ResultCard