import { Box, ButtonBase, Typography } from '@mui/material'
import { avecRetour, DURATION, transition } from '../../../styles/motion'
import { border, radius, size, space, textStyles } from '../../../styles/tokens'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import LigneSaisie from '../../../ui/LigneSaisie'
import { focusContour, sansMouvement } from '../../../ui/appui'
import { BAND_PALETTE } from '../bandColor'

const couleurSx = (hex, choisie) => ({
  height: size.cible,
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: radius.pill,
  bgcolor: hex,
  border: choisie ? `${border.selection} solid` : `${border.filet} solid`,
  borderColor: choisie ? 'ink' : 'line',
  transition: avecRetour(transition('border-color', DURATION.fade)),
  ...sansMouvement(),
  ...focusContour,
})

/**
 * Réglage d'un élastique (FeuilleFlottante, usage réglage élastique) : « Résistance »
 * en kg et la palette, ligne « Enregistrer », second bloc « Annuler ». Rien n'est
 * écrit en base : la page ne change que son brouillon.
 * - titre : « Ajouter un élastique » ou « Modifier l'élastique ».
 * - valeur ({ kgTexte, color }) et onChange : saisie tenue par le parent.
 * - pris : poids déjà pris dans le brouillon ; valide : « Enregistrer » possible.
 * - onEnregistrer : appelé seul, le parent ferme la feuille ; onAnnuler : « Annuler » et le voile.
 */
const FeuilleElastique = ({ ouverte, titre, valeur, onChange, pris, valide, onEnregistrer, onAnnuler }) => (
  <FeuilleFlottante
    ouverte={ouverte && Boolean(valeur)}
    onFermer={onAnnuler}
    libelleAria={titre}
    fermerLibelle="Annuler"
    lignes={[{ libelle: 'Enregistrer', onClick: onEnregistrer, disabled: !valide, sansFermer: true }]}
  >
    {valeur && (
      <Box sx={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
        <Typography component="h2" sx={{ ...textStyles['titre-barre'], fontWeight: 700, px: space[16], pt: space[16], pb: space[8] }}>
          {titre}
        </Typography>
        <LigneSaisie
          type="nombre"
          libelle="Résistance"
          sousLigne={pris ? 'Tu as déjà un élastique de ce poids.' : undefined}
          valeur={valeur.kgTexte}
          onChange={(kgTexte) => onChange({ ...valeur, kgTexte })}
          placeholder="kg"
          sx={{ borderTop: `${border.filet} solid`, borderColor: 'line' }}
        />
        <Typography variant="etiquette" component="h3" sx={{ color: 'muted', px: space[16], py: space[8] }}>Couleur</Typography>
        <Box
          role="group"
          aria-label="Couleur"
          sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: space[12], px: space[16], pb: space[16] }}
        >
          {BAND_PALETTE.map((p) => {
            const choisie = valeur.color?.toUpperCase() === p.hex.toUpperCase()
            return (
              <ButtonBase
                key={p.hex}
                aria-label={p.name}
                aria-pressed={choisie}
                onClick={() => onChange({ ...valeur, color: p.hex })}
                sx={couleurSx(p.hex, choisie)}
              />
            )
          })}
        </Box>
      </Box>
    )}
  </FeuilleFlottante>
)

export default FeuilleElastique
