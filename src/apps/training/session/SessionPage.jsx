import { useState, useEffect, useEffectEvent, useCallback } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { Box, ButtonBase, Typography } from '@mui/material'
import { etatSousPage } from '../../../lib/retour'
import { useAppNavigate } from '../../../hooks/useAppNavigate'
import { useAppCtx } from '../../../lib/context'
import { texteErreur } from '../../../lib/reseau'
import { DUREES } from '../../../lib/durees'
import { HEADER_HEIGHT } from '../../../components/AppHeader'
import CarteSysteme from '../../../components/CarteSysteme'
import { border, radius, space, textStyles } from '../../../styles/tokens'
import { DURATION, transition } from '../../../styles/motion'
import BarreAttente from '../../../ui/BarreAttente'
import BarreBas from '../../../ui/BarreBas'
import BarreProgression from '../../../ui/BarreProgression'
import BarreStructure from '../../../ui/BarreStructure'
import Bouton from '../../../ui/Bouton'
import Carte from '../../../ui/Carte'
import FeuilleFlottante from '../../../ui/FeuilleFlottante'
import MarqueSeance from '../../../ui/MarqueSeance'
import Page from '../../../ui/Page'
import Pastille from '../../../ui/Pastille'
import { ChevronBas, Montre } from '../../../ui/Icones'
import { sansMouvement } from '../../../ui/appui'
import { useAction } from '../../../ui/useAction'
import { useFinAttente } from '../../../ui/useFinAttente'
import { useMessage } from '../../../ui/useMessage'
import {
  getSession, skipSession, unskipSession, resetSession, updateOnCoros,
} from '../../../lib/training'
import { cleanText } from '../constants'
import Depli from '../../renfo/compose/Depli'
import PaceChart from './PaceChart'
import { useEnvoiMontre } from './useEnvoiMontre'
import SkipSheet from './SkipSheet'
import {
  analyseSeance, chiffresSeance, erreurMontre, estAFaire, estSurMontre, etatSeance,
  libelleIntensite, lignesStructure, ressentiSeance, segmentsStructure, sousLigneSeance, zoneSeance,
} from './vueSeance'

// Cartes d'attente en tête de page : l'écart du bas s'ouvre et se replie avec elles.
const CARTE_ATTENTE_SX = { '& .MuiCollapse-wrapperInner': { pb: space[12] } }
const filet = { borderTop: `${border.filet} solid`, borderColor: 'line' }
const RECHARGEMENT = 'Les données n\'ont pas pu être rechargées. Réessaie.'

/**
 * Page d'une séance Training (lot T2a) : carte de la séance, Analyse et Ressenti,
 * Structure, Allure et « Pourquoi ces allures ». Actions dans le menu des trois
 * points selon l'état ; « Valider la séance » seul en bas pour une séance à faire.
 * Plan qui n'est plus actif : ni menu ni barre du bas.
 */
