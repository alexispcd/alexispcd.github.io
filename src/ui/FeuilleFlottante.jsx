import { useEffect } from 'react'
import { Box, ButtonBase, Modal, Slide, Typography } from '@mui/material'
import { SPACE_BAS, border, radius, size, space, textStyles } from '../styles/tokens'
import { DURATION } from '../styles/motion'
import { appuiLigne, focusContourInterieur } from './appui'
import { useReduireAnimations } from './useReduireAnimations'
import { fermerFeuille, ouvrirFeuille } from '../lib/barreEtat'

const bloc = {
  bgcolor: 'surface',
  borderRadius: radius.card,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const ligne = {
  ...textStyles.bouton,
  width: '100%',
  minHeight: size.ligne,
  px: space[16],
  justifyContent: 'center',
  textAlign: 'center',
  color: 'ink',
  ...appuiLigne,
  ...focusContourInterieur,
}

/**
 * Feuille d'actions ou de choix posée en bas de l'écran, sur la page voilée.
 * - ouverte, onFermer : toucher le voile ou le second bloc appelle onFermer.
 * - titre : en muted, 13 px, centré ; pour une confirmation, la phrase qui explique.
 * - lignes : [{ libelle, onClick, disabled, sansFermer }] ; toucher une ligne appelle
 *   onFermer puis onClick tout de suite, sans attendre la fin de l'animation. Avec
 *   sansFermer, seulement onClick : c'est lui qui ferme la feuille (player Renfo).
 * Une action réseau lancée par une ligne passe par useAction : la feuille se ferme
 * et la BarreAttente place="carte" se montre en tête de la page.
 * - fermerLibelle : « Fermer » par défaut, « Annuler » ou « Rester » pour une confirmation.
 * - children : contenu libre en haut du premier bloc (usages fiche, réglage et date).
 * - libelleAria : nom de la feuille pour le lecteur d'écran quand elle n'a pas de
 *   `titre` (usage Date : le titre est dans children) ; sinon le titre la nomme.
 * Le premier bloc défile s'il dépasse l'écran, le second reste visible. Aucune
 * couleur, même pour une action qui défait : sa place en dernier suffit.
 */
const FeuilleFlottante = ({
  ouverte,
  onFermer,
  titre,
  lignes = [],
  fermerLibelle = 'Fermer',
  libelleAria,
  children,
}) => {
  const reduire = useReduireAnimations()
  const durees = reduire ? 0 : { enter: DURATION.open, exit: DURATION.close }

  // Bande de la barre d'état (src/lib/barreEtat.js) : posée à l'ouverture, retirée à la fermeture.
  useEffect(() => {
    if (!ouverte) return undefined
    ouvrirFeuille()
    return fermerFeuille
  }, [ouverte])

  const toucher = (l) => {
    if (!l.sansFermer) onFermer?.()
    l.onClick?.()
  }

  const enTete = Boolean(titre || children)

  return (
    <Modal
      open={Boolean(ouverte)}
      onClose={() => onFermer?.()}
      slotProps={{ backdrop: { transitionDuration: durees } }}
    >
      <Slide direction="up" in={Boolean(ouverte)} timeout={durees}>
        <Box
          role="dialog"
          aria-modal="true"
          aria-label={libelleAria || titre || undefined}
          tabIndex={-1}
          sx={{
            position: 'absolute',
            left: space[12],
            right: space[12],
            bottom: SPACE_BAS,
            // S'arrête à 60 px du haut de la page, sous la bande de la barre d'état
            // (src/lib/barreEtat.js, 8 px).
            maxHeight: `calc(100% - ${SPACE_BAS} - env(safe-area-inset-top, 0px) - ${size.cible} - ${space[16]})`,
            display: 'flex',
            flexDirection: 'column',
            gap: space[8],
            outline: 'none',
          }}
        >
          <Box sx={{ ...bloc, flex: '0 1 auto', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'none' }}>
            {titre && (
              <Typography variant="secondaire" sx={{ color: 'muted', textAlign: 'center', py: space[14], px: space[16] }}>
                {titre}
              </Typography>
            )}
            {children}
            {lignes.map((l, i) => (
              <ButtonBase
                key={`${i}-${l.libelle}`}
                disabled={l.disabled}
                onClick={() => toucher(l)}
                sx={{
                  ...ligne,
                  flexShrink: 0,
                  color: l.disabled ? 'muted' : 'ink',
                  borderTop: i > 0 || enTete ? `${border.filet} solid` : 'none',
                  borderColor: 'line',
                }}
              >
                {l.libelle}
              </ButtonBase>
            ))}
          </Box>
          <Box sx={{ ...bloc, flexShrink: 0 }}>
            <ButtonBase onClick={() => onFermer?.()} sx={{ ...ligne, fontWeight: 700 }}>
              {fermerLibelle}
            </ButtonBase>
          </Box>
        </Box>
      </Slide>
    </Modal>
  )
}

export default FeuilleFlottante
