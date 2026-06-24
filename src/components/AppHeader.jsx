import { useState, useEffect } from 'react'
import {
  Box, IconButton, Typography, Menu, MenuItem,
  Divider, ListItemIcon, ListItemText,
} from '@mui/material'
import {
  ArrowBack, AccountCircle, ExpandMore,
  DarkMode, LightMode, Logout,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import supabase from '../lib/supabase'

const AppHeader = ({
  toolName,
  actions = [],
  showBack = true,
  dark,
  setDark,
  endSlot,
  subtitle,
  sx = {},
}) => {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [accountAnchor, setAccountAnchor] = useState(null)
  const [actionsAnchor, setActionsAnchor] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const liquidGlass = {
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    bgcolor: dark ? 'rgba(15,15,18,0.72)' : 'rgba(255,255,255,0.82)',
    boxShadow: dark
      ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 32px rgba(0,0,0,0.4)'
      : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 32px rgba(0,0,0,0.1)',
    border: dark
      ? '1px solid rgba(255,255,255,0.06)'
      : '1px solid rgba(0,0,0,0.06)',
    borderRadius: 2,
  }

  const hasActions = actions.length > 0

  const handleSignOut = async () => {
    setAccountAnchor(null)
    await supabase.auth.signOut()
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center',
      px: 1.5, py: 1,
      gap: 1,
      ...sx,
    }}>
      {/* Gauche — retour */}
      <Box sx={{ width: 36, flexShrink: 0 }}>
        {showBack && (
          <IconButton size="small" onClick={() => navigate('/')} sx={{ p: 0.75 }}>
            <ArrowBack fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Centre — nom + actions optionnelles */}
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        {hasActions ? (
          <>
            <Box
              onClick={(e) => setActionsAnchor(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 0.5,
                cursor: 'pointer', borderRadius: 1, px: 1, py: 0.5,
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle2" fontWeight={600} lineHeight={1.2}>{toolName}</Typography>
                {subtitle && (
                  <Typography variant="caption" color="primary.main" fontWeight={600}>{subtitle}</Typography>
                )}
              </Box>
              <ExpandMore fontSize="small" sx={{ color: 'text.secondary' }} />
            </Box>
            <Menu
              anchorEl={actionsAnchor}
              open={Boolean(actionsAnchor)}
              onClose={() => setActionsAnchor(null)}
              transformOrigin={{ horizontal: 'center', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
              PaperProps={{ sx: liquidGlass }}
            >
              {actions.map((action) => (
                <MenuItem
                  key={action.label}
                  onClick={() => { action.onClick(); setActionsAnchor(null) }}
                >
                  {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
                  <ListItemText>{action.label}</ListItemText>
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : toolName ? (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="subtitle2" fontWeight={600} lineHeight={1.2}>{toolName}</Typography>
            {subtitle && (
              <Typography variant="caption" color="primary.main" fontWeight={600}>{subtitle}</Typography>
            )}
          </Box>
        ) : null}
      </Box>

      {/* Droite — slot optionnel + compte */}
      <Box sx={{ width: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {endSlot}
        <IconButton
          size="small"
          onClick={(e) => setAccountAnchor(e.currentTarget)}
          sx={{ p: 0.75 }}
        >
          <AccountCircle fontSize="small" />
        </IconButton>
      </Box>

      {/* Menu compte */}
      <Menu
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={() => setAccountAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { ...liquidGlass, minWidth: 230 } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" color="text.secondary" display="block">
            Connecté en tant que
          </Typography>
          <Typography variant="body2" fontWeight={500} noWrap>
            {user?.email ?? '…'}
          </Typography>
        </Box>
        <Divider />
        <MenuItem onClick={() => { setDark(!dark); setAccountAnchor(null) }}>
          <ListItemIcon>
            {dark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
          </ListItemIcon>
          <ListItemText>{dark ? 'Mode clair' : 'Mode sombre'}</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSignOut}>
          <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
          <ListItemText>Se déconnecter</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  )
}

export default AppHeader
