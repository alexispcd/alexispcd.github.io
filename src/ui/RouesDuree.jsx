import { useCallback, useEffect, useRef } from 'react'
import { Box, Typography } from '@mui/material'
import { border, radius, space, textStyles } from '../styles/tokens'

// Roues sur le défilement natif avec arrêt au centre (scroll-snap) : inertie d'iOS,
// aucune animation ajoutée. La valeur retenue est celle qui s'immobilise sur la bande.

const HAUTEUR_VALEUR = 38
const VISIBLES = 5
const MARGE = HAUTEUR_VALEUR * Math.floor(VISIBLES / 2) // centre les valeurs extrêmes
const DELAI_ARRET = 110 // ms sans défilement avant de retenir la valeur

const suite = (max) => Array.from({ length: max + 1 }, (_, i) => i)
const HEURES = suite(9)
const SOIXANTE = suite(59)

const deux = (n) => String(n).padStart(2, '0')

/** 2645 → "44:05", 5340 → "1:29:00". */
const texteDuree = (h, m, s) => (h > 0 ? `${h}:${deux(m)}:${deux(s)}` : `${m}:${deux(s)}`)

const Roue = ({ valeurs, valeur, onChange, nom, unite, uniteLongue }) => {
  const ref = useRef(null)
  const minuterie = useRef(null)
  const parCode = useRef(false)
  const index = Math.max(0, valeurs.indexOf(valeur))

  // Aligne la roue quand la valeur change sans défilement (toucher, clavier, prop).
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const cible = index * HAUTEUR_VALEUR
    if (Math.abs(el.scrollTop - cible) < 1) return
    parCode.current = true
    el.scrollTop = cible
    requestAnimationFrame(() => { parCode.current = false })
  }, [index])

  useEffect(() => () => clearTimeout(minuterie.current), [])

  const choisir = useCallback((v) => {
    clearTimeout(minuterie.current)
    if (v !== valeur) onChange(v)
  }, [valeur, onChange])

  const surDefilement = () => {
    if (parCode.current) return
    clearTimeout(minuterie.current)
    minuterie.current = setTimeout(() => {
      const el = ref.current
      if (!el) return
      const i = Math.max(0, Math.min(valeurs.length - 1, Math.round(el.scrollTop / HAUTEUR_VALEUR)))
      if (valeurs[i] !== valeur) onChange(valeurs[i])
    }, DELAI_ARRET)
  }

  const surTouche = (e) => {
    const pas = { ArrowUp: 1, ArrowDown: -1 }[e.key]
    if (!pas) return
    e.preventDefault()
    const i = Math.max(0, Math.min(valeurs.length - 1, index + pas))
    choisir(valeurs[i])
  }

  return (
    <Box sx={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
      <Box
        ref={ref}
        role="spinbutton"
        tabIndex={0}
        aria-label={nom}
        aria-valuemin={valeurs[0]}
        aria-valuemax={valeurs.at(-1)}
        aria-valuenow={valeur}
        aria-valuetext={`${valeur} ${uniteLongue}`}
        onScroll={surDefilement}
        onKeyDown={surTouche}
        sx={{
          height: HAUTEUR_VALEUR * VISIBLES,
          overflowY: 'scroll',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          py: `${MARGE}px`,
          outline: 'none',
          borderRadius: radius.inner,
          '&:focus-visible': { outline: `${border.contour} solid var(--ink)`, outlineOffset: `-${border.contour}` },
        }}
      >
        {valeurs.map((n) => {
          const choisie = n === valeur
          return (
            <Box
              key={n}
              aria-hidden
              onClick={() => choisir(n)}
              sx={{
                height: HAUTEUR_VALEUR,
                scrollSnapAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'default',
                WebkitTapHighlightColor: 'transparent',
                userSelect: 'none',
              }}
            >
              <Typography
                component="span"
                sx={choisie
                  ? { ...textStyles.chiffre, fontVariantNumeric: 'tabular-nums', color: 'ink' }
                  : { ...textStyles['titre-barre'], fontVariantNumeric: 'tabular-nums', color: 'muted' }}
              >
                {deux(n)}
              </Typography>
            </Box>
          )
        })}
      </Box>
      <Typography
        component="span"
        aria-hidden
        sx={{
          ...textStyles.legende,
          fontWeight: 600,
          color: 'muted',
          position: 'absolute',
          right: space[8],
          top: `${MARGE}px`,
          height: HAUTEUR_VALEUR,
          display: 'flex',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        {unite}
      </Typography>
    </Box>
  )
}

/**
 * Sélecteur de durée à roues : heures (0 à 9), minutes et secondes (0 à 59), sans boucle.
 * - secondes : la durée ; onChange(secondes) quand une roue s'arrête ou qu'une valeur
 *   visible est touchée.
 * - sansCarte : dans une FeuilleFlottante, le bloc de la feuille tient lieu de carte
 *   (mêmes marges, même bande).
 * - libelle : nom de l'ensemble, annoncé avec la durée (« Temps visé : 44:05 »).
 * Plat : ni voile ni dégradé, les valeurs s'arrêtent au bord.
 */
const RouesDuree = ({ secondes, onChange, sansCarte = false, libelle = 'Temps visé', sx }) => {
  const v = Number.isFinite(secondes) ? Math.max(0, secondes) : 0
  const h = Math.min(9, Math.floor(v / 3600))
  const m = Math.floor((v % 3600) / 60)
  const s = Math.floor(v % 60)
  const regler = (nh, nm, ns) => onChange?.(nh * 3600 + nm * 60 + ns)

  return (
    <Box
      role="group"
      aria-label={`${libelle} : ${texteDuree(h, m, s)}`}
      sx={{
        position: 'relative',
        p: space[14],
        overflow: 'hidden',
        ...(sansCarte ? {} : { bgcolor: 'surface', borderRadius: radius.card }),
        ...sx,
      }}
    >
      {/* Bande de sélection : à 14 px des bords, radius-inner (24 = 14 + 10). */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute',
          left: space[14],
          right: space[14],
          top: `calc(${space[14]} + ${MARGE}px)`,
          height: HAUTEUR_VALEUR,
          borderRadius: radius.inner,
          bgcolor: 'chip',
          pointerEvents: 'none',
        }}
      />
      <Box sx={{ display: 'flex', position: 'relative' }}>
        <Roue valeurs={HEURES} valeur={h} onChange={(x) => regler(x, m, s)} nom="Heures" unite="h" uniteLongue="heures" />
        <Roue valeurs={SOIXANTE} valeur={m} onChange={(x) => regler(h, x, s)} nom="Minutes" unite="min" uniteLongue="minutes" />
        <Roue valeurs={SOIXANTE} valeur={s} onChange={(x) => regler(h, m, x)} nom="Secondes" unite="s" uniteLongue="secondes" />
      </Box>
    </Box>
  )
}

export default RouesDuree
