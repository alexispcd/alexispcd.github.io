// Helpers purs sur le brouillon du wizard (hors composants pour le fast-refresh).

/** Distance résolue en mètres depuis le brouillon (0 si indéfinie). */
export const resolveDistanceM = (d) =>
  d.distancePreset === 'custom'
    ? Number(d.distanceCustomM) || 0
    : (d.distancePreset ?? 0)

// Date CALENDAIRE locale. toISOString() convertirait minuit local en UTC et
// reculerait d'un jour à l'est de Greenwich (Europe/Paris) : aujourd'hui serait
// envoyé comme hier et rejeté par generate-plan.
const toISO = (date) => {
  const x = new Date(date)
  const pad = (n) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

/** Date d'aujourd'hui (ISO, minuit local). */
export const todayISODate = () => toISO(new Date())

/** Prochain lundi (ISO). Si aujourd'hui est lundi, renvoie lundi prochain (+7). */
export const nextMondayISO = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const delta = ((8 - d.getDay()) % 7) || 7 // getDay: 0=dim..6=sam ; lundi=1
  d.setDate(d.getDate() + delta)
  return toISO(d)
}

/**
 * Date de début d'entraînement résolue depuis le choix du wizard.
 * 'today' → aujourd'hui, 'monday' → lundi prochain, 'custom' → date saisie.
 */
export const resolveStartDate = (d) => {
  if (d.startChoice === 'monday') return nextMondayISO()
  if (d.startChoice === 'custom') return d.startCustom || todayISODate()
  return todayISODate()
}

/** Brouillon vide de l'assistant. */
export const emptyDraft = {
  // Étape 1 : course
  name: '',
  date: '',
  distancePreset: null,   // 5000 | 10000 | 21097 | 42195 | 'custom'
  distanceCustomM: '',
  elevationM: '',
  startChoice: 'today',   // 'today' | 'monday' | 'custom'
  startCustom: '',        // ISO yyyy-MM-dd si 'custom'
  // Étape 2 : forme
  source: 'coros',        // 'coros' | 'manual'
  corosLoaded: false,
  vmaKmh: '',
  thresholdPace: '',      // "m:ss"
  vo2max: '',
  predictions: null,
  runningLevel: '',
  // Étape 3 : objectif
  goalSec: null,          // durée cible en secondes (sélecteur à roues)
  previousRaces: [],      // [{ name, time }]
  notes: '',
}

/**
 * Raison pour laquelle l'étape ne peut pas encore être validée (première condition
 * non remplie), null si elle l'est. Seule source des conditions : stepValid en dérive.
 */
export const stepRaison = (step, d) => {
  if (step === 0) {
    const today = todayISODate()
    if (!d.name.trim()) return 'Indique le nom de ta course.'
    if (!d.date || d.date <= today) return 'Choisis une date de course à venir.'
    if (!(resolveDistanceM(d) > 0)) return 'Indique la distance de ta course.'
    const start = resolveStartDate(d)
    if (!(start >= today && start <= d.date)) return 'Choisis un début entre aujourd\'hui et la course.'
    return null
  }
  if (step === 1) {
    const vma = Number(d.vmaKmh)
    if (Number.isNaN(vma) || vma < 10 || vma > 25) return 'Indique ta VMA, entre 10 et 25 km/h.'
    return null
  }
  return null
}

/** Validité de l'étape (contrôle le bouton Continuer). */
export const stepValid = (step, d) => stepRaison(step, d) === null
