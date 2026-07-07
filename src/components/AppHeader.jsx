import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Box, IconButton, Typography, Menu, MenuItem,
  Divider, ListItemIcon, ListItemText, Avatar,
} from '@mui/material'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ExpandMore from '@mui/icons-material/ExpandMore'
import DarkMode from '@mui/icons-material/DarkMode'
import LightMode from '@mui/icons-material/LightMode'
import Logout from '@mui/icons-material/Logout'
import supabase from '../lib/supabase'
import { glassSx } from '../styles/glass'

// Hauteur occupée par le header flottant (py:1.5 *2 + bouton 36px)
export const HEADER_HEIGHT = 60

const AppHeader = ({
  toolName,
  actions = [],
  showBack = true,
  onBack,
  dark,
  setDark,
  user,
  sx = {},
}) => {
  const [accountAnchor, setAccountAnchor] = useState(null)
  const [actionsAnchor, setActionsAnchor] = useState(null)

  // Ferme les menus au changement de route (AppHeader n'est jamais démonté)
  const { pathname } = useLocation()
  useEffect(() => {
    setAccountAnchor(null)
    setActionsAnchor(null)
  }, [pathname])

  const hasActions = actions.length > 0
  const userInitial = user?.email?.[0]?.toUpperCase() ?? '?'

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
            onClick={onBack}
            sx={{ ...glassSx, borderRadius: '50%', width: 36, height: 36, p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
                ...glassSx,
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
              PaperProps={{ sx: { ...glassSx, minWidth: 200 } }}
            >
              {actions.map((action) => (
                <MenuItem
                  key={action.label}
                  disabled={action.disabled}
                  onClick={() => { action.onClick(); setActionsAnchor(null) }}
                >
                  {action.icon && <ListItemIcon>{action.icon}</ListItemIcon>}
                  <ListItemText>{action.label}</ListItemText>
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : toolName ? (
          <Box sx={{ ...glassSx, display: 'flex', alignItems: 'center', borderRadius: 6, px: 2, height: 36 }}>
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
          sx={{ ...glassSx, borderRadius: '50%', width: 36, height: 36, p: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Avatar sx={{ width: 22, height: 22, fontSize: '0.7rem', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            {userInitial}
          </Avatar>
        </IconButton>

        <Menu
          anchorEl={accountAnchor}
          open={Boolean(accountAnchor)}
          onClose={() => setAccountAnchor(null)}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          PaperProps={{ sx: { ...glassSx, minWidth: 230 } }}
        >
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 32, height: 32, fontSize: '0.875rem', bgcolor: 'primary.main', color: 'primary.contrastText', flexShrink: 0 }}>
              {userInitial}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Connecté en tant que
              </Typography>
              <Typography variant="body2" fontWeight={500} noWrap>
                {user?.email ?? '…'}
              </Typography>
            </Box>
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
