import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, Snackbar, Typography } from '@mui/material'
import PlayArrow from '@mui/icons-material/PlayArrow'
import Schedule from '@mui/icons-material/Schedule'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import { cardSx } from '../../../styles/glass'
import { useOnline } from '../../../hooks/useOnline'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { completeSession, deleteFreeSession, getBands, getSession, resetSession } from '../../../lib/renfo'
import { painAreaLabel } from '../../../lib/feedback'
import { KIND_LABELS } from '../../../../supabase/functions/_shared/strength/rules.ts'
import { bandOf, blockLabel, doseLabel, mainDoseLabel, supersetLabel } from '../content'
import ConfirmDialog from '../ConfirmDialog'
import EquipmentBox from './EquipmentBox'
import ExerciseRow from './ExerciseRow'
import ExerciseSheet from './ExerciseSheet'
import ValidateDialog from './ValidateDialog'
import RenfoPlayer from '../player/RenfoPlayer'
import { createBeeps } from '../player/beeps'

const loadPage = async (sessionId) => {
  const [session, bands] = await Promise.all([getSession(sessionId), getBands()])
  return { session, bands }
}

const sectionTitleSx = {
  fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'text.disabled',
}

/** Détail d'une séance Renfo : matériel, blocs, fiche exercice, player et validation. */
const SessionPage = () => {
  const { sessionId } = useParams()
  const navigate = useAppNavigate()
  const online = useOnline()
  const [state, setState] = useState({ status: 'loading', sessionId })
  const [sheetSlug, setSheetSlug] = useState(null)
  const [validate, setValidate] = useState(null) // { bandsUsed } quand le dialog de ressenti est ouvert
  const [player, setPlayer] = useState(null) // { beeps } quand le player est ouvert
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [snack, setSnack] = useState(null)

  // Changement de séance : état de chargement remis au rendu.
  if (state.sessionId !== sessionId) setState({ status: 'loading', sessionId })

  useEffect(() => {
    let cancelled = false
    loadPage(sessionId).then(
      (res) => { if (!cancelled) setState({ status: 'ready', sessionId, ...res }) },
      (err) => {
        console.error('[renfo session]', err)
        if (!cancelled) setState({ status: 'error', sessionId })
      },
    )
    return () => { cancelled = true }
  }, [sessionId])

  if (state.status === 'loading') {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', pt: `${HEADER_HEIGHT}px` }}>
        <CircularProgress size={28} />
      </Box>
    )
  }
  if (state.status === 'error') {
    return (
      <Box sx={{ px: 2, pt: `${HEADER_HEIGHT + 16}px` }}>
        <Alert severity="error">Séance introuvable.{!online && ' Tu es hors ligne et elle n\'est pas en cache.'}</Alert>
      </Box>
    )
  }

  const { session, bands } = state
  const { content } = session
  const blocks = Array.isArray(content?.blocks) ? content.blocks : []
  const done = session.status === 'done'
  const free = session.cycle_id == null
  const setSession = (next) => setState((s) => ({ ...s, session: { ...s.session, ...next } }))

  // Bips créés et débloqués DANS le geste utilisateur (contrainte iOS), confiés au player.
  const startPlayer = () => {
    let beeps
    try {
      beeps = createBeeps()
      beeps.unlock()
    } catch {
      beeps = null
    }
    setPlayer({ beeps })
  }

  const submitValidation = async (feedback) => {
    const updated = await completeSession(session.id, { bandsUsed: validate?.bandsUsed, feedback })
    setSession(updated)
    setValidate(null)
    setSnack({ severity: 'success', text: 'Séance validée' })
  }

  const doReset = async () => {
    setBusy(true)
    try {
      setSession(await resetSession(session.id))
    } catch (e) {
      console.error('[renfo session]', e)
      setSnack({ severity: 'error', text: "La séance n'a pas pu être remise à faire" })
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    setBusy(true)
    try {
      await deleteFreeSession(session.id)
      navigate('/renfo')
    } catch (e) {
      console.error('[renfo session]', e)
      setSnack({ severity: 'error', text: 'La suppression a échoué' })
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  const context = free
    ? 'Séance libre'
    : `Cycle ${session.cycle?.number ?? ''} · Semaine ${session.week_index}`
  const btn = { height: 48, borderRadius: '24px', textTransform: 'none', fontWeight: 700, boxShadow: 'none' }

  const renderRow = (dose, key, doseText, role = null) => (
    <ExerciseRow
      key={key}
      slug={dose.slug}
      role={role}
      doseText={doseText}
      bandKg={bandOf(dose, session.bands_used)}
      bands={bands}
      onOpen={() => setSheetSlug(dose.slug)}
    />
  )

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, pb: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2 }}>

        {/* En-tête */}
        <Box sx={{ mt: 2, px: 0.5 }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'primary.main' }}>
            {KIND_LABELS[session.kind] ?? session.kind}
          </Typography>
          <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontStyle: 'italic', fontSize: '1.7rem', lineHeight: 1.15, mt: 0.25 }}>
            {session.title}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.75, color: 'text.secondary' }}>
            <Typography variant="body2">{context}</Typography>
            {content?.estimated_min != null && (
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                <Schedule sx={{ fontSize: 16 }} />
                <Typography variant="body2">{content.estimated_min} min</Typography>
              </Box>
            )}
          </Box>
        </Box>

        <EquipmentBox content={content} bandsUsed={session.bands_used} bands={bands} />

        {/* Blocs */}
        {blocks.map((block, i) => (
          <Box key={i} sx={{ ...cardSx, borderRadius: '20px', px: 2, pt: 1.75, pb: 1, mt: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
              <Typography sx={sectionTitleSx}>{blockLabel(block, i, blocks)}</Typography>
              {block.type === 'superset' && (
                <Typography variant="caption" color="text.secondary">{supersetLabel(block)}</Typography>
              )}
            </Box>
            {block.type === 'superset'
              ? [renderRow(block.a, 'a', doseLabel(block.a), 'A'), renderRow(block.b, 'b', doseLabel(block.b), 'B')]
              : (block.items ?? []).map((item, j) =>
                renderRow(item, j, block.type === 'main' ? mainDoseLabel(item) : doseLabel(item)))}
          </Box>
        ))}

        {/* Ressenti d'une séance faite */}
        {done && (
          <Box sx={{ ...cardSx, borderRadius: '20px', p: 2, mt: 2 }}>
            <Typography sx={sectionTitleSx}>Ressenti</Typography>
            <Typography variant="body2" sx={{ mt: 0.75 }}>
              {session.rpe != null ? `Effort ${session.rpe} sur 10` : 'Effort non noté'}
              {session.completed_at && ` · faite le ${new Date(session.completed_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
            </Typography>
            {session.pain_areas?.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Douleurs : {session.pain_areas.map(painAreaLabel).join(', ')}
              </Typography>
            )}
            {session.feedback_note && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                {session.feedback_note}
              </Typography>
            )}
          </Box>
        )}

        {/* Actions */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 3 }}>
          {!done && (
            <>
              <Button variant="contained" startIcon={<PlayArrow />} sx={btn} onClick={startPlayer} disabled={!blocks.length}>
                Démarrer
              </Button>
              <Button variant="outlined" sx={btn} onClick={() => setValidate({ bandsUsed: session.bands_used })} disabled={!online || busy}>
                Valider sans le player
              </Button>
              {free && (
                <Button color="error" sx={btn} onClick={() => setConfirmDelete(true)} disabled={!online || busy}>
                  Supprimer
                </Button>
              )}
            </>
          )}
          {done && (
            <Button variant="outlined" sx={btn} onClick={doReset} disabled={!online || busy}>
              {busy ? <CircularProgress size={18} color="inherit" /> : 'Remettre à faire'}
            </Button>
          )}
          {!online && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
              Hors ligne : le player fonctionne, la validation attendra le réseau.
            </Typography>
          )}
        </Box>
      </Box>

      <ExerciseSheet slug={sheetSlug} onClose={() => setSheetSlug(null)} />

      <ValidateDialog
        open={Boolean(validate)}
        online={online}
        onClose={() => setValidate(null)}
        onSubmit={submitValidation}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Supprimer cette séance libre ?"
        text="Elle disparaîtra de ta semaine."
        confirmLabel="Supprimer"
        busy={busy}
        disabled={!online}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={doDelete}
      />

      {player && (
        <RenfoPlayer
          content={content}
          bands={bands}
          initialBandsUsed={session.bands_used}
          beeps={player.beeps}
          onClose={() => setPlayer(null)}
          onValidate={(bandsUsed) => {
            setPlayer(null)
            setSession({ bands_used: bandsUsed })
            setValidate({ bandsUsed })
          }}
        />
      )}

      <Snackbar
        open={Boolean(snack)}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack?.severity ?? 'info'} onClose={() => setSnack(null)} sx={{ width: '100%' }}>
          {snack?.text}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default SessionPage
