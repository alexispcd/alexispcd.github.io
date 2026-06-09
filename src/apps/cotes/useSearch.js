import { useState, useRef, useCallback } from 'react'
import { pathLen, samplePath, DEFAULT_PARAMS } from './utils'

const fetchWays = async (lat, lon, radius, signal) => {
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
    signal,
  })
  const data = await res.json()
  return data.elements || []
}

const fetchElevations = async (points, signal) => {
  const BATCH = 500
  const results = []
  for (let i = 0; i < points.length; i += BATCH) {
    const batch = points.slice(i, i + BATCH)
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      const res = await fetch('https://elevation.racemap.com/api/v1/elevations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch.map(p => [p.lat, p.lon])),
        signal,
      })
      const data = await res.json()
      if (Array.isArray(data)) results.push(...data.map(e => e ?? 0))
      else results.push(...batch.map(() => 0))
    } catch (e) {
      if (e.name === 'AbortError') throw e
      results.push(...batch.map(() => 0))
    }
  }
  return results
}

export const useSearch = () => {
  const [phase, setPhase] = useState('idle') // idle | placed | searching | results
  const [status, setStatus] = useState('')
  const [results, setResults] = useState([])
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [toast, setToast] = useState(null) // { message, severity }
  const abortRef = useRef(null)

  const setParam = (key, val) => setParams(p => ({ ...p, [key]: val }))

  const hasCustomParams = Object.keys(DEFAULT_PARAMS).some(k => params[k] !== DEFAULT_PARAMS[k])

  const search = useCallback(async (center) => {
    abortRef.current = new AbortController()
    const { signal } = abortRef.current
    setPhase('searching')
    setResults([])
    setToast(null)

    try {
      setStatus('Récupération des voies OSM...')
      const ways = await fetchWays(center.lat, center.lng, params.radius, signal)

      const valid = []
      for (const w of ways) {
        if (!w.geometry || w.geometry.length < 2) continue
        const len = pathLen(w.geometry)
        if (len < params.minLen) continue
        const samples = samplePath(w.geometry, Math.min(5, w.geometry.length))
        valid.push({ w, coords: w.geometry, len, samples })
      }

      if (!valid.length) {
        setToast({ message: 'Aucune voie trouvée dans ce périmètre.', severity: 'info' })
        setPhase('placed')
        setStatus('')
        return
      }

      const batches = Math.ceil(valid.reduce((s, v) => s + v.samples.length, 0) / 500)
      setStatus(`Altitudes (${batches} requête${batches > 1 ? 's' : ''})...`)

      const allPoints = valid.flatMap(v => v.samples)
      const elevs = await fetchElevations(allPoints, signal)

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

        if (maxGain < params.minElev || maxGain > params.maxElev) continue
        const frac = (bestJ - bestI) / (wElevs.length - 1)
        const hillLen = len * frac
        if (hillLen < params.minLen || hillLen > params.maxLen) continue
        const slope = hillLen > 0 ? (maxGain / hillLen * 100) : 0
        if (slope < params.minSlope || slope > params.maxSlope) continue

        const si = Math.round(bestI * (coords.length - 1) / (samples.length - 1))
        const ei = Math.round(bestJ * (coords.length - 1) / (samples.length - 1))

        found.push({
          name: w.tags?.name || w.tags?.ref || `Voie #${w.id}`,
          len: Math.round(hillLen),
          gain: Math.round(maxGain),
          slope: slope.toFixed(1),
          coords: coords.slice(si, ei + 1),
        })
      }

      found.sort((a, b) => b.slope - a.slope)
      if (!found.length) {
        setToast({ message: 'Aucune côte trouvée. Essaie d\'élargir les filtres.', severity: 'info' })
        setPhase('placed')
        setStatus('')
        return
      }
      setResults(found)
      setPhase('results')
      setStatus('')
    } catch (e) {
      if (e.name === 'AbortError') {
        setPhase('placed')
        setStatus('')
      } else {
        setToast({ message: 'Erreur réseau, réessaie.', severity: 'error' })
        setPhase('placed')
        setStatus('')
      }
    }
  }, [params])

  const cancel = () => {
    abortRef.current?.abort()
  }

  const reset = () => {
    abortRef.current?.abort()
    setPhase('idle')
    setResults([])
    setStatus('')
  }

  const clearToast = () => setToast(null)

  return { phase, setPhase, status, results, params, setParam, hasCustomParams, search, cancel, reset, toast, clearToast }
}