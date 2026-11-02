import { useEffect, useLayoutEffect, useRef } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import { radius, size, space } from '../styles/tokens'
import { DURATION, transition } from '../styles/motion'
import { useReduireAnimations } from './useReduireAnimations'
import Carte from './Carte'

// Avancement en % au temps t (ms) : vers 90 % en ralentissant, sans jamais l'atteindre.
const avancement = (t, duree) => 90 * (1 - Math.exp(-Math.max(0, t) / (0.6 * duree)))

const LARGEUR_PAGE = '160px'

/**
 * Attente commune à toute l'app : une barre fine qui avance une fois vers 90 % au
 * rythme de la durée habituelle (`duree`, ms, voir src/lib/durees.js), finit à
 * 100 % en 220 ms quand `fini` passe à vrai, s'efface en 150 ms, puis appelle
 * `onFin`. Jamais de boucle. Props de visibilité : voir useFinAttente.
 * - place : 'page' (160 px au centre, sans phrase visible), 'carte' (carte en tête
 *   de page, `phrase` en corps-fort, `detail` en secondaire ; s'ouvre et se replie
 *   en hauteur), 'barre' (52 px, `phrase` au-dessus de la barre : barre du bas ou
 *   place d'un bouton), 'section' (la barre seule).
 * - depart : instant de départ facultatif (horloge de performance.now()), pour
 *   qu'une barre remontée continue au lieu de repartir de zéro.
 * Réduire les animations : plus de barre, « Chargement » au centre d'une page, la
 * phrase seule ailleurs, et onFin sans délai.
 */
const BarreAttente = ({
  place = 'section',
  phrase,
  detail,
  duree = 1200,
  visible = false,
  fini = false,
  onFin,
  depart,
  sx,
}) => {
  const reduire = useReduireAnimations()
  const pisteRef = useRef(null)
  const remplissageRef = useRef(null)
  const onFinRef = useRef(onFin)
  const actif = visible && !reduire

  useEffect(() => {
    onFinRef.current = onFin
  })

  // Avance : largeur écrite à chaque image sur le remplissage, sans re-rendu.
  useLayoutEffect(() => {
    if (!actif || fini) return undefined
    const piste = pisteRef.current
    const remplissage = remplissageRef.current
    if (!piste || !remplissage) return undefined
    const t0 = depart ?? performance.now()
    piste.style.transition = 'none'
    piste.style.opacity = '1'
    remplissage.style.transition = 'none'
    let image
    const avancer = () => {
      remplissage.style.width = `${avancement(performance.now() - t0, duree)}%`
      image = requestAnimationFrame(avancer)
    }
    avancer()
    return () => cancelAnimationFrame(image)
  }, [actif, fini, duree, depart])

  // Fin : 100 % en 220 ms, effacement en 150 ms, puis onFin. Minuteurs plutôt que
  // transitionend, qui ne part pas si rien ne bouge.
  useEffect(() => {
    if (!visible || !fini) return undefined
    if (reduire) {
      onFinRef.current?.()
      return undefined
    }
    const piste = pisteRef.current
    const remplissage = remplissageRef.current
    let effacement
    if (remplissage) {
      remplissage.style.transition = transition('width', DURATION.open)
      remplissage.style.width = '100%'
    }
    const fin = setTimeout(() => {
      if (piste) {
        piste.style.transition = transition('opacity', DURATION.fade)
        piste.style.opacity = '0'
      }
      effacement = setTimeout(() => onFinRef.current?.(), DURATION.fade)
    }, DURATION.open)
    return () => {
      clearTimeout(fin)
      clearTimeout(effacement)
    }
  }, [visible, fini, reduire])

  const libelle = phrase ?? 'Chargement'

  const piste = (largeur = '100%') => (
    <Box
      ref={pisteRef}
      role="progressbar"
      aria-label={libelle}
      sx={{
        width: largeur,
        height: '6px',
        flexShrink: 0,
        borderRadius: radius.pill,
        bgcolor: 'track',
        overflow: 'hidden',
      }}
    >
      <Box ref={remplissageRef} sx={{ height: '100%', width: 0, borderRadius: radius.pill, bgcolor: 'ink' }} />
    </Box>
  )

  if (place === 'carte') {
    return (
      <Collapse
        in={visible}
        appear
        unmountOnExit
        timeout={reduire ? 0 : { enter: DURATION.open, exit: DURATION.close }}
        sx={sx}
      >
        <Carte sx={{ gap: space[12] }} role={reduire ? 'status' : undefined}>
          {(phrase || detail) && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
              {phrase && <Typography variant="corps-fort">{phrase}</Typography>}
              {detail && <Typography variant="secondaire" sx={{ color: 'muted' }}>{detail}</Typography>}
            </Box>
          )}
          {!reduire && piste()}
        </Carte>
      </Collapse>
    )
  }

  if (!visible) return null

  if (place === 'page') {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', ...sx }}>
        {reduire
          ? <Typography variant="secondaire" role="status" sx={{ color: 'muted' }}>Chargement</Typography>
          : piste(LARGEUR_PAGE)}
      </Box>
    )
  }

  if (place === 'barre') {
    return (
      <Box sx={{ height: size.ligne, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: space[12], ...sx }}>
        {phrase && (
          <Typography variant="secondaire" role={reduire ? 'status' : undefined} sx={{ color: 'muted', textAlign: 'center' }}>
            {phrase}
          </Typography>
        )}
        {!reduire && piste()}
      </Box>
    )
  }

  // section : la barre seule.
  if (reduire) {
    return phrase
      ? <Typography variant="secondaire" role="status" sx={{ color: 'muted', ...sx }}>{phrase}</Typography>
      : null
  }
  return <Box sx={sx}>{piste()}</Box>
}

export default BarreAttente
