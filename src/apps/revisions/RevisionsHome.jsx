import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Button, Card, CircularProgress, Divider, Typography } from '@mui/material'
import TaskAlt from '@mui/icons-material/TaskAlt'
import StyleOutlined from '@mui/icons-material/StyleOutlined'
import WarningAmber from '@mui/icons-material/WarningAmber'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { cardSx } from '../../styles/glass'
import { cards } from './data'
import { EMPTY_FILTERS, addDays, buildSession, matchesFilters, todayKey } from './leitner'
import SessionBar, { BAR_HEIGHT } from './SessionBar'
import StatsPanel from './StatsPanel'
import useProgress from './useProgress'

const PAGE_SX = { height: '100%', overflowY: 'auto' }
const INNER_SX = { maxWidth: 720, mx: 'auto', px: 2.5, pt: `${HEADER_HEIGHT + 16}px`, pb: 6 }
// Meme page, mais degagee sous la barre flottante : hauteur de la barre, son
// decalage bas et une marge de respiration.
const INNER_WITH_BAR_SX = {
  ...INNER_SX,
  pb: `calc(max(16px, env(safe-area-inset-bottom, 0px) + 12px) + ${BAR_HEIGHT + 24}px)`,
}

const Eyebrow = ({ children }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
    <Typography
      variant="overline"
      sx={{ color: 'text.disabled', letterSpacing: '0.15em', fontSize: '0.6rem', whiteSpace: 'nowrap' }}
    >
      {children}
    </Typography>
    <Divider sx={{ flex: 1 }} />
  </Box>
)

const CountRow = ({ label, value, muted, first }) => (
  <Box sx={{
    display: 'flex', alignItems: 'center', gap: 1.5, py: 1.375,
    borderTop: first ? 'none' : '1px solid', borderColor: 'divider',
  }}>
    {!muted && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', flex: 'none' }} />}
    <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
    <Typography variant="body2" fontWeight={600} sx={{ color: muted ? 'text.secondary' : 'primary.main' }}>
      {value}
    </Typography>
  </Box>
)

const EmptyState = ({ icon, title, children, accent }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', py: 6 }}>
    <Box sx={{
      width: 44, height: 44, borderRadius: 3, mb: 2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      bgcolor: accent ? 'primary.light' : 'divider',
      color: accent ? 'primary.main' : 'text.secondary',
    }}>
      {icon}
    </Box>
    <Typography variant="h6" fontWeight={600}>{title}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
      {children}
    </Typography>
  </Box>
)

const RevisionsHome = () => {
  const navigate = useNavigate()
  const { rows, loading, error, reload } = useProgress()
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  // Apercu de la session du jour : memes regles que la session reelle, donc le
  // chiffre annonce applique deja le plafond de cartes nouvelles.
  const preview = useMemo(
    () => buildSession(cards, rows, { filters }),
    [rows, filters],
  )

  // Echeances a venir, pour l'ecran "tout est a jour".
  const upcoming = useMemo(() => {
    const today = todayKey()
    const inThreeDays = addDays(today, 3)
    const pool = cards.filter((card) => matchesFilters(card, filters))
    let tomorrow = 0
    let soon = 0
    let unseen = 0
    for (const card of pool) {
      const row = rows[card.id]
      if (!row) unseen += 1
      else if (row.due_on === addDays(today, 1)) tomorrow += 1
      else if (row.due_on > today && row.due_on <= inThreeDays) soon += 1
    }
    return { tomorrow, soon, unseen }
  }, [rows, filters])

  const total = preview.queue.length
  const minutes = Math.max(1, Math.round(total * 0.65))

  // Repartition par theme des cartes retenues pour aujourd'hui.
  const byTheme = useMemo(() => {
    const counts = new Map()
    for (const card of preview.queue) {
      counts.set(card.theme, (counts.get(card.theme) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [preview])

  const start = () => navigate('/revisions/session', { state: { filters } })

  // Etat 1 : aucun JSON de cartes dans le bundle.
  if (cards.length === 0) {
    return (
      <Box sx={PAGE_SX}>
        <Box sx={INNER_SX}>
          <EmptyState icon={<StyleOutlined />} title="Aucune carte">
            Aucun jeu de cartes n&apos;est encore présent dans l&apos;application.
            Déposez un fichier de thème pour commencer à réviser.
          </EmptyState>
        </Box>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box sx={PAGE_SX}>
        <Box sx={{ ...INNER_SX, display: 'flex', justifyContent: 'center', pt: `${HEADER_HEIGHT + 80}px` }}>
          <CircularProgress size={24} />
        </Box>
      </Box>
    )
  }

  // Etat 3 : le chargement de la progression a echoue.
  if (error) {
    return (
      <Box sx={PAGE_SX}>
        <Box sx={INNER_SX}>
          <EmptyState icon={<WarningAmber />} title="Chargement impossible" accent>
            {error} La progression n&apos;a pas pu être récupérée.
          </EmptyState>
          <Button variant="contained" fullWidth sx={{ height: 52 }} onClick={reload}>
            Réessayer
          </Button>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={PAGE_SX}>
      <Box sx={INNER_WITH_BAR_SX}>

        {total === 0 ? (
          /* Etat 2 : rien a reviser aujourd'hui. */
          <>
            <EmptyState icon={<TaskAlt />} title="Tout est à jour">
              Aucune carte n&apos;est due aujourd&apos;hui.
            </EmptyState>
            <Card sx={{ ...cardSx, px: 2.5, py: 0.75 }}>
              <CountRow first label="Demain" value={upcoming.tomorrow} />
              <CountRow label="Dans 3 jours" value={upcoming.soon} muted />
              <CountRow label="Jamais vues" value={upcoming.unseen} muted />
            </Card>
          </>
        ) : (
          <>
            {/* Compteur du jour : exactement ce que la session contiendra. */}
            <Card sx={{ ...cardSx, px: 2.5, py: 3 }}>
              <Typography sx={{
                fontFamily: '"DM Serif Display", serif', fontSize: '4.2rem', lineHeight: 0.9,
                color: 'primary.main', letterSpacing: '-0.02em',
              }}>
                {total}
              </Typography>
              <Typography variant="body1" fontWeight={500} sx={{ mt: 0.75 }}>
                carte{total > 1 ? 's' : ''} à réviser aujourd&apos;hui
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Environ {minutes} minute{minutes > 1 ? 's' : ''}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.25, mt: 2.25, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                {[['rappels', preview.due.length], ['nouvelles', preview.fresh.length]].map(([label, value]) => (
                  <Box key={label} sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '1.35rem', fontWeight: 600 }}>{value}</Typography>
                    <Typography
                      variant="overline"
                      sx={{ display: 'block', color: 'text.secondary', letterSpacing: '0.08em', fontSize: '0.68rem' }}
                    >
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Card>

            <Box sx={{ mt: 2.75 }}>
              <Eyebrow>Par thème</Eyebrow>
              <Card sx={{ ...cardSx, px: 2.5, py: 0.75 }}>
                {byTheme.map(([theme, count], index) => (
                  <CountRow key={theme} first={index === 0} label={theme} value={count} />
                ))}
              </Card>
            </Box>
          </>
        )}

        <Box sx={{ mt: 2.75 }}>
          <Eyebrow>Répartition</Eyebrow>
          <StatsPanel cards={cards} rows={rows} />
        </Box>

      </Box>

      <SessionBar
        filters={filters}
        onFiltersChange={setFilters}
        onStart={start}
        startDisabled={total === 0}
      />
    </Box>
  )
}

export default RevisionsHome
