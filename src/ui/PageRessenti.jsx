import { useId } from 'react'
import { Box, InputBase, Typography } from '@mui/material'
import { HEADER_HEIGHT } from '../components/AppHeader'
import { radius, space, textStyles } from '../styles/tokens'
import { PAIN_CHIPS, toFeedbackPayload } from '../lib/feedback'
import BarreEffort from './BarreEffort'
import PastilleACocher from './PastilleACocher'
import BarreAttente from './BarreAttente'
import BarreBas from './BarreBas'
import Bouton from './Bouton'

const Etiquette = ({ children }) => (
  <Typography variant="etiquette" component="h2" sx={{ color: 'muted', px: space[4] }}>{children}</Typography>
)

/**
 * Page « Valider la séance », commune à Training et Renfo : contexte, activité
 * (facultative), effort, douleurs et commentaire, puis la barre du bas « Passer » et
 * « Valider ».
 * - contexte : texte en secondaire en tête de page.
 * - activite : bloc facultatif posé sous le contexte (Training : BlocActivite).
 * - valeur, onChange : ressenti au format de emptyFeedback ({ rpe, painAreas, note }).
 * - onValider(payload | null) : « Passer » donne null, « Valider » toFeedbackPayload(valeur).
 * - action : le useAction de la validation ; pendant l'attente, sa BarreAttente
 *   remplace les boutons et le contenu ne réagit plus au toucher.
 * - boutonsDesactives, phraseBarre : boutons désactivés et leur raison, portée par la barre.
 * À poser comme page d'une route, sous la barre du haut.
 */
const PageRessenti = ({
  contexte,
  activite,
  valeur,
  onChange,
  onValider,
  action,
  phraseBarre,
  boutonsDesactives = false,
}) => {
  const raisonId = useId()
  const attente = Boolean(action?.barre?.visible)
  const { rpe, painAreas, note } = valeur
  const changer = (patch) => onChange({ ...valeur, ...patch })

  const toucherDouleur = (code) => changer({
    painAreas: painAreas.includes(code) ? painAreas.filter((c) => c !== code) : [...painAreas, code],
  })

  const raison = boutonsDesactives && !attente ? phraseBarre : null

  return (
    <Box
      sx={{
        height: '100%',
        overflowY: 'auto',
        overscrollBehavior: 'none',
        pt: `${HEADER_HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        aria-busy={attente || undefined}
        sx={{
          flex: '1 0 auto',
          width: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          gap: space[16],
          px: space[16],
          pt: space[8],
          pb: space[24],
          pointerEvents: attente ? 'none' : undefined,
        }}
      >
        {contexte && (
          <Typography variant="secondaire" sx={{ color: 'muted', px: space[4] }}>{contexte}</Typography>
        )}

        {activite}

        <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
          <Etiquette>Effort</Etiquette>
          <BarreEffort note={rpe} onChange={(n) => changer({ rpe: n })} />
        </Box>

        <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
          <Etiquette>Douleurs</Etiquette>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: space[8] }}>
            {PAIN_CHIPS.map((chip) => (
              <PastilleACocher
                key={chip.code}
                choisie={painAreas.includes(chip.code)}
                onClick={() => toucherDouleur(chip.code)}
              >
                {chip.label}
              </PastilleACocher>
            ))}
          </Box>
        </Box>

        <Box component="section" sx={{ display: 'flex', flexDirection: 'column', gap: space[8] }}>
          <Etiquette>Commentaire</Etiquette>
          <InputBase
            value={note}
            onChange={(e) => changer({ note: e.target.value })}
            placeholder="Un commentaire ?"
            multiline
            minRows={2}
            inputProps={{ 'aria-label': 'Commentaire' }}
            sx={{
              ...textStyles.corps,
              // 16 px au moins : en dessous, Safari zoome à l'entrée dans le champ.
              fontSize: '16px',
              minHeight: '64px',
              alignItems: 'flex-start',
              bgcolor: 'chip',
              color: 'ink',
              borderRadius: radius.inner,
              p: space[12],
              '& textarea::placeholder': { color: 'var(--muted)', opacity: 1 },
            }}
          />
        </Box>
      </Box>

      <BarreBas phrase={raison} phraseId={raisonId}>
        {attente
          ? <BarreAttente place="barre" {...action.barre} sx={{ flex: 1, minWidth: 0 }} />
          : (
            <>
              <Bouton
                variante="chip"
                onClick={() => onValider(null)}
                disabled={boutonsDesactives}
                raisonDansBarre
                aria-describedby={boutonsDesactives ? raisonId : undefined}
                sx={{ flex: 1, minWidth: 0 }}
              >
                Passer
              </Bouton>
              <Bouton
                variante="ink"
                onClick={() => onValider(toFeedbackPayload(valeur))}
                disabled={boutonsDesactives}
                raisonDansBarre
                aria-describedby={boutonsDesactives ? raisonId : undefined}
                sx={{ flex: 2, minWidth: 0 }}
              >
                Valider
              </Bouton>
            </>
          )}
      </BarreBas>
    </Box>
  )
}

export default PageRessenti
