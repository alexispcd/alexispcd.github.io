import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMapEvents, Circle, Polyline, Marker } from 'react-leaflet'
import { Box, Typography, IconButton, CircularProgress } from '@mui/material'
import { ArrowBack, LightMode, DarkMode } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useSearch } from './useSearch'
import { slopeColor } from './utils'
import FilterDialog from './FilterDialog'
import ResultCard from './ResultCard'
import BottomBar from './BottomBar'

const centerIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#3d6b51;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(61,107,81,.2)"></div>`,
  className: '',
  iconAnchor: [7, 7],
})

const MapClickHandler = ({ onMapClick, disabled, onMove }) => {
  useMapEvents({
    click: (e) => { if (!disabled) onMapClick(e.latlng) },
    dragstart: () => onMove(),
  })
  return null
}

const CotesRun = ({ dark, setDark }) => {
  const theme = useTheme()
  const navigate = useNavigate()
  const mapRef = useRef(null)
  const [center, setCenter] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [activeIdx, setActiveIdx] = useState(0)
  const [mapMoved, setMapMoved] = useState(false)
  const { phase, setPhase, status, results, params, setParam, hasCustomParams, search, cancel, reset } = useSearch()

  // Désactive le scroll/overscroll de la page (iOS bounce notamment)
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.style.overscrollBehavior = 'none'
    return () => {
      document.body.style.overflow = prev
      document.body.style.overscrollBehavior = ''
    }
  }, [])

  // Géolocalisation au démarrage
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      })
    }
  }, [])

  // Zoom auto sur le segment actif
  useEffect(() => {
    if (phase !== 'results' || !results[activeIdx] || !mapRef.current) return
    const bounds = results[activeIdx].coords.map(c => [c.lat, c.lon])
    mapRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 })
  }, [activeIdx, phase, results])

  const handleMapClick = (latlng) => {
    if (phase === 'idle' || phase === 'placed') {
      setCenter(latlng)
      setPhase('placed')
    }
  }

  const handleSearch = () => {
    if (!center) return
    setActiveIdx(0)
    search(center)
  }

  const handleReset = () => {
    reset()
    setPhase('placed')
    setActiveIdx(0)
  }

  const handlePolylineClick = (e, i) => {
    L.DomEvent.stopPropagation(e)
    setActiveIdx(i)
  }

  const isMapClickable = phase === 'idle' || phase === 'placed'

  return (
    <Box sx={{ height: '100dvh', width: '100%', position: 'relative', overflow: 'hidden' }}>

      {/* ── CARTE ── */}
      {center ? (
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
          ref={mapRef}
          zoomControl={false}
        >
          <TileLayer
            url={dark
              ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
              : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
            }
            attribution="© OpenStreetMap © Carto"
          />
          <MapClickHandler onMapClick={handleMapClick} disabled={!isMapClickable} onMove={() => setMapMoved(true)}/>

          {/* Pin centre */}
          <Marker position={[center.lat, center.lng]} icon={centerIcon} />

          {/* Cercle rayon */}
          {(phase === 'placed' || phase === 'searching') && (
            <Circle
              center={[center.lat, center.lng]}
              radius={params.radius}
              pathOptions={{ color: '#3d6b51', fillColor: '#3d6b51', fillOpacity: 0.05, weight: 1, dashArray: '6,6' }}
            />
          )}

          {/* Segments */}
          {results.map((r, i) => (
            <Polyline
              key={i}
              positions={r.coords.map(c => [c.lat, c.lon])}
              pathOptions={{
                color: slopeColor(parseFloat(r.slope)),
                weight: activeIdx === i ? 6 : 4,
                opacity: activeIdx === i ? 1 : 0.3,
              }}
              eventHandlers={{ click: (e) => handlePolylineClick(e, i) }}
            />
          ))}
        </MapContainer>
      ) : (
        <Box sx={{ height: '100%', bgcolor: 'background.default' }} />
      )}

      {/* ── TOP BAR ── */}
      <Box sx={{
        position: 'absolute', top: 16, left: 0, right: 0,
        zIndex: 1001,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        px: 2,
        pointerEvents: 'none',
      }}>
        <IconButton
          onClick={() => navigate('/')}
          sx={{
            bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`,
            boxShadow: 1, width: 36, height: 36, padding: 0,
            pointerEvents: 'all',
            '& .MuiSvgIcon-root': { fontSize: 18 },
          }}
        >
          <ArrowBack />
        </IconButton>

        <Box sx={{
          bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`,
          borderRadius: 6, px: 2, py: 0.75,
          pointerEvents: 'none',
        }}>
          <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '1rem' }}>
            Côtes<em>.Run</em>
          </Typography>
        </Box>

        <IconButton
          onClick={() => setDark(!dark)}
          sx={{
            bgcolor: 'background.paper', border: `1px solid ${theme.palette.divider}`,
            boxShadow: 1, width: 36, height: 36, padding: 0,
            pointerEvents: 'all',
            '& .MuiSvgIcon-root': { fontSize: 18 },
          }}
        >
          {dark ? <LightMode /> : <DarkMode />}
        </IconButton>
      </Box>

      {/* ── HELPER idle ── */}
      {phase === 'idle' && !mapMoved && (
        <Box sx={{
          position: 'absolute', top: '45%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 1001, pointerEvents: 'none',
          bgcolor: 'background.paper',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 2, px: 2, py: 1,
          boxShadow: 2,
        }}>
          <Typography variant="caption" color="text.secondary">
            Appuie sur la carte pour commencer
          </Typography>
        </Box>
      )}

      {/* ── LOADER overlay ── */}
      {phase === 'searching' && (
        <Box sx={{
          position: 'absolute', inset: 0, zIndex: 1002,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          bgcolor: 'rgba(0,0,0,0.35)',
          pointerEvents: 'none',
          gap: 2,
        }}>
          <CircularProgress sx={{ color: '#fff' }} size={44} />
          <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
            {status}
          </Typography>
        </Box>
      )}

      {/* ── RESULT CARD ── */}
      {phase === 'results' && results.length > 0 && (
        <ResultCard
          results={results}
          activeIdx={activeIdx}
          setActiveIdx={setActiveIdx}
        />
      )}

      {/* ── BOTTOM BAR ── */}
      <BottomBar
        phase={phase}
        center={center}
        onSearch={handleSearch}
        onCancel={cancel}
        onReset={handleReset}
        onFilterOpen={() => setFilterOpen(true)}
        hasCustomParams={hasCustomParams}
      />

      {/* ── FILTER DIALOG ── */}
      <FilterDialog
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        params={params}
        setParam={setParam}
      />

    </Box>
  )
}

export default CotesRun