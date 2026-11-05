import { useRef } from 'react'
import { motion, useMotionValue, useTransform, MotionConfig } from 'framer-motion'
import { Box, ButtonBase, Typography } from '@mui/material'
import Carte from './Carte'
import { radius, space, textStyles } from '../styles/tokens'
import { DURATION } from '../styles/motion'
import { appuiLigne, focusContourInterieur } from './appui'
import { useReduireAnimations } from './useReduireAnimations'
import { Montre } from './Icones'

// Il faut dépasser ce déplacement horizontal du doigt pour qu'un glisser compte ; en
// deçà, la ligne revient en place.
const SEUIL_GLISSER = 80

const COLONNES = 'minmax(0, 1fr) 72px 76px 20px'

const MARQUEUR = { A: 'var(--zone-facile)', B: 'var(--zone-qualite)', C: 'var(--zone-longue)' }

// Retour en place au relâchement : 180 ms, courbe du Design System, sans dépassement.
// Framer lit la durée en secondes ; « Réduire les animations » pose la ligne d'un coup.
const RETOUR = { type: 'tween', duration: DURATION.close / 1000, ease: [0.32, 0.72, 0, 1] }
const RETOUR_IMMEDIAT = { type: false }

const etiquette = { ...textStyles.etiquette, textTransform: 'uppercase', color: 'muted' }
const principal = { ...textStyles.corps, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
const second = { ...textStyles.legende, color: 'muted', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }

/** Ligne du tableau : taper ouvre, glisser à droite saute, à gauche envoie (ou ouvre). */
const Ligne = ({ ligne, derniere, glisser, onOuvrir, onSauter, onEnvoyer }) => {
  const reduire = useReduireAnimations()
  const x = useMotionValue(0)
  // Libellés révélés sous la ligne, pilotés par le déplacement réel.
  const opaciteSauter = useTransform(x, [8, 60], [0, 1])
  const opaciteGauche = useTransform(x, [-60, -8], [1, 0])
  const glisse = useRef(false)

  const envoyable = ligne.peutEnvoyer && !ligne.montre
  const actionGauche = envoyable ? 'Envoyer' : 'Ouvrir'

  const finGlisser = (_e, info) => {
    const dx = info.offset.x
    if (dx > SEUIL_GLISSER && ligne.peutSauter) onSauter(ligne.id)
    else if (dx < -SEUIL_GLISSER) (envoyable ? onEnvoyer : onOuvrir)(ligne.id)
    // Un tick avant de rouvrir le toucher, pour ne pas enchaîner glisser puis toucher.
    requestAnimationFrame(() => { glisse.current = false })
  }

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden', borderBottom: derniere ? 'none' : '1px solid', borderColor: 'line' }}>
      <Box aria-hidden sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: space[4] }}>
        {glisser && ligne.peutSauter && (
          <Typography component={motion.span} style={{ opacity: opaciteSauter }} sx={{ ...textStyles.secondaire, fontWeight: 600, color: 'muted' }}>
            Sauter
          </Typography>
        )}
        {glisser && <Typography component={motion.span} style={{ opacity: opaciteGauche }} sx={{ ...textStyles.secondaire, fontWeight: 600, color: 'muted', ml: 'auto' }}>
          {actionGauche}
        </Typography>}
      </Box>

      <ButtonBase
        component={motion.div}
        drag={glisser ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        dragSnapToOrigin
        dragTransition={reduire ? RETOUR_IMMEDIAT : RETOUR}
        style={{ x }}
        onDragStart={() => { glisse.current = true }}
        onDragEnd={finGlisser}
        onTap={() => { if (!glisse.current) onOuvrir(ligne.id) }}
        sx={{
          position: 'relative', width: '100%',
          display: 'grid', gridTemplateColumns: COLONNES, gap: space[8], alignItems: 'center',
          py: space[12], textAlign: 'left', color: 'ink', bgcolor: 'surface',
          userSelect: 'none', touchAction: 'pan-y',
          // La ligne suit le doigt par transform : aucune transition dessus (celle du
          // thème, avec le retour en place, retarderait le glisser). L'agrandissement à
          // l'appui ne touche jamais une ligne (appuiLigne).
          transition: 'none',
          ...appuiLigne,
          ...focusContourInterieur,
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: space[8], minWidth: 0 }}>
            <Box component="span" sx={{ width: 8, height: 8, borderRadius: radius.segment, flexShrink: 0, bgcolor: MARQUEUR[ligne.intensite] ?? MARQUEUR.A }} />
            <Typography component="span" noWrap sx={{ ...textStyles.corps, fontWeight: 600, minWidth: 0 }}>{ligne.titre}</Typography>
          </Box>
          <Typography component="span" sx={{ ...textStyles.legende, color: 'muted' }}>{ligne.sousLigne}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Typography component="span" sx={principal}>{ligne.prevu}</Typography>
          {ligne.prevuAllure && <Typography component="span" sx={second}>{ligne.prevuAllure}</Typography>}
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <Typography component="span" sx={principal}>{ligne.realise}</Typography>
          {ligne.realiseAllure && <Typography component="span" sx={second}>{ligne.realiseAllure}</Typography>}
        </Box>
        {ligne.montre
          ? <Montre taille={16} titre="Sur la montre" />
          : <Typography component="span" aria-label="Pas encore sur la montre" sx={{ ...textStyles.secondaire, color: 'muted' }}>-</Typography>}
      </ButtonBase>
    </Box>
  )
}

/**
 * TableauSeances : séances de la semaine sélectionnée, prévu, réalisé, montre.
 * - lignes : [{ id, intensite, titre, sousLigne, prevu, prevuAllure, realise,
 *   realiseAllure, montre, peutSauter, peutEnvoyer }].
 * - onOuvrir(id), onSauter(id), onEnvoyer(id).
 * - glisser : false pour des lignes qu'on ne fait que toucher (plan passé).
 * Gestes : taper ouvre ; glisser à droite saute (si peutSauter) ; glisser à gauche
 * envoie sur la montre (séance envoyable pas encore envoyée), sinon ouvre.
 * Framer Motion sous MotionConfig reducedMotion="user".
 */
const TableauSeances = ({ lignes, glisser = true, onOuvrir, onSauter, onEnvoyer, sx }) => (
  <MotionConfig reducedMotion="user">
    <Carte sx={{ py: space[4], flexShrink: 0, ...sx }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: COLONNES, gap: space[8], py: space[8], borderBottom: '1px solid', borderColor: 'line' }}>
        <Typography component="span" sx={etiquette}>Séance</Typography>
        <Typography component="span" sx={etiquette}>Prévu</Typography>
        <Typography component="span" sx={etiquette}>Réalisé</Typography>
        <span />
      </Box>
      {lignes.map((l, i) => (
        <Ligne
          key={l.id}
          ligne={l}
          derniere={i === lignes.length - 1}
          glisser={glisser}
          onOuvrir={onOuvrir}
          onSauter={onSauter}
          onEnvoyer={onEnvoyer}
        />
      ))}
    </Carte>
  </MotionConfig>
)

export default TableauSeances
