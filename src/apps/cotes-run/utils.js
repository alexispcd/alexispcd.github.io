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
  minElev: 20,  maxElev: 150,
  minSlope: 4,  maxSlope: 20,
  minLen: 100,  maxLen: 3000,
}

export const SLIDERS = [
  {
    key: 'radius', label: 'Rayon', range: false,
    min: 500, max: 5000, step: 250,
    fmt: v => `${(v / 1000).toFixed(1)} km`,
  },
  {
    key: 'elev', label: 'Dénivelé', range: true,
    minKey: 'minElev', maxKey: 'maxElev',
    min: 5, max: 200, step: 5,
    fmt: v => `${v} m`,
  },
  {
    key: 'slope', label: 'Pente', range: true,
    minKey: 'minSlope', maxKey: 'maxSlope',
    min: 1, max: 20, step: 1,
    fmt: v => `${v}%`,
  },
  {
    key: 'len', label: 'Longueur', range: true,
    minKey: 'minLen', maxKey: 'maxLen',
    min: 50, max: 1500, step: 50,
    fmt: v => v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${v} m`,
  },
]