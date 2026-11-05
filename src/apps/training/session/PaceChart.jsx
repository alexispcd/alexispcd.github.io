import { useState } from 'react'
import { Box, Typography } from '@mui/material'
import { opacity, radius, space, border } from '../../../styles/tokens'
import Carte from '../../../ui/Carte'
import ControleSegmente from '../../../ui/ControleSegmente'
import { GRAPHE, etapesGraphe, etapesKm, graphe, ligneKm, zoneSeance } from './vueSeance'

const TEXTE_AXE = {
  fill: 'var(--muted)',
  fontSize: '11px',
  fontFamily: 'inherit',
  fontVariantNumeric: 'tabular-nums',
}

const VUES = [{ valeur: 'etape', libelle: 'Par étape' }, { valeur: 'km', libelle: 'Par km' }]

/**
 * Carte « Allure » de la page séance : graphe d'allure par étape, ou par km pour une
 * séance faite avec km_laps. Bande et trait cible par étape (couleur de l'intensité
 * pour l'effort, track et muted pour l'échauffement et le retour au calme), réalisé
 * en trait ink de 2 px. Toucher : rien par étape ; par km, chaque km a sa zone sur
 * toute la hauteur et sa ligne sous le graphe. Rien à tracer : pas de carte.
 */
const PaceChart = ({ session }) => {
  const [vue, setVue] = useState('etape')
  const [sel, setSel] = useState(null)

  const kmDispo = session.status === 'done' && (session.km_laps?.length ?? 0) > 0
  const parKm = kmDispo && vue === 'km'
  const etapes = parKm ? etapesKm(session) : etapesGraphe(session)
  const g = graphe(etapes)
  if (g.vide) return null

  const zone = zoneSeance(session.type)
  const changerVue = (v) => {
    if (v === vue) return
    setSel(null)
    setVue(v)
  }

  return (
    <Carte sx={{ gap: space[12] }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[8], minHeight: '52px' }}>
        <Typography variant="etiquette" component="h2" sx={{ color: 'muted' }}>Allure</Typography>
        {kmDispo && (
          <ControleSegmente
            options={VUES}
            valeur={vue}
            onChange={changerVue}
            label="Affichage du graphe"
            sx={{ width: '200px', flexShrink: 0 }}
          />
        )}
      </Box>

      <Box
        component="svg"
        viewBox={`0 0 ${GRAPHE.largeur} ${GRAPHE.hauteur}`}
        role="img"
        aria-label={parKm ? "Graphe d'allure par km" : "Graphe d'allure de la séance"}
        sx={{ display: 'block', width: '100%', height: 'auto', overflow: 'visible' }}
      >
        {g.grille.map((l) => (
          <g key={l.libelle}>
            <line x1={GRAPHE.x0} x2={GRAPHE.x1} y1={l.y} y2={l.y} style={{ stroke: 'var(--line)', strokeWidth: 1 }} />
            <text x={0} y={l.y + 4} style={TEXTE_AXE}>{l.libelle}</text>
          </g>
        ))}

        {parKm && sel != null && g.zones[sel] && (
          <rect
            x={g.zones[sel].x}
            y={GRAPHE.y0}
            width={g.zones[sel].w}
            height={GRAPHE.y1 - GRAPHE.y0}
            style={{ fill: 'var(--ink)', fillOpacity: opacity.ligne }}
          />
        )}

        {g.bandes.map((b, i) => {
          const effort = b.genre === 'effort'
          return (
            <g key={i}>
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={2}
                style={{ fill: effort ? `var(--zone-${zone}-tint)` : 'var(--track)' }}
              />
              <line
                x1={b.x}
                x2={b.x2}
                y1={b.cy}
                y2={b.cy}
                style={{ stroke: effort ? `var(--zone-${zone})` : 'var(--muted)', strokeWidth: 1.5 }}
              />
            </g>
          )
        })}

        {g.reel.map((points, i) => (
          <polyline
            key={i}
            points={points}
            style={{ fill: 'none', stroke: 'var(--ink)', strokeWidth: 2, strokeLinejoin: 'round' }}
          />
        ))}

        {g.graduations.map((t) => (
          <text key={`${t.libelle}-${t.x}`} x={t.x} y={GRAPHE.hauteur - 4} textAnchor={t.ancre} style={TEXTE_AXE}>
            {t.libelle}
          </text>
        ))}

        {parKm && g.zones.map((z, i) => (
          <rect
            key={i}
            x={z.x}
            y={0}
            width={z.w}
            height={GRAPHE.y1 + 4}
            onClick={() => setSel(i)}
            style={{ fill: 'transparent', cursor: 'pointer' }}
          />
        ))}
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: space[12] }}>
        <Legende>
          <Box sx={{ width: '14px', height: '8px', borderRadius: radius.segment, bgcolor: 'track', borderTop: `${border.contour} solid`, borderColor: 'muted', boxSizing: 'border-box' }} />
          Cible
        </Legende>
        {g.reel.length > 0 && (
          <Legende>
            <Box sx={{ width: '14px', height: border.contour, bgcolor: 'ink' }} />
            Réalisé
          </Legende>
        )}
      </Box>

      {parKm && (
        <Typography variant="secondaire" aria-live="polite" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
          {sel == null ? 'Touche un km pour le lire.' : ligneKm(etapes[sel], sel)}
        </Typography>
      )}
    </Carte>
  )
}

const Legende = ({ children }) => (
  <Typography variant="legende" component="span" sx={{ display: 'flex', alignItems: 'center', gap: space[4], color: 'muted' }}>
    {children}
  </Typography>
)

export default PaceChart
