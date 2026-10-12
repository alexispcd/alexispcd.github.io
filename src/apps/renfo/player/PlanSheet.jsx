import { useEffect, useMemo, useRef } from 'react'
import { Box, Drawer, IconButton, Typography } from '@mui/material'
import Close from '@mui/icons-material/Close'
import CheckCircle from '@mui/icons-material/CheckCircle'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { formatClock } from '../dates'
import { blockLabel, doseLabel, listDoses, mainDoseLabel, supersetMembers } from '../content'
import BandChip from '../BandChip'
import ExerciseThumb from '../session/ExerciseThumb'

const exoCount = (n) => `${n} ${n > 1 ? 'exos' : 'exo'}`

/** Méta d'un bloc : "3 tours · récup 1:15" ou "2 exos". */
const blockMeta = (block) => (block.type === 'superset'
  ? `${block.rounds} tours · récup ${formatClock(block.rest_sec)}`
  : exoCount(block.items?.length ?? 0))

/**
 * Contenu du plan, monté à l'ouverture de la feuille : le bloc courant défile en vue.
 * `current` : step de travail courant (ou le prochain pendant un repos), null à la fin.
 */
const PlanContent = ({ content, steps, cursor, finished, current, bandFor, bands, kindLabel, weekLabel, totalSeconds, onClose }) => {
  const currentRef = useRef(null)
  const blocks = useMemo(() => (Array.isArray(content?.blocks) ? content.blocks : []), [content])

  // Dernier index de step de travail par exercice et par bloc.
  const lastIndex = useMemo(() => {
    const byExercise = new Map()
    const byBlock = new Map()
    for (const s of steps) {
      if (s.kind !== 'work') continue
      byExercise.set(`${s.blockIndex}:${s.slug}`, s.index)
      byBlock.set(s.blockIndex, s.index)
    }
    return { byExercise, byBlock }
  }, [steps])

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  const isDone = (index) => finished || (index != null && index < cursor)
  const minutes = content?.estimated_min ?? Math.round(totalSeconds / 60)
  const sub = [kindLabel, weekLabel, `${minutes} min environ`].filter(Boolean).join(' · ')

  const rowsOf = (block, blockIndex) => (block.type === 'superset'
    ? supersetMembers(block).map(({ dose, role }) => ({ dose, role, text: doseLabel(dose) }))
    : listDoses({ blocks: [block] }).map(({ dose }) => ({
      dose, role: null, text: block.type === 'main' ? mainDoseLabel(dose) : doseLabel(dose),
    }))).map((row) => ({ ...row, key: `${blockIndex}:${row.dose.slug}` }))

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 2, pt: 1, pb: 1.5, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, pt: 1 }}>
          <Typography sx={{ fontSize: '1.15rem', fontWeight: 800 }}>Plan de la séance</Typography>
          <Typography variant="body2" color="text.secondary">{sub}</Typography>
        </Box>
        <IconButton onClick={onClose} aria-label="Fermer le plan" sx={{ width: 44, height: 44 }}>
          <Close />
        </IconButton>
      </Box>

      <Box sx={{ overflowY: 'auto', px: 2, pt: 1.5, pb: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }}>
        {blocks.map((block, blockIndex) => {
          const isCurrent = current?.blockIndex === blockIndex
          const blockDone = isDone(lastIndex.byBlock.get(blockIndex))
          const status = blockDone
            ? 'Fait'
            : isCurrent && current.round ? `Tour ${current.round} / ${current.roundCount}` : null
          return (
            <Box
              key={blockIndex}
              ref={isCurrent ? currentRef : undefined}
              sx={{
                mb: 1.25, p: 1.25, borderRadius: '16px', border: '1px solid',
                borderColor: isCurrent ? 'primary.main' : 'divider',
                bgcolor: isCurrent ? 'action.hover' : 'transparent',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, px: 0.5, mb: 0.5 }}>
                <Typography sx={{ flex: 1, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: isCurrent ? 'primary.main' : 'text.secondary' }}>
                  {blockLabel(block, blockIndex, blocks)}
                </Typography>
                <Typography variant="caption" color="text.secondary">{blockMeta(block)}</Typography>
                {status && (
                  <Typography variant="caption" sx={{ fontWeight: 700, color: blockDone ? 'primary.main' : 'text.primary' }}>
                    · {status}
                  </Typography>
                )}
              </Box>
              {rowsOf(block, blockIndex).map(({ dose, role, text, key }) => {
                const done = isDone(lastIndex.byExercise.get(key))
                const active = !finished && current?.blockIndex === blockIndex && current.slug === dose.slug
                const kg = bandFor(dose.slug, dose.band_kg)
                return (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 0.75, opacity: done && !active ? 0.6 : 1 }}>
                    <ExerciseThumb slug={dose.slug} size={44} radius={8} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.25 }}>
                        {role && <Box component="span" sx={{ color: 'primary.main' }}>{role} · </Box>}
                        {EXERCISE_INDEX[dose.slug]?.name ?? dose.slug}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">{text}</Typography>
                    </Box>
                    {active && (
                      <Box sx={{ px: 1, py: 0.25, borderRadius: '8px', bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: '0.66rem', fontWeight: 800, flexShrink: 0 }}>
                        En cours
                      </Box>
                    )}
                    {kg != null && <BandChip kg={kg} bands={bands} size="small" />}
                    {done && !active && <CheckCircle sx={{ fontSize: 20, color: 'primary.main', flexShrink: 0 }} />}
                  </Box>
                )
              })}
            </Box>
          )
        })}
      </Box>
    </>
  )
}

/**
 * Plan de la séance en feuille du bas, au-dessus du player (`zIndex`). Lecture seule :
 * blocs, exercices, dosages, bandes, avancement.
 */
const PlanSheet = ({ open, onClose, zIndex, ...props }) => (
  <Drawer
    anchor="bottom"
    open={open}
    onClose={onClose}
    sx={{ zIndex }}
    slotProps={{
      paper: {
        sx: {
          maxHeight: '88dvh', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
          bgcolor: 'background.paper', backgroundImage: 'none',
          display: 'flex', flexDirection: 'column',
          pl: 'env(safe-area-inset-left, 0px)', pr: 'env(safe-area-inset-right, 0px)',
        },
      },
    }}
  >
    {open && <PlanContent onClose={onClose} {...props} />}
  </Drawer>
)

export default PlanSheet
