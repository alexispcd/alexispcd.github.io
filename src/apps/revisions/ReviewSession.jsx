import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Card, CircularProgress, Divider, LinearProgress, Typography } from '@mui/material'
import Autorenew from '@mui/icons-material/Autorenew'
import WarningAmber from '@mui/icons-material/WarningAmber'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { cardSx } from '../../styles/glass'
import { cards } from './data'
import { buildSession, grade } from './leitner'
import FlashCard from './FlashCard'
import useProgress from './useProgress'

const PAGE_SX = { height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
const INNER_SX = {
  flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
  maxWidth: 720, width: '100%', mx: 'auto', px: 2.5,
  pt: `${HEADER_HEIGHT + 8}px`, pb: 3.5,
}

const ReviewSession = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const filters = location.state?.filters ?? null

  const { rows, snapshot, loading, error, save } = useProgress()

  const [phase, setPhase] = useState('main')
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [reinforce, setReinforce] = useState([])
  const [stats, setStats] = useState({ known: 0, unknown: 0 })
  const [minutes, setMinutes] = useState(1)
  const [writeError, setWriteError] = useState(null)
  const startedAt = useRef(null)

  useEffect(() => { startedAt.current = Date.now() }, [])

  // La file se compose a partir du snapshot fige au chargement, jamais des rows
  // vivants : les reponses de la session ne la recomposent donc pas.
  const queue = useMemo(
    () => (snapshot && filters ? buildSession(cards, snapshot, { filters }).queue : null),
    [snapshot, filters],
  )

  const list = phase === 'second' ? reinforce : (queue ?? [])
  const current = list[index] ?? null

  const finish = () => {
    setPhase('done')
    setMinutes(Math.max(1, Math.round((Date.now() - (startedAt.current ?? Date.now())) / 60000)))
  }

  const answer = (known) => {
    if (!current) return

    // Deuxieme passage : renforcement pur, aucune ecriture, aucune boite touchee.
    if (phase === 'second') {
      if (index + 1 < reinforce.length) {
        setIndex(index + 1)
        setRevealed(false)
      } else {
        finish()
      }
      return
    }

    const next = grade(rows[current.id], known)
    save(current, next).catch(() => {
      setWriteError('Réseau perdu, les dernières réponses ne sont pas enregistrées.')
    })

    setStats((prev) => (known
      ? { ...prev, known: prev.known + 1 }
      : { ...prev, unknown: prev.unknown + 1 }))

    // Une carte ratee ne passe qu'une fois en renforcement, meme ratee de nouveau.
    const pending = known ? reinforce : [...reinforce, current]
    if (!known) setReinforce(pending)

    if (index + 1 < queue.length) {
      setIndex(index + 1)
      setRevealed(false)
    } else if (pending.length > 0) {
      setPhase('second')
      setIndex(0)
      setRevealed(false)
    } else {
      finish()
    }
  }

  // Rechargement de page : aucun state de navigation, donc aucun filtre.
  if (!filters) return <Navigate to="/revisions" replace />

  if (loading || (queue === null && !error)) {
    return (
      <Box sx={PAGE_SX}>
        <Box sx={{ ...INNER_SX, alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress size={24} />
        </Box>
      </Box>
    )
  }

  if (error || writeError) {
    return (
      <Box sx={PAGE_SX}>
        <Box sx={INNER_SX}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: 3, mb: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              bgcolor: 'primary.light', color: 'primary.main',
            }}>
              <WarningAmber />
            </Box>
            <Typography variant="h6" fontWeight={600}>Session arrêtée</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
              {writeError
                ? `${writeError} Les réponses déjà enregistrées sont conservées, les cartes non enregistrées reviendront.`
                : error}
            </Typography>
          </Box>
          <Button variant="contained" fullWidth sx={{ height: 52 }} onClick={() => navigate('/revisions')}>
            Retour aux révisions
          </Button>
        </Box>
      </Box>
    )
  }

  if (phase === 'done' || !current) {
    const total = stats.known + stats.unknown
    return (
      <Box sx={PAGE_SX}>
        <Box sx={INNER_SX}>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
              <Typography
                variant="overline"
                sx={{ color: 'text.disabled', letterSpacing: '0.15em', fontSize: '0.6rem', whiteSpace: 'nowrap' }}
              >
                Session terminée
              </Typography>
              <Divider sx={{ flex: 1 }} />
            </Box>
            <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '3.4rem', lineHeight: 1 }}>
              {stats.known}
              <Box component="span" sx={{ color: 'text.secondary', fontSize: '2rem' }}> / {total}</Box>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.6 }}>
              {stats.unknown > 0
                ? `${stats.unknown} carte${stats.unknown > 1 ? 's reviennent' : ' revient'} demain en boîte 1. Les ${stats.known} autres montent d'une boîte.`
                : 'Toutes les cartes montent d\'une boîte.'}
            </Typography>
            <Card sx={{ ...cardSx, mt: 3, px: 2.5, py: 0.75 }}>
              {[
                ['Su', String(stats.known), 'primary.main'],
                ['Pas su', String(stats.unknown), 'text.secondary'],
                ['Durée', `${minutes} min`, 'text.secondary'],
              ].map(([label, value, color], rowIndex) => (
                <Box
                  key={label}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, py: 1.375,
                    borderTop: rowIndex === 0 ? 'none' : '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" sx={{ flex: 1 }}>{label}</Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ color }}>{value}</Typography>
                </Box>
              ))}
            </Card>
          </Box>
          <Button variant="contained" fullWidth sx={{ height: 52 }} onClick={() => navigate('/revisions')}>
            Retour aux révisions
          </Button>
        </Box>
      </Box>
    )
  }

  const second = phase === 'second'
  const total = second ? reinforce.length : queue.length

  return (
    <Box sx={PAGE_SX}>
      <Box sx={INNER_SX}>

        {/* Compteur de progression, distinct entre file principale et renforcement. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', letterSpacing: '0.1em', fontSize: '0.72rem', whiteSpace: 'nowrap' }}
          >
            {second ? 'Deuxième passage ' : ''}{index + 1} / {total}
          </Typography>
          <LinearProgress
            variant="determinate"
            value={((index + 1) / total) * 100}
            sx={{ flex: 1, height: 3, borderRadius: 2 }}
          />
        </Box>

        {/* Mention permanente du renforcement, HORS de la carte pour ne pas
            concurrencer la lecture du recto. */}
        {second && (
          <Box sx={{
            borderRadius: 3.5, px: 1.75, py: 1.5, mb: 1.75,
            bgcolor: 'primary.light', border: '1px solid', borderColor: 'primary.main',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.875, color: 'primary.main' }}>
              <Autorenew sx={{ fontSize: 15 }} />
              <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.78rem' }}>
                Renforcement, sans évaluation
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.5 }}>
              Ces cartes ne changent pas de boîte et reviendront demain, quelle que soit votre réponse.
            </Typography>
          </Box>
        )}

        <FlashCard card={current} revealed={revealed} onReveal={() => setRevealed(true)} />

        {/* Les boutons n'apparaissent qu'apres la revelation, pour ne pas
            repondre a l'aveugle. La place reste reservee pour que la carte ne
            change pas de hauteur au moment du retournement. */}
        <Box sx={{ display: 'flex', gap: 1.25, mt: 1.75, height: 52, flex: 'none' }}>
          {revealed && (
            <>
              <Button variant="outlined" color="inherit" fullWidth sx={{ height: 52 }} onClick={() => answer(false)}>
                Pas su
              </Button>
              <Button
                variant={second ? 'outlined' : 'contained'}
                fullWidth
                sx={{ height: 52, ...(second ? { bgcolor: 'primary.light' } : null) }}
                onClick={() => answer(true)}
              >
                Su
              </Button>
            </>
          )}
        </Box>

      </Box>
    </Box>
  )
}

export default ReviewSession
