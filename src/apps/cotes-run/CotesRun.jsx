import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, useMapEvents, Circle, Polyline, Marker, Popup } from 'react-leaflet'
import {
  Box, Typography, Slider, Button, List, ListItem, ListItemText,
  Chip, IconButton, Tooltip, SwipeableDrawer, useMediaQuery, CircularProgress 
} from '@mui/material'
import { ArrowBack, LightMode, DarkMode, FileDownload, Tune } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '@mui/material/styles'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const centerIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#3d6b51;border:2px solid #fff;border-radius:50%;box-shadow:0 0 0 4px rgba(61,107,81,.2)"></div>`,
  className: '',
  iconAnchor: [7, 7],
})

const haversine = (la1, lo1, la2, lo2) => {
  const R = 6371000
  const dLa = (la2 - la1) * Math.PI / 180
  const dLo = (lo2 - lo1) * Math.PI / 180
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const pathLen = (coords) => {
  let d = 0
  for (let i = 1; i < coords.length; i++)
    d += haversine(coords[i - 1].lat, coords[i - 1].lon, coords[i].lat, coords[i].lon)
  return d
}

const samplePath = (coords, n) => {
  if (coords.length <= n) return coords
  return Array.from({ length: n }, (_, i) => coords[Math.round(i * (coords.length - 1) / (n - 1))])
}

const slopeColor = (s) => {
  if (s >= 8) return '#ff6b6b'
  if (s >= 5) return '#ffd166'
  if (s >= 4) return '#06d6a0'
  return '#4ecdc4'
}

const fetchWays = async (lat, lon, radius) => {
  const r = radius / 111320
  const cosLat = Math.cos(lat * Math.PI / 180)
  const bbox = [
    (lat - r).toFixed(5),
    (lon - r / cosLat).toFixed(5),
    (lat + r).toFixed(5),
    (lon + r / cosLat).toFixed(5),
  ].join(',')
  const highways = 'primary|secondary|tertiary|residential|unclassified|living_street|service|track|path|footway|cycleway'
  const q = `[out:json][timeout:30];way["highway"~"^(${highways})$"](${bbox});out geom;`
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: 'data=' + encodeURIComponent(q),
  })
  const data = await res.json()
  return data.elements || []
}

const fetchElevations = async (points) => {
  const BATCH = 100
  const results = []

  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH)
    if (i > 0) await new Promise(r => setTimeout(r, 1500))

    try {
      const res = await fetch('https://api.open-elevation.com/api/v1/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locations: batch.map(p => ({ latitude: p.lat, longitude: p.lon })) }),
      })
      const data = await res.json()
      if (data.results) results.push(...data.results.map(r => r.elevation ?? 0))
      else results.push(...batch.map(() => 0))
    } catch {
      results.push(...batch.map(() => 0))
    }
  }
  return results
}

const MapClickHandler = ({ onMapClick, disabled }) => {
  useMapEvents({
    click: (e) => {
      if (!disabled && e.originalEvent.target.tagName === 'path') return
      if (!disabled) onMapClick(e.latlng)
    }
  })
  return null
}
const SLIDERS = [
  { key: 'radius',   label: 'Rayon',        min: 500,  max: 5000, step: 250, fmt: v => `${(v/1000).toFixed(1)} km` },
  { key: 'minElev',  label: 'Dénivelé min', min: 5,    max: 100,  step: 5,   fmt: v => `${v} m` },
  { key: 'minSlope', label: 'Pente min',    min: 2,    max: 15,   step: 1,   fmt: v => `${v} %` },
  { key: 'minLen',   label: 'Longueur min', min: 50,   max: 1000, step: 50,  fmt: v => `${v} m` },
]

