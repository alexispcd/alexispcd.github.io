import { useState } from 'react'
import { Box, Typography, useTheme } from '@mui/material'
import { formatPace } from '../constants'
import {
  estimateStepSeconds, estimateStepMeters, groupSteps, stepSizeLabel, stepShortLabel,
} from '../sessionMath'

// Géométrie du viewBox (unités SVG, mises à l'échelle en 100% de largeur).
const PAD_L = 38
const PAD_R = 10
const PAD_T = 12
const PAD_B = 20
const H = 200
const PLOT_H = H - PAD_T - PAD_B
const MIN_STEP_W = 18   // largeur mini d'un step (lisibilité des intervalles)
const CAP_SEC = 300     // durée au-delà de laquelle on plafonne (échauffement long)
const INNER_BASE = 320  // largeur cible avant application du mini par step

const STATUS_WORD = { ok: '✓ dans la cible', proche: '≈ proche', ecart: '✗ écart' }

/**
 * Graphe d'allure par step (SVG maison).
 * - `steps` : session_steps ordonnés.
 * - `actualLaps` : null tant que non synchronisé, sinon [{ lap_index, step_index, avg_pace_sec, ... }].
 * - `kmLaps` : laps auto-kilomètre bruts (vue "par km", purement visuelle), null si indispo.
 * - `comparisons` : issu de analysis.comparisons (statut ok/proche/ecart/free par step).
 */
