import { useState } from 'react'
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

// Hauteur occupée par le header flottant (py:1.5 *2 + bouton 36px)
export const HEADER_HEIGHT = 60

const AppHeader = ({
  toolName,
  actions = [],
  showBack = true,
  dark,
  setDark,
  user,
  sx = {},
}) => {
  const navigate = useNavigate()
  const [accountAnchor, setAccountAnchor] = useState(null)
  const [actionsAnchor, setActionsAnchor] = useState(null)

  const glass = {
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    bgcolor: dark ? 'rgba(15,15,18,0.45)' : 'rgba(255,255,255,0.55)',
    boxShadow: dark
      ? 'inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 12px rgba(0,0,0,0.35)'
      : 'inset 0 1px 0 rgba(255,255,255,0.9), 0 2px 12px rgba(0,0,0,0.10)',
    border: dark
      ? '1px solid rgba(255,255,255,0.07)'
      : '1px solid rgba(0,0,0,0.07)',
  }

  // Style partagé pour les menus déroulants (popups)
  const menuPaper = { ...glass, borderRadius: 2, minWidth: 200 }

  const hasActions = actions.length > 0

  const handleSignOut = async () => {
    setAccountAnchor(null)
    await supabase.auth.signOut()
  }

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      px: 2, py: 1.5,
      pointerEvents: 'none',
      ...sx,
    }}>

      {/* Gauche — bouton retour */}
      <Box sx={{ pointerEvents: 'all', display: 'flex', alignItems: 'center' }}>
        {showBack ? (
          <IconButton
            onClick={() => navigate('/')}
            sx={{ ...glass, borderRadius: '50%', width: 36, height: 36, p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ArrowBack sx={{ fontSize: 18 }} />
          </IconButton>
        ) : (
          <Box sx={{ width: 36 }} />
        )}
      </Box>

      {/* Centre — nom de l'outil */}
      <Box sx={{ pointerEvents: 'all' }}>
        {hasActions ? (
          <>
            <Box
              onClick={(e) => setActionsAnchor(e.currentTarget)}
              sx={{
                ...glass,
                display: 'flex', alignItems: 'center', gap: 0.5,
                borderRadius: 6, px: 2, height: 36,
                cursor: 'pointer',
              }}
            >
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: 1 }}>
                {toolName}
              </Typography>
              <ExpandMore sx={{ fontSize: 16, color: 'text.secondary' }} />
            </Box>
            <Menu
              anchorEl={actionsAnchor}
              open={Boolean(actionsAnchor)}
              onClose={() => setActionsAnchor(null)}
              transformOrigin={{ horizontal: 'center', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
              PaperProps={{ sx: menuPaper }}
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
          <Box sx={{ ...glass, display: 'flex', alignItems: 'center', borderRadius: 6, px: 2, height: 36 }}>
            <Typography sx={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: 1 }}>
              {toolName}
            </Typography>
          </Box>
        ) : (
          <Box />
        )}
      </Box>

      {/* Droite — menu compte */}
      <Box sx={{ pointerEvents: 'all', display: 'flex', alignItems: 'center' }}>
        <IconButton
          onClick={(e) => setAccountAnchor(e.currentTarget)}
          sx={{ ...glass, borderRadius: '50%', width: 36, height: 36, p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <AccountCircle sx={{ fontSize: 18 }} />
        </IconButton>

        <Menu
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={() => setAccountAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{ sx: { ...menuPaper, minWidth: 230 } }}
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

    </Box>
  )
}

export default AppHeader