const CotesRun = ({ dark, setDark }) => {
  const theme = useTheme()
  const navigate = useNavigate()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [sheetOpen, setSheetOpen] = useState(false)

  const [center, setCenter] = useState(null)
  const [params, setParams] = useState({ radius: 1500, minElev: 20, minSlope: 4, minLen: 100 })
  const [status, setStatus] = useState('Clique sur la carte pour placer ton point de départ')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [activeIdx, setActiveIdx] = useState(null)

  const mapRef = useRef(null)

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      })
    }
  }, [])

  const setParam = (key, val) => setParams(p => ({ ...p, [key]: val }))

  const handleSearch = async () => {
    if (!center) return
    setLoading(true)
    setResults([])
    setActiveIdx(null)
    if (isMobile) setSheetOpen(true)

    try {
      setStatus('Récupération des voies OSM...')
      const ways = await fetchWays(center.lat, center.lng, params.radius)

      const valid = []
      for (const w of ways) {
        if (!w.geometry || w.geometry.length < 2) continue
        const len = pathLen(w.geometry)
        if (len < params.minLen) continue
        const samples = samplePath(w.geometry, Math.min(9, w.geometry.length))
        valid.push({ w, coords: w.geometry, len, samples })
      }

      if (!valid.length) {
        setStatus('Aucune voie valide — essaie un rayon plus grand')
        setLoading(false)
        return
      }

      const batches = Math.ceil(valid.reduce((s, v) => s + v.samples.length, 0) / 100)
      setStatus(`Récupération altitudes (${batches} requête${batches > 1 ? 's' : ''})...`)

      const allPoints = valid.flatMap(v => v.samples)
      const elevs = await fetchElevations(allPoints)

      const found = []
      let idx = 0
      for (const { w, coords, len, samples } of valid) {
        const wElevs = elevs.slice(idx, idx + samples.length)
        idx += samples.length

        let maxGain = 0, bestI = 0, bestJ = wElevs.length - 1
        for (let i = 0; i < wElevs.length - 1; i++) {
          for (let j = i + 1; j < wElevs.length; j++) {
            const gain = wElevs[j] - wElevs[i]
            if (gain > maxGain) { maxGain = gain; bestI = i; bestJ = j }
          }
        }

        if (maxGain < params.minElev) continue
        const frac = (bestJ - bestI) / (wElevs.length - 1)
        const hillLen = len * frac
        if (hillLen < params.minLen) continue
        const slope = hillLen > 0 ? (maxGain / hillLen * 100) : 0
        if (slope < params.minSlope) continue

        const si = Math.round(bestI * (coords.length - 1) / (samples.length - 1))
        const ei = Math.round(bestJ * (coords.length - 1) / (samples.length - 1))

        found.push({
          name: w.tags?.name || w.tags?.ref || `Voie #${w.id}`,
          len: Math.round(hillLen),
          gain: Math.round(maxGain),
          slope: slope.toFixed(1),
          coords: coords.slice(si, ei + 1),
          fullCoords: coords,
        })
      }

      found.sort((a, b) => b.slope - a.slope)
      setResults(found)
      setStatus(`${found.length} côte${found.length > 1 ? 's' : ''} trouvée${found.length > 1 ? 's' : ''}`)
    } catch (e) {
      setStatus('Erreur : ' + e.message)
    }

    setLoading(false)
  }

  const exportGPX = () => {
    const trks = results.map(r => `
  <trk>
    <name>${r.name}</name>
    <trkseg>
      ${r.coords.map(c => `<trkpt lat="${c.lat}" lon="${c.lon}"></trkpt>`).join('\n')}
    </trkseg>
  </trk>`).join('\n')
    const gpx = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Le Cairn">\n${trks}\n</gpx>`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([gpx], { type: 'application/gpx+xml' }))
    a.download = 'cotes-running.gpx'
    a.click()
  }

  // ── Contenu partagé sidebar/sheet ──
  const SlidersBlock = () => (
    <Box sx={{ p: 2 }}>
      {SLIDERS.map(({ key, label, min, max, step, fmt }) => (
        <Box key={key} sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</Typography>
            <Typography variant="caption" color="primary" fontWeight={600}>{fmt(params[key])}</Typography>
          </Box>
          <Slider disabled={loading} value={params[key]} onChange={(_, v) => setParam(key, v)} min={min} max={max} step={step} size="small" />
        </Box>
      ))}
      <Button fullWidth variant="contained" onClick={handleSearch} disabled={loading || !center} sx={{ mt: 1 }}>
        {loading ? 'Recherche...' : 'Rechercher'}
      </Button>
    </Box>
  )

  const ResultsList = ({ mapRef }) => (
    <List sx={{ p: 1 }}>
      {results.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 3 }}>
          <Typography variant="caption" color="text.secondary">Lance une recherche pour voir les côtes</Typography>
        </Box>
      )}
      {results.map((r, i) => (
        <ListItem
          key={i}
          onClick={() => {
            setActiveIdx(i)
            if (isMobile) setSheetOpen(false)
            if (mapRef.current) {
              const bounds = r.coords.map(c => [c.lat, c.lon])
              mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 })
            }
          }}
          sx={{
            borderRadius: 2, mb: 0.5, cursor: 'pointer', border: '1px solid',
            borderColor: activeIdx === i ? 'primary.main' : 'divider',
            bgcolor: activeIdx === i ? 'action.selected' : 'background.paper',
            '&:hover': { borderColor: 'primary.main' },
          }}
        >
          <ListItemText
            primary={<Typography variant="body2" fontWeight={600} noWrap>{i + 1}. {r.name}</Typography>}
            secondary={
              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                <Chip label={`▲ ${r.slope}%`} size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: slopeColor(parseFloat(r.slope)) + '33', color: slopeColor(parseFloat(r.slope)) }} />
                <Chip label={`↕ ${r.gain}m`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                <Chip label={`⟷ ${r.len}m`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
              </Box>
            }
          />
        </ListItem>
      ))}
    </List>
  )

  const Legend = () => (
    <Box sx={{ p: 1.5, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
      {[['#ff6b6b', '≥8%'], ['#ffd166', '5–8%'], ['#06d6a0', '4–5%'], ['#4ecdc4', '<4%']].map(([c, l]) => (
        <Box key={l} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 12, height: 4, borderRadius: 1, bgcolor: c }} />
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>{l}</Typography>
        </Box>
      ))}
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', height: '100dvh', overflow: 'hidden', position: 'relative' }}>

      {/* ── SIDEBAR desktop ── */}
      {!isMobile && (
        <Box sx={{
          width: 300, minWidth: 300,
          display: 'flex', flexDirection: 'column',
          borderRight: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
        }}>
          <Box sx={{ p: 2, borderBottom: `1px solid ${theme.palette.divider}`, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Accueil">
              <IconButton size="small" onClick={() => navigate('/')}><ArrowBack fontSize="small" /></IconButton>
            </Tooltip>
            <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '1.2rem', flex: 1 }}>
              Côtes<em>.Run</em>
            </Typography>
            <Tooltip title={dark ? 'Mode clair' : 'Mode sombre'}>
              <IconButton size="small" onClick={() => setDark(!dark)}>
                {dark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>

          <SlidersBlock />

          <Box sx={{ px: 2, py: 1, borderTop: `1px solid ${theme.palette.divider}`, borderBottom: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
            <Typography variant="caption" color="text.secondary">{status}</Typography>
          </Box>

          {results.length > 0 && (
            <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Button size="small" startIcon={<FileDownload />} onClick={exportGPX} fullWidth>Exporter GPX</Button>
            </Box>
          )}

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <ResultsList mapRef={mapRef} />
          </Box>

          <Legend />
        </Box>
      )}

      {/* ── MAP ── */}
      <Box sx={{ flex: 1, position: 'relative' }}>
        {loading && (
          <Box sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(0,0,0,0.35)',
            gap: 2,
          }}>
            <CircularProgress sx={{ color: '#3d6b51' }} size={48} />
            <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
              {status}
            </Typography>
          </Box>
        )}

        {/* Boutons flottants mobile */}
        {isMobile && (
          <Box sx={{ position: 'absolute', top: 16, left: 0, right: 0, zIndex: 1001, display: 'flex', justifyContent: 'space-between', px: 2 }}>
            <IconButton
              onClick={() => navigate('/')}
              sx={{
                bgcolor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: 1,
                width: 36,
                height: 36,
                padding: 0,
                '& .MuiSvgIcon-root': { fontSize: 18 }
              }}
            >
              <ArrowBack />
            </IconButton>

            <Box sx={{
              bgcolor: 'background.paper',
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 6,
              px: 2, py: 0.75,
              display: 'flex', alignItems: 'center',
            }}>
              <Typography sx={{ fontFamily: '"DM Serif Display", serif', fontSize: '1rem' }}>
                Côtes<em>.Run</em>
              </Typography>
            </Box>

            <IconButton
              onClick={() => setDark(!dark)}
              sx={{
                bgcolor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                boxShadow: 1,
                width: 36,
                height: 36,
                padding: 0,
                '& .MuiSvgIcon-root': { fontSize: 18 }
              }}
            >
              {dark ? <LightMode /> : <DarkMode />}
            </IconButton>
          </Box>
        )}

        {center ? (
          <MapContainer
            center={[center.lat, center.lng]}
            zoom={14}
            style={{ height: '100%', width: '100%' }}
            ref={mapRef}
          >
            <TileLayer
              url={dark
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
              }
              attribution="© OpenStreetMap © Carto"
            />
            <MapClickHandler onMapClick={setCenter} disabled={loading} />
            <Marker position={[center.lat, center.lng]} icon={centerIcon} />
            <Circle
              center={[center.lat, center.lng]}
              radius={params.radius}
              pathOptions={{ color: '#3d6b51', fillColor: '#3d6b51', fillOpacity: 0.05, weight: 1, dashArray: '6,6' }}
            />
            {results.map((r, i) => (
              <Polyline
                key={i}
                positions={r.coords.map(c => [c.lat, c.lon])}
                pathOptions={{ color: slopeColor(parseFloat(r.slope)), weight: activeIdx === i ? 7 : 5, opacity: 0.9 }}
                eventHandlers={{
                  click: (e) => {
                    L.DomEvent.stopPropagation(e)
                    setActiveIdx(i)
                  }
                }}
              >
                <Popup>{r.name}<br />▲ {r.slope}% · ↕ {r.gain}m · ⟷ {r.len}m</Popup>
              </Polyline>
            ))}
          </MapContainer>
        ) : (
          <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
            <Typography>Autorise la géolocalisation ou clique sur la carte</Typography>
          </Box>
        )}
      </Box>

      {/* ── BOTTOM SHEET mobile ── */}
      {isMobile && (
        <>
          {/* FAB Rechercher */}
          {!sheetOpen && (
            <Box sx={{ position: 'absolute', bottom: 90, right: 16, zIndex: 1000 }}>
              <Button
                variant="contained"
                startIcon={<Tune />}
                onClick={() => setSheetOpen(true)}
                sx={{ borderRadius: 6, boxShadow: 3 }}
              >
                Régler
              </Button>
            </Box>
          )}

        <SwipeableDrawer
          anchor="bottom"
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          onOpen={() => setSheetOpen(true)}
          disableSwipeToOpen={false}
          swipeAreaWidth={56}
          sx={{
            '& .MuiDrawer-paper': {
              borderRadius: '20px 20px 0 0',
              maxHeight: '75dvh',
              overflow: 'auto',
            },
          }}
        >
            {/* Handle */}
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5, cursor: 'pointer' }} onClick={() => setSheetOpen(false)}>
              <Box sx={{ width: 36, height: 4, bgcolor: 'divider', borderRadius: 2 }} />
            </Box>

            {/* Peek row */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pb: 1 }}>
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {results.length > 0 ? `${results.length} côte${results.length > 1 ? 's' : ''} trouvée${results.length > 1 ? 's' : ''}` : 'Paramètres'}
                </Typography>
                <Typography variant="caption" color="text.secondary">{status}</Typography>
              </Box>
              {results.length > 0 && (
                <Button size="small" startIcon={<FileDownload />} onClick={exportGPX}>GPX</Button>
              )}
            </Box>

            <SlidersBlock />

            {results.length > 0 && (
              <>
                <Box sx={{ px: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Résultats
                  </Typography>
                </Box>
                <ResultsList mapRef={mapRef} />
                <Legend />
              </>
            )}
          </SwipeableDrawer>
        </>
      )}
    </Box>
  )
}

export default CotesRun