const PaceChart = ({ steps, actualLaps = null, kmLaps = null, comparisons = [] }) => {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  const [sel, setSel] = useState(null)
  const [view, setView] = useState('step')

  const synced = Array.isArray(actualLaps) && actualLaps.length > 0
  const showKm = synced && Array.isArray(kmLaps) && kmLaps.length > 0
  const kmView = showKm && view === 'km'

  const switchView = (v) => {
    if (v === view) return
    setSel(null) // sel change de sémantique (index step ↔ index km)
    setView(v)
  }

  // ── Palette ──────────────────────────────────────────────────────────────
  const C = {
    grid: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    axis: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
    band: 'rgba(96,165,250,0.20)',
    target: '#60a5fa',
    neutral: dark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.035)',
    line: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.45)',
    dot: theme.palette.background.default,
    ok: theme.palette.primary.main,
    proche: '#eab308',
    ecart: '#ef4444',
    free: theme.palette.text.disabled,
  }
  const statusColor = (st) => C[st] ?? C.free

  // ── Échelle Y (allure : rapide en haut) ────────────────────────────────────
  const paces = []
  steps.forEach((s) => {
    if (s.target_pace_sec != null) {
      const tol = s.pace_tolerance_sec ?? 5
      paces.push(s.target_pace_sec - tol, s.target_pace_sec + tol)
    }
  })
  // Échelle calculée par vue active : les allures réalisées incluses sont celles
  // de la vue affichée (les cibles ± tolérance bornent la bande dans les deux cas).
  const scaleLaps = kmView ? kmLaps : (synced ? actualLaps : [])
  scaleLaps.forEach((l) => { if (l.avg_pace_sec != null) paces.push(l.avg_pace_sec) })
  const minP = paces.length ? Math.min(...paces) - 20 : 200
  const maxP = paces.length ? Math.max(...paces) + 20 : 400
  const y = (p) => PAD_T + ((p - minP) / (maxP - minP)) * PLOT_H

  // ── Échelle X (un segment par step, largeur ∝ durée plafonnée) ──────────────
  const weights = steps.map((s) => Math.min(estimateStepSeconds(s) ?? 30, CAP_SEC))
  const totalW = weights.reduce((a, b) => a + b, 0) || 1
  const widths = weights.map((w) => Math.max(MIN_STEP_W, (w / totalW) * INNER_BASE))
  const xs = widths.map((w, i) => ({
    x0: PAD_L + widths.slice(0, i).reduce((a, b) => a + b, 0),
    w,
  }))
  const W = PAD_L + widths.reduce((a, b) => a + b, 0) + PAD_R
  const center = (i) => xs[i].x0 + xs[i].w / 2

  // ── Échelle X vue km (slots uniformes, un par km) ───────────────────────────
  const KM_MIN_W = 22
  const kmCount = showKm ? kmLaps.length : 0
  const kmSlotW = kmCount ? Math.max(KM_MIN_W, INNER_BASE / kmCount) : 0
  const kmXs = Array.from({ length: kmCount }, (_, i) => ({ x0: PAD_L + i * kmSlotW, w: kmSlotW }))
  const kmW = PAD_L + kmCount * kmSlotW + PAD_R
  const kmCenter = (i) => kmXs[i].x0 + kmXs[i].w / 2

  // Distance cumulée (m) en fin de chaque step, pour rattacher un km à son step.
  const stepEnds = steps.reduce((arr, s) => {
    arr.push((arr.length ? arr[arr.length - 1] : 0) + (estimateStepMeters(s) ?? 0))
    return arr
  }, [])
  // Step couvrant le km k (1-based) : celui qui contient le milieu du km.
  // Au-delà de la distance connue, on étend le dernier step.
  const stepForKm = (k) => {
    const d = (k - 0.5) * 1000
    for (let i = 0; i < stepEnds.length; i++) if (d <= stepEnds[i]) return i
    return steps.length - 1
  }
  // Statut d'un km vs. la cible de son step (mêmes seuils que le backend).
  const kmStatus = (pace, step) => {
    if (step?.target_pace_sec == null || pace == null) return 'free'
    const abs = Math.abs(pace - step.target_pace_sec)
    const tol = step.pace_tolerance_sec ?? 5
    if (abs <= tol) return 'ok'
    if (abs <= tol + 4) return 'proche'
    return 'ecart'
  }

  const activeW = kmView ? kmW : W

  // ── Gridlines ──────────────────────────────────────────────────────────────
  const gridVals = [0, 1, 2, 3].map((k) => {
    const raw = minP + ((maxP - minP) * k) / 3
    return Math.round(raw / 5) * 5
  })

  // ── Positions X des laps (interpolation des laps non matchés) ────────────────
  let lapX = []
  if (synced) {
    lapX = actualLaps.map((l) => (l.step_index != null ? center(l.step_index) : null))
    const known = lapX.map((x, i) => (x != null ? i : -1)).filter((i) => i >= 0)
    if (known.length) {
      lapX = lapX.map((x, i) => {
        if (x != null) return x
        const prev = known.filter((k) => k < i).pop()
        const next = known.find((k) => k > i)
        if (prev != null && next != null) {
          const frac = (i - prev) / (next - prev)
          return lapX[prev] + (lapX[next] - lapX[prev]) * frac
        }
        if (prev != null) return lapX[prev] + 14
        if (next != null) return lapX[next] - 14
        return center(0)
      })
    } else {
      lapX = actualLaps.map((_, i) => PAD_L + ((i + 0.5) / actualLaps.length) * (W - PAD_L - PAD_R))
    }
  }

  const compByStep = new Map(comparisons.map((c) => [c.step_index, c]))
  const compByLap = new Map(comparisons.map((c) => [c.lap_index, c]))

  // ── Tip sous le graphe ───────────────────────────────────────────────────
  let tip
  if (kmView) {
    tip = 'Touche un km pour le détail'
    if (sel != null && kmLaps[sel]) {
      const lap = kmLaps[sel]
      const step = steps[stepForKm(sel + 1)]
      const target = step?.target_pace_sec
      const pace = lap.avg_pace_sec
      const hr = lap.avg_hr != null ? ` · FC ${lap.avg_hr}` : ''
      if (target == null || pace == null) {
        tip = pace != null ? `Km ${sel + 1} · réalisé ${formatPace(pace)}/km${hr}` : `Km ${sel + 1}`
      } else {
        const d = Math.round(pace - target)
        const st = kmStatus(pace, step)
        tip = `Km ${sel + 1} · cible ${formatPace(target)} · réalisé ${formatPace(pace)} (${d > 0 ? '+' : ''}${d}s) ${STATUS_WORD[st] ?? ''}${hr}`
      }
    }
  } else if (sel == null || !steps[sel]) {
    tip = synced ? 'Touche un lap pour le détail' : 'Touche un intervalle pour sa cible'
  } else {
    const s = steps[sel]
    const label = stepShortLabel(s)
    const tol = s.pace_tolerance_sec ?? 5
    if (!synced) {
      tip = s.target_pace_sec != null
        ? `${label} · cible ${formatPace(s.target_pace_sec)}/km ±${tol}s`
        : `${label} · allure libre`
    } else {
      const c = compByStep.get(sel)
      if (!c) {
        tip = `${label} · non réalisé`
      } else if (c.status === 'free') {
        tip = `${label} · réalisé ${formatPace(c.actual_pace)}/km (libre)`
      } else {
        const d = c.delta_sec ?? 0
        tip = `${label} · cible ${formatPace(c.planned_pace)} · réalisé ${formatPace(c.actual_pace)} (${d > 0 ? '+' : ''}${d}s) ${STATUS_WORD[c.status] ?? ''}`
      }
    }
  }

  // ── Labels de l'axe X (groupes condensés) ──────────────────────────────────
  const xLabels = groupSteps(steps).map((g) => {
    const gx = (xs[g.start].x0 + xs[g.end].x0 + xs[g.end].w) / 2
    if (g.kind === 'repeat') {
      const reps = g.steps.filter((s) => s.step_type === 'interval')
      const base = reps[0] ?? g.steps[0]
      return { x: gx, text: `${reps.length} × ${stepSizeLabel(base)}` }
    }
    const s = g.steps[0]
    if (s.step_type === 'warmup') return { x: gx, text: 'Éch.' }
    if (s.step_type === 'cooldown') return { x: gx, text: 'RAC' }
    return null
  }).filter(Boolean)

  return (
    <Box>
      {showKm && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.25, px: 0.5 }}>
          {[['step', 'Par step'], ['km', 'Par km']].map(([v, label]) => {
            const on = view === v
            return (
              <Box
                key={v}
                onClick={() => switchView(v)}
                sx={{
                  flex: 1, textAlign: 'center', py: 0.6, borderRadius: '10px', cursor: 'pointer',
                  fontSize: '0.72rem', fontWeight: 600, userSelect: 'none', border: '1px solid',
                  borderColor: on ? 'primary.main' : 'divider',
                  bgcolor: on ? 'rgba(29,158,117,0.12)' : 'transparent',
                  color: on ? 'primary.main' : 'text.secondary',
                  transition: 'all .15s',
                }}
              >
                {label}
              </Box>
            )
          })}
        </Box>
      )}
      <Box component="svg" viewBox={`0 0 ${activeW} ${H}`} sx={{ display: 'block', width: '100%', height: 'auto' }}>
        {/* Grille + axe Y */}
        {gridVals.map((p, i) => (
          <g key={i}>
            <line x1={PAD_L} y1={y(p)} x2={activeW - PAD_R} y2={y(p)} stroke={C.grid} strokeDasharray="3 4" />
            <text x={PAD_L - 5} y={y(p) + 3} fontSize="9" fill={C.axis} textAnchor="end">{formatPace(p)}</text>
          </g>
        ))}

        {!kmView && (<>
        {/* Bandes de tolérance / fonds neutres + lignes cibles */}
        {steps.map((s, i) => {
          const { x0, w } = xs[i]
          if (s.target_pace_sec != null) {
            const tol = s.pace_tolerance_sec ?? 5
            const top = y(s.target_pace_sec - tol)
            const bot = y(s.target_pace_sec + tol)
            return (
              <g key={i}>
                <rect x={x0} y={top} width={w} height={bot - top} fill={C.band} rx="2" />
                <line x1={x0} y1={y(s.target_pace_sec)} x2={x0 + w} y2={y(s.target_pace_sec)} stroke={C.target} strokeWidth="2" />
              </g>
            )
          }
          return (
            <g key={i}>
              <rect x={x0} y={PAD_T} width={w} height={PLOT_H} fill={C.neutral} />
              <line x1={x0} y1={PAD_T + PLOT_H / 2} x2={x0 + w} y2={PAD_T + PLOT_H / 2} stroke={C.grid} strokeWidth="1.5" strokeDasharray="4 4" />
            </g>
          )
        })}

        {/* Réalisé : ligne (laps matchés) + points */}
        {synced && (() => {
          const matched = actualLaps
            .map((l, i) => ({ l, i }))
            .filter(({ l }) => l.step_index != null && l.avg_pace_sec != null)
          const path = matched
            .map(({ l, i }, k) => `${k === 0 ? 'M' : 'L'}${lapX[i].toFixed(1)} ${y(l.avg_pace_sec).toFixed(1)}`)
            .join(' ')
          return (
            <g>
              {matched.length > 1 && <path d={path} fill="none" stroke={C.line} strokeWidth="1.5" />}
              {actualLaps.map((l, i) => {
                if (l.avg_pace_sec == null) return null
                const c = compByLap.get(i)
                const col = statusColor(c?.status)
                const unmatched = l.step_index == null
                return (
                  <circle
                    key={i}
                    cx={lapX[i]}
                    cy={y(l.avg_pace_sec)}
                    r="4.5"
                    fill={unmatched ? 'none' : col}
                    stroke={unmatched ? C.free : C.dot}
                    strokeWidth="1.5"
                    style={{ cursor: l.step_index != null ? 'pointer' : 'default' }}
                    onClick={() => l.step_index != null && setSel(l.step_index)}
                  />
                )
              })}
            </g>
          )
        })()}

        {/* Zones tapables par step (pleine hauteur → cible tactile haute) */}
        {steps.map((s, i) => {
          const { x0, w } = xs[i]
          return (
            <rect
              key={i}
              x={x0}
              y={PAD_T}
              width={w}
              height={PLOT_H}
              fill={sel === i ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent'}
              style={{ cursor: 'pointer' }}
              onClick={() => setSel(i)}
            />
          )
        })}

        {/* Labels axe X */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 6} fontSize="9" fill={C.axis} textAnchor="middle">{l.text}</text>
        ))}
        </>)}

        {kmView && (<>
          {/* Bandes cibles par km (step couvrant) */}
          {kmLaps.map((_, i) => {
            const { x0, w } = kmXs[i]
            const step = steps[stepForKm(i + 1)]
            if (step?.target_pace_sec != null) {
              const tol = step.pace_tolerance_sec ?? 5
              const top = y(step.target_pace_sec - tol)
              const bot = y(step.target_pace_sec + tol)
              return (
                <g key={i}>
                  <rect x={x0} y={top} width={w} height={bot - top} fill={C.band} rx="2" />
                  <line x1={x0} y1={y(step.target_pace_sec)} x2={x0 + w} y2={y(step.target_pace_sec)} stroke={C.target} strokeWidth="2" />
                </g>
              )
            }
            return <rect key={i} x={x0} y={PAD_T} width={w} height={PLOT_H} fill={C.neutral} />
          })}

          {/* Réalisé : ligne + point par km */}
          {(() => {
            const pts = kmLaps
              .map((l, i) => ({ l, i }))
              .filter(({ l }) => l.avg_pace_sec != null)
            const path = pts
              .map(({ l, i }, k) => `${k === 0 ? 'M' : 'L'}${kmCenter(i).toFixed(1)} ${y(l.avg_pace_sec).toFixed(1)}`)
              .join(' ')
            return (
              <g>
                {pts.length > 1 && <path d={path} fill="none" stroke={C.line} strokeWidth="1.5" />}
                {kmLaps.map((l, i) => {
                  if (l.avg_pace_sec == null) return null
                  const col = statusColor(kmStatus(l.avg_pace_sec, steps[stepForKm(i + 1)]))
                  return (
                    <circle
                      key={i}
                      cx={kmCenter(i)}
                      cy={y(l.avg_pace_sec)}
                      r="4.5"
                      fill={col}
                      stroke={C.dot}
                      strokeWidth="1.5"
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSel(i)}
                    />
                  )
                })}
              </g>
            )
          })()}

          {/* Zones tapables par km */}
          {kmLaps.map((_, i) => {
            const { x0, w } = kmXs[i]
            return (
              <rect
                key={i}
                x={x0}
                y={PAD_T}
                width={w}
                height={PLOT_H}
                fill={sel === i ? (dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent'}
                style={{ cursor: 'pointer' }}
                onClick={() => setSel(i)}
              />
            )
          })}

          {/* Labels axe X (numéro de km, clairsemés si > 8) */}
          {kmLaps.map((_, i) => {
            if (kmLaps.length > 8 && i % 2 !== 0) return null
            return (
              <text key={i} x={kmCenter(i)} y={H - 6} fontSize="9" fill={C.axis} textAnchor="middle">{i + 1}</text>
            )
          })}
        </>)}
      </Box>

      <Typography sx={{
        fontSize: '0.7rem', color: 'text.secondary', textAlign: 'center',
        mt: 1, minHeight: 20, fontVariantNumeric: 'tabular-nums',
      }}>
        {tip}
      </Typography>
    </Box>
  )
}

export default PaceChart
