import { useState } from 'react'
import { EXERCISE_INDEX } from '../../../../supabase/functions/_shared/strength/catalog.ts'
import { DUREES } from '../../../lib/durees'
import { adjustExercise } from '../../../lib/renfo'
import { useAction } from '../../../ui/useAction'
import { bandOf } from '../content'
import AjusterExercice from './AjusterExercice'
import FicheExercice from './FicheExercice'
import { exercicesDuBloc } from './seance'

// Réglage de départ d'Ajuster : la dose actuelle et l'élastique affiché.
const reglageDe = (dose, bandsUsed) => ({
  quantite: dose.duration_sec ?? dose.reps,
  kg: bandOf(dose, bandsUsed),
})

/**
 * Fiche d'un exercice et son réglage (Ajuster), partagés par la page séance et le
 * player : la fiche, puis Ajuster et « Enregistrer », qui ferme la feuille et lance
 * adjustExercise sous une carte d'attente (`action.barre`). L'échec part en Message,
 * rien n'est gardé. Renvoie { ouvrir(dose, block, blockIndex), ouverte, action, feuilles }.
 * - session, bands : la séance affichée et les élastiques du compte.
 * - modifiable : la séance accepte Ajuster (à faire, hors cycle, nouveau format).
 * - sansRemplacer, onRemplacer(cible) : la ligne « Remplacer l'exercice » de la fiche.
 * - onSession(session) : la séance renvoyée par le serveur après un réglage.
 * La fiche reste sur son exercice : sa dose est relue dans la séance à chaque rendu.
 */
export const useFicheExercice = ({ session, bands, modifiable, sansRemplacer = false, onRemplacer, onSession }) => {
  // Exercice de la fiche, gardé pendant la fermeture : { slug, block, blockIndex, dose }.
  const [cible, setCible] = useState(null)
  const [feuille, setFeuille] = useState(null) // 'fiche' | 'ajuster' | null
  const [reglage, setReglage] = useState(null)
  const action = useAction({
    attente: 'Enregistrement du réglage', duree: DUREES.enregistrement,
    echec: "Le réglage n'a pas abouti. Réessaie.",
  })

  // Dose à jour de l'exercice (après un réglage), sinon celle de l'ouverture.
  const block = cible ? session?.content?.blocks?.[cible.blockIndex] ?? cible.block : null
  const dose = cible ? exercicesDuBloc(block).find((d) => d.slug === cible.slug) ?? cible.dose : null
  const cibleAJour = cible ? { dose, block, blockIndex: cible.blockIndex } : null

  const ouvrir = (d, b, blockIndex) => {
    setCible({ slug: d.slug, dose: d, block: b, blockIndex })
    setFeuille('fiche')
  }

  const ouvrirAjuster = () => {
    setReglage(reglageDe(dose, session.bands_used))
    setFeuille('ajuster')
  }

  const enregistrer = async () => {
    const depart = reglageDe(dose, session.bands_used)
    if (reglage.quantite === depart.quantite && reglage.kg === depart.kg) {
      setFeuille('fiche')
      return
    }
    setFeuille(null)
    const ex = EXERCISE_INDEX[dose.slug]
    const envoi = { slug: dose.slug, [ex?.mode === 'duration' ? 'duration_sec' : 'reps']: reglage.quantite }
    // Élastique envoyé seulement s'il est encore au compte : un poids supprimé depuis
    // serait refusé (400), et sans band_kg le serveur garde le poids actuel.
    const auCompte = (bands ?? []).some((b) => Number(b.kg) === Number(reglage.kg))
    if (ex?.equipment.includes('band') && reglage.kg != null && auCompte) envoi.band_kg = reglage.kg
    const { ok, valeur } = await action.lancer(() => adjustExercise(session.id, envoi))
    if (ok) onSession(valeur.session)
  }

  const feuilles = (
    <>
      <FicheExercice
        ouverte={feuille === 'fiche'}
        onFermer={() => setFeuille(null)}
        cible={cibleAJour}
        bandsUsed={session?.bands_used}
        bands={bands}
        modifiable={modifiable}
        sansRemplacer={sansRemplacer}
        onAjuster={ouvrirAjuster}
        onRemplacer={() => onRemplacer?.(cibleAJour)}
      />
      <AjusterExercice
        ouverte={feuille === 'ajuster'}
        slug={cible?.slug}
        valeur={reglage}
        onChange={setReglage}
        bands={bands}
        onEnregistrer={enregistrer}
        onAnnuler={() => setFeuille('fiche')}
      />
    </>
  )

  return { ouvrir, ouverte: feuille != null, action, feuilles }
}