const SessionPage = () => {
  const { planId, sessionId } = useParams()
  const navigate = useAppNavigate()
  const location = useLocation()
  const { setHeaderActions } = useAppCtx()
  const { afficher } = useMessage()

  const [chargement, setChargement] = useState({ status: 'loading', sessionId, essai: 0 })
  const [sautOuvert, setSautOuvert] = useState(false)
  const [reinitOuverte, setReinitOuverte] = useState(false)
  const [pourquoiOuvert, setPourquoiOuvert] = useState(false)
  const attente = useFinAttente(chargement.status === 'loading')

  // Changement de séance : tout repart au rendu, l'effet ne fait que charger.
  if (chargement.sessionId !== sessionId) {
    setChargement({ status: 'loading', sessionId, essai: 0 })
    setPourquoiOuvert(false)
  }

  const session = chargement.status === 'ready' ? chargement.session : null
  const setSession = useCallback((next) => setChargement((c) => ({
    ...c, session: typeof next === 'function' ? next(c.session) : next,
  })), [])

  const echec = (e, phrase) => afficher(texteErreur(e, phrase))

  // Actions réseau : chacune a sa carte d'attente en tête de page.
  const saut = useAction({
    attente: 'Saut de la séance', duree: DUREES.actionCourte,
    echec: 'La séance n\'a pas pu être sautée. Réessaie.',
  })
  const reinit = useAction({
    attente: 'Réinitialisation de la séance', duree: DUREES.actionCourte,
    echec: 'La séance n\'a pas pu être réinitialisée. Réessaie.',
  })
  // Phrase figée au lancement : le statut change à la réponse, pendant le repli de la carte.
  const [restaurerPhrase, setRestaurerPhrase] = useState('')
  const restaurer = useAction({
    attente: restaurerPhrase, duree: DUREES.envoiMontre,
    echec: 'La séance n\'a pas pu être restaurée. Réessaie.',
  })
  const montre = useAction({
    attente: 'Mise à jour de ta montre', duree: DUREES.envoiMontre,
    succes: (res) => {
      if (res.status === 'updated') return 'Montre mise à jour'
      if (res.status === 'past') return 'La séance sur la montre est déjà passée.'
      console.error('[training séance] mise à jour de la montre :', res.error)
      return 'La mise à jour de ta montre n\'a pas abouti. Réessaie.'
    },
    echec: 'La mise à jour de ta montre n\'a pas abouti. Réessaie.',
  })

  const reload = useCallback(async () => {
    const s = await getSession(sessionId)
    setSession(s)
    return s
  }, [sessionId, setSession])

  const envoi = useEnvoiMontre({ onEnvoye: reload })

  const actions = [saut, reinit, restaurer, montre, envoi.action, envoi.connexion]
  const locked = actions.some((a) => a.enCours)
  // Action en cours : le toucher est ignoré, la carte d'attente est déjà en tête de page.
  const siLibre = (fn) => () => { if (!locked) fn() }

  useEffect(() => {
    let annule = false
    getSession(sessionId).then(
      (s) => { if (!annule) setChargement((c) => ({ ...c, status: 'ready', session: s })) },
      (e) => {
        console.error('[training séance] chargement :', e)
        if (!annule) setChargement((c) => ({ ...c, status: 'error' }))
      },
    )
    return () => { annule = true }
  }, [sessionId, chargement.essai])

  // ── Handlers ────────────────────────────────────────────────────────────────
  // Rien n'est écrit avant le choix dans la feuille. « Sauter et adapter » : le
  // dashboard lance l'adaptation (location.state.adapter) et montre sa carte.
  const sauter = async (adapter) => {
    const { ok } = await saut.lancer(() => skipSession(sessionId))
    if (!ok) return
    if (adapter) {
      navigate(`/training/plan/${planId}`, {
        state: { adapter: { sessionId, titre: cleanText(session.title) } },
      })
      return
    }
    setSession((s) => ({ ...s, status: 'skipped' }))
  }

  const doReset = () => reinit.lancer(async () => {
    await resetSession(sessionId)
    await reload()
  })

  const doRestore = () => {
    setRestaurerPhrase(session.status === 'skipped' ? 'Reprise de la séance' : 'Restauration de la séance')
    restaurer.lancer(async () => {
      const { corosError } = await unskipSession(sessionId)
      await reload()
      if (corosError) {
        console.error('[training séance] restauration sur la montre :', corosError)
        afficher('Séance restaurée, mais pas sur ta montre.')
      }
    })
  }

  // Remplace le contenu de la copie Coros par la version actuelle de la séance.
  const doUpdateCoros = () => {
    montre.lancer(async () => {
      const res = await updateOnCoros(sessionId)
      await reload().catch((e) => echec(e, RECHARGEMENT))
      return res
    })
  }

  // Lignes du menu : lues au toucher, avec l'état du moment.
  const agir = useEffectEvent((quoi) => {
    if (locked || !session) return
    if (quoi === 'envoyer') envoi.ouvrir(session)
    else if (quoi === 'montre') doUpdateCoros()
    else if (quoi === 'restaurer' || quoi === 'reprendre') doRestore()
    else if (quoi === 'sauter') setSautOuvert(true)
    else if (quoi === 'reinitialiser') setReinitOuverte(true)
  })

  // ── Barre du haut : « Semaine 4 », trois points selon l'état ─────────────────
  const statut = session?.status ?? null
  const surMontre = session ? estSurMontre(session) : false
  const planActif = session?.plan?.status === 'active'
  const titre = session ? cleanText(session.title) : ''
  const semaine = session?.week_number != null ? `Semaine ${session.week_number}` : null

  useEffect(() => {
    if (!statut) {
      setHeaderActions([])
      return undefined
    }
    let lignes = []
    if (planActif) {
      const montreLignes = surMontre
        ? [['Mettre à jour la montre', 'montre'], ['Envoyer à une autre date', 'envoyer']]
        : [['Envoyer sur la montre', 'envoyer']]
      if (statut === 'done') lignes = [['Réinitialiser la séance', 'reinitialiser']]
      else if (statut === 'skipped') lignes = [['Reprendre la séance', 'reprendre']]
      else if (statut === 'adapted') lignes = [...montreLignes, ["Restaurer l'original", 'restaurer'], ['Sauter la séance', 'sauter']]
      else lignes = [...montreLignes, ['Sauter la séance', 'sauter']]
    }
    setHeaderActions(
      lignes.map(([label, quoi]) => ({ label, onClick: () => agir(quoi) })),
      titre,
      { titreBarre: semaine },
    )
    return () => setHeaderActions([])
  }, [statut, surMontre, planActif, titre, semaine, setHeaderActions])

  // ── États de rendu ────────────────────────────────────────────────────────
  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }
  if (chargement.status === 'error') {
    return (
      <Page>
        <CarteSysteme
          titre="Séance introuvable"
          phrase="Elle n'a pas pu être chargée."
          bouton="Réessayer"
          onClick={() => setChargement((c) => ({ ...c, status: 'loading', essai: c.essai + 1 }))}
        />
      </Page>
    )
  }
  if (!session) return null

  const zone = zoneSeance(session.type)
  const etat = etatSeance(statut)
  const erreur = erreurMontre(session)
  const chiffres = chiffresSeance(session)
  const lignes = lignesStructure(session)
  const analyse = analyseSeance(session)
  const ressenti = ressentiSeance(session)
  const faite = statut === 'done'
  const libelleStructure = lignes.map((l) => [l.nom, l.detail].filter(Boolean).join(' ')).join(', ')

  const bas = planActif && estAFaire(session) ? (
    <BarreBas>
      <Bouton
        variante="ink"
        onClick={siLibre(() => navigate(`/training/plan/${planId}/session/${sessionId}/valider`, { direction: 'forward', state: etatSousPage(location) }))}
        sx={{ flex: 1, minWidth: 0 }}
      >
        Valider la séance
      </Bouton>
    </BarreBas>
  ) : null

  return (
    <Page gap={0} bas={bas}>
      {actions.map((a, i) => (
        <BarreAttente key={i} place="carte" {...a.barre} sx={CARTE_ATTENTE_SX} />
      ))}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[12] }}>
        {/* ── Carte de la séance ─────────────────────────────────── */}
        <Carte sx={{ p: space[16], gap: space[12] }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: space[8] }}>
            <Typography
              variant="legende"
              component="span"
              sx={{ display: 'flex', alignItems: 'center', gap: space[8], fontWeight: 600, color: `zone-${zone}`, minWidth: 0 }}
            >
              <Box component="span" sx={{ width: '8px', height: '8px', borderRadius: radius.pill, bgcolor: `zone-${zone}`, flexShrink: 0 }} />
              {libelleIntensite(session, session.plan)}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: space[8], flexShrink: 0 }}>
              {surMontre && <Box component="span" sx={{ display: 'flex', color: 'ink' }}><Montre taille={18} titre="Sur la montre" /></Box>}
              <Pastille>
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: space[4] }}>
                  <MarqueSeance etat={etat.marque} zone={zone} />
                  {etat.texte}
                </Box>
              </Pastille>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
            <Typography variant="titre-section" component="h1">{titre}</Typography>
            <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
              {sousLigneSeance(session)}
            </Typography>
            {erreur && <Typography variant="secondaire" sx={{ color: 'muted' }}>{erreur}</Typography>}
          </Box>

          {session.steps.length > 0 && (
            <BarreStructure segments={segmentsStructure(session.steps)} zone={zone} label={`Structure : ${libelleStructure}`} />
          )}

          {chiffres.length > 0 && (
            <Box sx={{ ...filet, display: 'grid', gridTemplateColumns: `repeat(${chiffres.length}, minmax(0, 1fr))`, gap: space[8], pt: space[12] }}>
              {chiffres.map((c) => (
                <Box key={c.etiquette} sx={{ display: 'flex', flexDirection: 'column', gap: space[4], minWidth: 0 }}>
                  <Typography variant="etiquette" sx={{ color: 'muted' }}>{c.etiquette}</Typography>
                  <Typography component="span" sx={{ ...textStyles.chiffre, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {c.valeur}
                    {c.unite && <Box component="span" sx={{ ...textStyles.secondaire, fontWeight: 600, color: 'muted', letterSpacing: 0 }}>{c.unite}</Box>}
                  </Typography>
                  {c.prevu && (
                    <Typography variant="legende" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{c.prevu}</Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Carte>

        {/* ── Analyse et Ressenti ─────────────────────────────────── */}
        {(analyse || ressenti) && (
          <Carte sx={{ gap: space[12] }}>
            {analyse && (
              <>
                <Typography variant="etiquette" component="h2" sx={{ color: 'muted' }}>Analyse</Typography>
                {analyse.verdict && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: space[2] }}>
                    <Typography variant="titre-barre">{analyse.verdict}</Typography>
                    {analyse.cible && (
                      <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{analyse.cible}</Typography>
                    )}
                  </Box>
                )}
                {analyse.repli && (
                  <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{analyse.repli}</Typography>
                )}
                {analyse.conseil && (
                  <Typography variant="secondaire" sx={{ color: 'muted', lineHeight: '19px' }}>{analyse.conseil}</Typography>
                )}
              </>
            )}
            {ressenti && (
              <Box sx={{ ...(analyse ? { ...filet, pt: space[12] } : {}), display: 'flex', flexDirection: 'column', gap: space[8] }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Typography variant="etiquette" component="h2" sx={{ color: 'muted' }}>Ressenti</Typography>
                  {ressenti.rpe != null && (
                    <Typography component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      <Box component="span" sx={{ ...textStyles['corps-fort'], fontWeight: 700 }}>{ressenti.rpe}</Box>
                      <Box component="span" sx={{ ...textStyles.secondaire, fontWeight: 600, color: 'muted' }}> / 10</Box>
                    </Typography>
                  )}
                </Box>
                {ressenti.rpe != null && (
                  <BarreProgression valeur={ressenti.rpe} max={10} widget label={`Effort ${ressenti.rpe} sur 10`} />
                )}
                {ressenti.note && (
                  <Typography variant="secondaire" sx={{ whiteSpace: 'pre-line' }}>{`« ${ressenti.note} »`}</Typography>
                )}
                {ressenti.douleurs.length > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: space[8], pt: space[2] }}>
                    <Typography variant="etiquette" sx={{ color: 'muted' }}>Douleurs</Typography>
                    {ressenti.douleurs.map((d) => <Pastille key={d}>{d}</Pastille>)}
                  </Box>
                )}
              </Box>
            )}
          </Carte>
        )}

        {/* ── Structure ───────────────────────────────────────────── */}
        {lignes.length > 0 && (
          <Carte sx={{ py: space[4], px: space[14], gap: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: space[12], pb: space[8] }}>
              <Typography variant="etiquette" component="h2" sx={{ color: 'muted' }}>Structure</Typography>
              {faite && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: space[8] }}>
                  <Colonne largeur="40px" etiquette>Cible</Colonne>
                  <Colonne largeur="48px" etiquette>Réalisé</Colonne>
                  <Colonne largeur="40px" etiquette>Écart</Colonne>
                </Box>
              )}
            </Box>
            {lignes.map((l, i) => (
              <Box key={i} sx={{ py: space[12], ...(i > 0 ? filet : {}) }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: space[12] }}>
                  <Box sx={{ width: '4px', height: '32px', borderRadius: radius.segment, flexShrink: 0, bgcolor: l.marqueur === 'calme' ? 'warm' : `zone-${zone}` }} />
                  <Box sx={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: space[2] }}>
                    <Typography variant="corps-fort">{l.nom}</Typography>
                    {l.detail && <Typography variant="secondaire" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{l.detail}</Typography>}
                  </Box>
                  {!faite && l.allure && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <Typography component="span" sx={{ ...textStyles['corps-fort'], fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {l.allure}
                        <Box component="span" sx={{ ...textStyles.legende, fontWeight: 600, color: 'muted' }}> /km</Box>
                      </Typography>
                      <Typography variant="legende" sx={{ color: 'muted', fontVariantNumeric: 'tabular-nums' }}>{l.tolerance}</Typography>
                    </Box>
                  )}
                  {faite && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: space[8], flexShrink: 0 }}>
                      <Colonne largeur="40px">{l.cible}</Colonne>
                      {l.repetitions.length > 0 ? (
                        <Box sx={{ width: '96px' }} />
                      ) : (
                        <>
                          <Colonne largeur="48px" fort>{l.realise}</Colonne>
                          <Colonne largeur="40px">{l.ecart}</Colonne>
                        </>
                      )}
                    </Box>
                  )}
                </Box>
                {l.repetitions.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', mt: space[8], ml: space[14], borderLeft: `${border.filet} solid`, borderColor: 'line' }}>
                    {l.repetitions.map((r) => (
                      <Box key={r.libelle} sx={{ display: 'flex', alignItems: 'center', gap: space[8], py: space[4], pl: space[12] }}>
                        <Typography variant="secondaire" sx={{ flex: '1 1 0', color: 'muted', fontVariantNumeric: 'tabular-nums' }}>
                          {r.libelle}{r.extra}
                        </Typography>
                        <Colonne largeur="48px" fort>{r.realise}</Colonne>
                        <Colonne largeur="40px">{r.ecart}</Colonne>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            ))}
            <Box sx={{ height: space[4] }} />
          </Carte>
        )}

        {/* ── Allure ──────────────────────────────────────────────── */}
        <PaceChart key={session.id} session={session} />

        {/* ── Pourquoi ces allures ────────────────────────────────── */}
        {session.rationale && (
          <Carte sx={{ py: 0, px: space[14], gap: 0 }}>
            <ButtonBase
              aria-expanded={pourquoiOuvert}
              onClick={() => setPourquoiOuvert((o) => !o)}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '52px', width: '100%', textAlign: 'left', borderRadius: radius.inner }}
            >
              <Typography variant="corps-fort" component="span">Pourquoi ces allures</Typography>
              <Box
                component="span"
                sx={{
                  display: 'flex',
                  color: 'muted',
                  transform: pourquoiOuvert ? 'rotate(180deg)' : 'none',
                  transition: transition('transform', pourquoiOuvert ? DURATION.open : DURATION.close),
                  ...sansMouvement(),
                }}
              >
                <ChevronBas taille={18} />
              </Box>
            </ButtonBase>
            <Depli ouvert={pourquoiOuvert}>
              <Typography variant="secondaire" sx={{ display: 'block', color: 'muted', lineHeight: '19px', pb: space[14] }}>
                {cleanText(session.rationale)}
              </Typography>
            </Depli>
          </Carte>
        )}
      </Box>

      {/* ── Feuilles ─────────────────────────────────────────────── */}
      {envoi.feuilles}

      <SkipSheet
        session={session}
        ouverte={sautOuvert}
        onFermer={() => setSautOuvert(false)}
        onAdapter={() => sauter(true)}
        onSansAdapter={() => sauter(false)}
      />

      <FeuilleFlottante
        ouverte={reinitOuverte}
        onFermer={() => setReinitOuverte(false)}
        titre={`${titre} repassera à faire. Les activités liées, l'analyse et ton ressenti seront effacés.`}
        lignes={[{ libelle: 'Réinitialiser la séance', onClick: doReset }]}
        fermerLibelle="Annuler"
      />
    </Page>
  )
}

// Colonne de la Structure d'une séance faite : cible, réalisé (fort) ou écart.
const Colonne = ({ largeur, fort = false, etiquette = false, children }) => (
  <Typography
    component="span"
    variant={etiquette ? 'etiquette' : undefined}
    sx={{
      width: largeur,
      textAlign: 'right',
      flexShrink: 0,
      fontVariantNumeric: 'tabular-nums',
      ...(etiquette ? { color: 'muted' } : fort ? { ...textStyles['corps-fort'], fontWeight: 700 } : { ...textStyles.secondaire, color: 'muted' }),
    }}
  >
    {children}
  </Typography>
)

export default SessionPage
