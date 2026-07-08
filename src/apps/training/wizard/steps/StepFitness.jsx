import { useState } from 'react'
import {
  Box, Typography, TextField, Button, CircularProgress, Alert,
} from '@mui/material'
import CloudDownload from '@mui/icons-material/CloudDownloadOutlined'
import { SectionLabel, GlassCard } from '../WizardParts'
import { getCorosFitness } from '../../../../lib/training'

const MODES = [
  { key: 'coros', label: 'Depuis Coros' },
  { key: 'manual', label: 'Saisie manuelle' },
]

const PREDICTION_LABELS = [
  ['five_k', '5 km'],
  ['ten_k', '10 km'],
  ['half', 'Semi'],
  ['marathon', 'Marathon'],
]

const StepFitness = ({ draft, patch }) => {
  const [loading, setLoading] = useState(false)
  const [importError, setImportError] = useState(null)

  const importCoros = async () => {
    setLoading(true)
    setImportError(null)
    try {
      const f = await getCorosFitness()
      patch({
        source: 'coros',
        corosLoaded: true,
        vmaKmh: f.vma_derived != null ? String(f.vma_derived) : draft.vmaKmh,
        thresholdPace: f.threshold_pace || draft.thresholdPace,
        vo2max: f.vo2max != null ? String(f.vo2max) : draft.vo2max,
        predictions: f.predictions ?? null,
        runningLevel: f.running_level ?? '',
      })
    } catch (e) {
      setImportError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const setMode = (key) => patch({ source: key })

  const vma = Number(draft.vmaKmh)
  const vmaInvalid = draft.vmaKmh !== '' && (Number.isNaN(vma) || vma < 10 || vma > 25)
  const preds = draft.predictions

  return (
    <Box>
      <Typography variant="h6" fontWeight={750} sx={{ letterSpacing: '-0.02em' }}>
        Ta forme
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        Ces repères calibrent les allures cibles de ton plan.
      </Typography>

      {/* Choix du mode */}
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
        {MODES.map((m) => {
          const on = draft.source === m.key
          return (
            <Box
              key={m.key}
              onClick={() => setMode(m.key)}
              sx={{
                flex: 1, textAlign: 'center', py: 1.25, borderRadius: '12px', cursor: 'pointer',
                fontSize: '0.82rem', fontWeight: 600, userSelect: 'none', border: '1px solid',
                borderColor: on ? 'primary.main' : 'divider',
                bgcolor: on ? 'primary.light' : 'transparent',
                color: on ? 'primary.main' : 'text.secondary',
                transition: 'all .15s',
              }}
            >
              {m.label}
            </Box>
          )
        })}
      </Box>

      {/* Import Coros */}
      {draft.source === 'coros' && (
        <Box sx={{ mt: 2 }}>
          <Button
            variant={draft.corosLoaded ? 'outlined' : 'contained'}
            fullWidth
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <CloudDownload />}
            onClick={importCoros}
            disabled={loading}
          >
            {draft.corosLoaded ? 'Réimporter mon bilan Coros' : 'Importer mon bilan Coros'}
          </Button>
          {importError && <Alert severity="error" sx={{ mt: 1.5 }}>{importError}</Alert>}

          {draft.corosLoaded && preds && (
            <GlassCard sx={{ mt: 2, p: 1.75 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Prédictions Coros
              </Typography>
              <Box sx={{ display: 'flex', gap: 2.5, mt: 1, flexWrap: 'wrap' }}>
                {PREDICTION_LABELS.filter(([k]) => preds[k]).map(([k, label]) => (
                  <Box key={k}>
                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {preds[k]}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
                      {label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {draft.runningLevel && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
                  Niveau : {draft.runningLevel}
                </Typography>
              )}
            </GlassCard>
          )}
        </Box>
      )}

      {/* Champs — communs aux deux modes, modifiables après import */}
      <SectionLabel>VMA (km/h)</SectionLabel>
      <TextField
        fullWidth
        type="number"
        placeholder="16.3"
        value={draft.vmaKmh}
        onChange={(e) => patch({ vmaKmh: e.target.value })}
        error={vmaInvalid}
        helperText={vmaInvalid ? 'Valeur attendue entre 10 et 25 km/h' : 'Obligatoire — base des allures'}
        slotProps={{ htmlInput: { step: 0.1, min: 10, max: 25, inputMode: 'decimal' } }}
      />

      <SectionLabel>Allure seuil (optionnel)</SectionLabel>
      <TextField
        fullWidth
        placeholder="4:20"
        value={draft.thresholdPace}
        onChange={(e) => patch({ thresholdPace: e.target.value })}
        helperText="Format m:ss par km"
      />

      <SectionLabel>VO2max (optionnel)</SectionLabel>
      <TextField
        fullWidth
        type="number"
        placeholder="57"
        value={draft.vo2max}
        onChange={(e) => patch({ vo2max: e.target.value })}
        slotProps={{ htmlInput: { min: 20, max: 90, inputMode: 'numeric' } }}
      />
    </Box>
  )
}

export default StepFitness
