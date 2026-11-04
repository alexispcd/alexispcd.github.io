import { useState } from 'react'
import { Drawer, Box, Typography, Switch, Button, Divider } from '@mui/material'
import { glassSx, GLASS_BACKDROP } from '../../styles/glass'
import FeuilleFlottante from '../../ui/FeuilleFlottante'
import BarreAttente from '../../ui/BarreAttente'
import { useFinAttente } from '../../ui/useFinAttente'
import { DUREES } from '../../lib/durees'
import { assignableModules } from '../registry'

// « Côtes et Training », « Côtes, Renfo et Training ».
const listeFr = (noms) => (noms.length < 2 ? noms.join('') : `${noms.slice(0, -1).join(', ')} et ${noms.at(-1)}`)

const titreSuppression = (account) => {
  const noms = assignableModules().filter((m) => account.modules.includes(m.id)).map((m) => m.name)
  const acces = noms.length ? `Il perd l'accès à ${listeFr(noms)}.` : 'Il n\'a aucun module.'
  return `Supprimer ${account.email} ? ${acces} Ses données sont effacées. Cette action est définitive.`
}

const UserDrawer = ({ account, busy, onClose, onSetModules, onToggleDisabled, onDelete }) => {
  // Titre figé à l'ouverture : la fiche peut se fermer pendant que la feuille se replie.
  const [suppressionTitre, setSuppressionTitre] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const attente = useFinAttente(Boolean(busy))
  const isAdminAccount = account?.role === 'admin'

  const toggleModule = (moduleId, checked) => {
    const next = checked
      ? [...account.modules, moduleId]
      : account.modules.filter(id => id !== moduleId)
    onSetModules(next)
  }

  const closeAll = () => {
    setConfirmDelete(false)
    onClose()
  }

  return (
    <>
      <Drawer
        anchor="bottom"
        open={Boolean(account)}
        onClose={() => !busy && closeAll()}
        slotProps={{
          backdrop: GLASS_BACKDROP,
          paper: {
            sx: {
              ...glassSx,
              borderRadius: '20px 20px 0 0',
              px: 3,
              pt: 3,
              pb: 'max(2rem, calc(env(safe-area-inset-bottom, 0px) + 1rem))',
            },
          },
        }}
      >
        {account && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body1" fontWeight={600} noWrap sx={{ minWidth: 0 }}>
                {account.email}
              </Typography>
              {attente.visible && (
                <BarreAttente place="section" duree={DUREES.administration} {...attente} />
              )}
            </Box>

            <Box>
              <Typography variant="overline" sx={{ color: 'text.disabled', letterSpacing: '0.15em', fontSize: '0.6rem' }}>
                Modules
              </Typography>
              {assignableModules().map(m => {
                const Icon = m.icon
                return (
                  <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.5 }}>
                    <Icon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    <Typography variant="body2" sx={{ flex: 1 }}>{m.name}</Typography>
                    <Switch
                      checked={account.modules.includes(m.id)}
                      disabled={busy}
                      onChange={(e) => toggleModule(m.id, e.target.checked)}
                    />
                  </Box>
                )
              })}
            </Box>

            <Divider />

            {isAdminAccount ? (
              <Typography variant="body2" color="text.secondary">
                Compte administrateur : ni désactivation ni suppression.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  disabled={busy}
                  onClick={onToggleDisabled}
                  sx={{ flex: 1, textTransform: 'none' }}
                >
                  {account.disabled ? 'Réactiver' : 'Désactiver'}
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  disabled={busy}
                  onClick={() => { setSuppressionTitre(titreSuppression(account)); setConfirmDelete(true) }}
                  sx={{ flex: 1, textTransform: 'none' }}
                >
                  Supprimer
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Drawer>

      <FeuilleFlottante
        ouverte={confirmDelete}
        onFermer={() => setConfirmDelete(false)}
        titre={suppressionTitre}
        lignes={[{ libelle: 'Supprimer le compte', onClick: onDelete }]}
        fermerLibelle="Annuler"
      />
    </>
  )
}

export default UserDrawer
