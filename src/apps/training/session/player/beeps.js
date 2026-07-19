// Bips du player renfo.
//
// Le Web Audio est coupé par le switch silencieux de l'iPhone : une séance
// renfo se fait souvent téléphone en mode silencieux, les bips de fin de chrono
// passaient donc à la trappe. Les HTMLAudioElement, eux, sont traités comme de
// la lecture média et restent audibles.
//
// Les deux sons sont synthétisés ici en WAV PCM et embarqués en data URI : pas
// de fichier à charger, pas de requête réseau, donc pas de latence au premier
// bip.

const SAMPLE_RATE = 8000 // 880 Hz reste très en dessous de Nyquist (4 kHz)
const AMPLITUDE = 0.6
const FADE_SAMPLES = 80 // fondu d'entrée/sortie : évite le clic de bord

/**
 * Encode une suite de segments en WAV mono 16 bits (data URI base64).
 * Chaque segment est soit un bip (`freq` en Hz), soit un silence (`freq: 0`).
 */
const wavDataUri = (segments) => {
  const lengths = segments.map((s) => Math.round((s.ms * SAMPLE_RATE) / 1000))
  const total = lengths.reduce((n, l) => n + l, 0)

  const buffer = new ArrayBuffer(44 + total * 2)
  const view = new DataView(buffer)
  const ascii = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  // En-tête RIFF/WAVE.
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + total * 2, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)       // taille du bloc fmt
  view.setUint16(20, 1, true)        // PCM
  view.setUint16(22, 1, true)        // mono
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true) // octets par seconde
  view.setUint16(32, 2, true)        // alignement bloc
  view.setUint16(34, 16, true)       // bits par échantillon
  ascii(36, 'data')
  view.setUint32(40, total * 2, true)

  let i = 0
  segments.forEach((seg, s) => {
    const len = lengths[s]
    for (let n = 0; n < len; n++, i++) {
      const fade = Math.min(1, n / FADE_SAMPLES, (len - n) / FADE_SAMPLES)
      const value = seg.freq
        ? Math.sin((2 * Math.PI * seg.freq * n) / SAMPLE_RATE) * fade * AMPLITUDE
        : 0
      view.setInt16(44 + i * 2, Math.round(value * 32767), true)
    }
  })

  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let n = 0; n < bytes.length; n++) binary += String.fromCharCode(bytes[n])
  return `data:audio/wav;base64,${btoa(binary)}`
}

const SINGLE = wavDataUri([{ freq: 880, ms: 150 }])
const DOUBLE = wavDataUri([{ freq: 880, ms: 150 }, { freq: 0, ms: 90 }, { freq: 880, ms: 150 }])

/**
 * Crée la paire de sons du player.
 *
 * `unlock()` DOIT être appelé dans le geste utilisateur qui ouvre le player
 * (contrainte iOS) : il joue les deux éléments à volume nul pour les autoriser,
 * ce qui rend les lectures ultérieures possibles hors interaction.
 */
export const createBeeps = () => {
  const single = new Audio(SINGLE)
  const double = new Audio(DOUBLE)
  const all = [single, double]
  for (const el of all) {
    el.preload = 'auto'
    el.load()
  }

  return {
    unlock() {
      for (const el of all) {
        el.volume = 0
        el.play()
          .then(() => { el.pause(); el.currentTime = 0; el.volume = 1 })
          .catch(() => { el.volume = 1 })
      }
    },
    /** @param {'single'|'double'} kind */
    play(kind) {
      const el = kind === 'double' ? double : single
      el.currentTime = 0
      el.play().catch(() => { /* lecture refusée : on n'insiste pas */ })
    },
    dispose() {
      for (const el of all) { el.pause(); el.src = '' }
    },
  }
}
