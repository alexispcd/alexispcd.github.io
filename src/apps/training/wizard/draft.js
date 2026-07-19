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
