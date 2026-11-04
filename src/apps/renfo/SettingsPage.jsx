import { useEffect, useState } from 'react'
import {
  Alert, Box, Button, IconButton, Switch, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material'
import Add from '@mui/icons-material/Add'
import EditOutlined from '@mui/icons-material/EditOutlined'
import DeleteOutlined from '@mui/icons-material/DeleteOutlined'
import { HEADER_HEIGHT } from '../../components/AppHeader'
import { cardSx } from '../../styles/glass'
import { texteErreur } from '../../lib/reseau'
import { useMessage } from '../../ui/useMessage'
import FeuilleFlottante from '../../ui/FeuilleFlottante'
import BarreAttente from '../../ui/BarreAttente'
import { useAction } from '../../ui/useAction'
import { useFinAttente } from '../../ui/useFinAttente'
import { DUREES } from '../../lib/durees'
import {
  addBand, deleteBand, getActiveCycle, getBands, getProfile, saveProfile, updateBand,
} from '../../lib/renfo'
import { formatKg } from './bandColor'
import BandChip from './BandChip'
import SectionLabel from './SectionLabel'
import BandDialog from './settings/BandDialog'

// Coins concentriques : radius carte = inset (16 = p 2) + radius des éléments (12) = 28.
const CARD_RADIUS = '28px'

const DEFAULT_PROFILE = { frequency: 2, equipment: [] }

const EQUIPMENT = [
  { id: 'bar', label: 'Barre de traction', sub: 'mobile : en haut, à mi-hauteur ou en bas' },
  { id: 'chair', label: 'Chaise', sub: null },
]

const loadSettings = async () => {
  const [profile, bands, cycle] = await Promise.all([getProfile(), getBands(), getActiveCycle()])
  return { profile, bands, hasCycle: Boolean(cycle) }
}

const sameProfile = (a, b) =>
  a.frequency === b.frequency && [...a.equipment].sort().join() === [...b.equipment].sort().join()

/** Réglages Renfo : fréquence, matériel et inventaire d'élastiques. */
const SettingsPage = () => {
  const [state, setState] = useState({ status: 'loading' })
  const [draft, setDraft] = useState(DEFAULT_PROFILE)
  const [saving, setSaving] = useState(false)
  const [bandDialog, setBandDialog] = useState(null) // { band } ; band null pour un ajout
  // Élastique visé : reste posé pendant la fermeture de la feuille.
  const [toDelete, setToDelete] = useState(null)
  const [suppressionOuverte, setSuppressionOuverte] = useState(false)
  const { afficher } = useMessage()
  const attente = useFinAttente(state.status === 'loading')
  const attenteEnregistrement = useFinAttente(saving)
  const suppression = useAction({
    attente: "Suppression de l'élastique", duree: DUREES.actionCourte,
    echec: "L'élastique n'a pas pu être supprimé. Réessaie.",
  })

  useEffect(() => {
    let cancelled = false
    loadSettings().then(
      (res) => {
        if (cancelled) return
        setState({ status: 'ready', ...res })
        setDraft(res.profile ?? DEFAULT_PROFILE)
      },
      (err) => {
        console.error('[renfo settings]', err)
        if (!cancelled) setState({ status: 'error' })
      },
    )
    return () => { cancelled = true }
  }, [])

  if (attente.visible) {
    return (
      <Box sx={{ height: '100%', pt: `${HEADER_HEIGHT}px` }}>
        <BarreAttente place="page" duree={DUREES.chargementPage} {...attente} />
      </Box>
    )
  }
  if (state.status === 'error') {
    return (
      <Box sx={{ px: 2, pt: `${HEADER_HEIGHT + 16}px` }}>
        <Alert severity="error">Impossible de charger les réglages.</Alert>
      </Box>
    )
  }

  const { profile, bands, hasCycle } = state
  const dirty = !profile || !sameProfile(draft, profile)

  const toggleEquipment = (id) => setDraft((d) => ({
    ...d,
    equipment: d.equipment.includes(id) ? d.equipment.filter((e) => e !== id) : [...d.equipment, id],
  }))

  const doSaveProfile = async () => {
    setSaving(true)
    try {
      const saved = await saveProfile(draft)
      setState((s) => ({ ...s, profile: saved }))
      setDraft(saved)
    } catch (e) {
      afficher(texteErreur(e, "Tes réglages n'ont pas pu être enregistrés. Réessaie."))
    } finally {
      setSaving(false)
    }
  }

  const saveBand = async ({ kg, color }) => {
    const current = bandDialog?.band
    const saved = current ? await updateBand(current.id, { kg, color }) : await addBand({ kg, color })
    setState((s) => ({
      ...s,
      bands: [...s.bands.filter((b) => b.id !== saved.id), saved].sort((a, b) => a.kg - b.kg),
    }))
    setBandDialog(null)
  }

  const doDelete = () => {
    const id = toDelete?.id
    if (!id) return
    suppression.lancer(async () => {
      await deleteBand(id)
      setState((s) => ({ ...s, bands: s.bands.filter((b) => b.id !== id) }))
    })
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', pt: `${HEADER_HEIGHT}px`, pb: 'calc(env(safe-area-inset-bottom, 0px) + 32px)' }}>
      <Box sx={{ maxWidth: 640, mx: 'auto', px: 2 }}>

        <BarreAttente place="carte" {...suppression.barre} sx={{ '& .MuiCollapse-wrapperInner': { pt: 2 } }} />

        <SectionLabel>Fréquence</SectionLabel>
        <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, p: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>Séances par semaine</Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={draft.frequency}
            onChange={(_, v) => v && setDraft((d) => ({ ...d, frequency: v }))}
            sx={{ '& .MuiToggleButton-root': { borderRadius: '12px', fontWeight: 700, fontSize: '1rem', py: 1 } }}
          >
            {[1, 2, 3].map((n) => <ToggleButton key={n} value={n}>{n}</ToggleButton>)}
          </ToggleButtonGroup>
          {hasCycle && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
              S'applique au prochain cycle
            </Typography>
          )}
        </Box>

        <SectionLabel>Matériel</SectionLabel>
        <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, px: 2, py: 1 }}>
          {EQUIPMENT.map((eq) => (
            <Box key={eq.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body1" fontWeight={600}>{eq.label}</Typography>
                {eq.sub && <Typography variant="caption" color="text.secondary">{eq.sub}</Typography>}
              </Box>
              <Switch
                checked={draft.equipment.includes(eq.id)}
                onChange={() => toggleEquipment(eq.id)}
              />
            </Box>
          ))}
        </Box>

        {attenteEnregistrement.visible
          ? (
            <BarreAttente
              place="barre"
              phrase="Enregistrement de tes réglages"
              duree={DUREES.enregistrement}
              {...attenteEnregistrement}
              sx={{ mt: 2, height: 46 }}
            />
          )
          : (
            <Button
              variant="contained"
              fullWidth
              sx={{ mt: 2, height: 46, borderRadius: '23px', textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
              disabled={!dirty}
              onClick={doSaveProfile}
            >
              {profile ? 'Enregistrer' : 'Valider ces réglages'}
            </Button>
          )}

        <SectionLabel>Élastiques</SectionLabel>
        <Box sx={{ ...cardSx, borderRadius: CARD_RADIUS, px: 2, py: 1 }}>
          {bands.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
              Aucun élastique : les exercices avec élastique ne seront pas proposés.
            </Typography>
          )}
          {bands.map((band) => (
            <Box key={band.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75 }}>
              <BandChip kg={band.kg} color={band.color} />
              <Typography variant="body2" sx={{ flex: 1, fontVariantNumeric: 'tabular-nums' }}>
                {formatKg(band.kg)} kg
              </Typography>
              <IconButton size="small" aria-label="Modifier" onClick={() => setBandDialog({ band })}>
                <EditOutlined fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Supprimer"
                disabled={suppression.enCours}
                onClick={() => { setToDelete(band); setSuppressionOuverte(true) }}
              >
                <DeleteOutlined fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            startIcon={<Add />}
            fullWidth
            onClick={() => setBandDialog({ band: null })}
            sx={{ mt: 0.5, mb: 0.5, borderRadius: '12px', textTransform: 'none', fontWeight: 600, justifyContent: 'flex-start' }}
          >
            Ajouter un élastique
          </Button>
        </Box>
      </Box>

      <BandDialog
        open={Boolean(bandDialog)}
        band={bandDialog?.band ?? null}
        bands={bands}
        onClose={() => setBandDialog(null)}
        onSave={saveBand}
      />

      <FeuilleFlottante
        ouverte={suppressionOuverte}
        onFermer={() => setSuppressionOuverte(false)}
        titre={toDelete ? `L'élastique de ${formatKg(toDelete.kg)} kg ne sera plus proposé dans tes prochaines séances.` : ''}
        lignes={[{ libelle: "Supprimer l'élastique", onClick: doDelete }]}
        fermerLibelle="Annuler"
      />
    </Box>
  )
}

export default SettingsPage
