export const haversine = (la1, lo1, la2, lo2) => {
  const R = 6371000
  const dLa = (la2 - la1) * Math.PI / 180
  const dLo = (lo2 - lo1) * Math.PI / 180
  const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * Math.PI / 180) * Math.cos(la2 * Math.PI / 180) * Math.sin(dLo / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const pathLen = (coords) => {
  let d = 0
  for (let i = 1; i < coords.length; i++)
    d += haversine(coords[i - 1].lat, coords[i - 1].lon, coords[i].lat, coords[i].lon)
  return d
}

export const samplePath = (coords, n) => {
  if (coords.length <= n) return coords
  return Array.from({ length: n }, (_, i) => coords[Math.round(i * (coords.length - 1) / (n - 1))])
}

export const slopeColor = (s) => {
  if (s >= 8) return '#ff6b6b'
  if (s >= 5) return '#ffd166'
  if (s >= 4) return '#06d6a0'
  return '#4ecdc4'
}

export const DEFAULT_PARAMS = {
  radius: 1500,
  minElev: 20,
  minSlope: 4,
  minLen: 100,
}

export const SLIDERS = [
  { key: 'radius',   label: 'Rayon de recherche', min: 500,  max: 5000, step: 250, fmt: v => `${(v/1000).toFixed(1)} km` },
  { key: 'minElev',  label: 'Dénivelé minimum',   min: 5,    max: 100,  step: 5,   fmt: v => `${v} m` },
  { key: 'minSlope', label: 'Pente minimum',       min: 2,    max: 15,   step: 1,   fmt: v => `${v} %` },
  { key: 'minLen',   label: 'Longueur minimum',    min: 50,   max: 1000, step: 50,  fmt: v => `${v} m` },
]

export const PRESETS = [
  { label: 'Doux',    params: { radius: 1000, minElev: 10, minSlope: 3, minLen: 50  } },
  { label: 'Modéré',  params: { radius: 1500, minElev: 20, minSlope: 5, minLen: 100 } },
  { label: 'Costaud', params: { radius: 2500, minElev: 40, minSlope: 7, minLen: 150 } },
]