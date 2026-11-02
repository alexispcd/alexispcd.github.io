import { useState } from 'react'
import { Box, Typography, IconButton } from '@mui/material'
import ChevronLeft from '@mui/icons-material/ChevronLeft'
import ChevronRight from '@mui/icons-material/ChevronRight'
import ArrowUpward from '@mui/icons-material/ArrowUpward'
import SwapHoriz from '@mui/icons-material/SwapHoriz'
import { motion, AnimatePresence, MotionConfig } from 'framer-motion'
import { slopeColor } from './utils'
import { glassSx } from '../../styles/glass'

const ResultCard = ({ results, activeIdx, setActiveIdx }) => {
  const r = results[activeIdx]
  const total = results.length
  const [direction, setDirection] = useState(0)

  // Ancien verre, aplati : fond surface, sans flou ni ombre (src/styles/glass.js).
  const glass = glassSx

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

  // reducedMotion="user" : Framer suit le réglage « Réduire les animations ».
  return (
    <MotionConfig reducedMotion="user">
      <Box sx={{
        position: 'absolute',
        left: 8, right: 8,
        // Carte absolue dans le conteneur Cotes, deja raccourci de l'inset bas par le
        // padding de contenu (App.jsx). L'inset est donc gere en amont, pas ici.
        bottom: '116px',
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
    </MotionConfig>
  )
}

export default ResultCard