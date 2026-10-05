import { Box, Typography, Chip } from '@mui/material'
import { cardSx } from '../../styles/glass'
import { formatRelative } from './format'

const chipSx = { height: 22, fontSize: '0.7rem' }

const UserListItem = ({ account, isSelf, now, moduleName, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      ...cardSx,
      borderRadius: '16px',
      p: 2,
      cursor: 'pointer',
      opacity: account.disabled ? 0.6 : 1,
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, minWidth: 0 }}>
      <Typography variant="body2" fontWeight={600} noWrap sx={{ minWidth: 0 }}>
        {account.email ?? account.id}
      </Typography>
      {isSelf && <Chip label="Toi" size="small" color="primary" sx={chipSx} />}
      {account.role === 'admin' && <Chip label="Admin" size="small" variant="outlined" sx={chipSx} />}
    </Box>

    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
      Dernière connexion : {formatRelative(account.last_sign_in_at, now)}
    </Typography>

    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {account.disabled && <Chip label="Désactivé" size="small" color="warning" sx={chipSx} />}
      {account.coros_connected && <Chip label="Coros connecté" size="small" color="success" variant="outlined" sx={chipSx} />}
      {account.role === 'admin'
        ? <Chip label="Tous les modules" size="small" variant="outlined" sx={chipSx} />
        : account.modules.map(id => <Chip key={id} label={moduleName(id)} size="small" sx={chipSx} />)}
      {account.role !== 'admin' && account.modules.length === 0 && (
        <Typography variant="caption" color="text.disabled">Aucun module</Typography>
      )}
    </Box>
  </Box>
)

export default UserListItem
