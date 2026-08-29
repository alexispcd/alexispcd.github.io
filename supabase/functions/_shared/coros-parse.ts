/**
 * Parseurs des sorties textuelles des outils Coros.
 *
 * Contrairement a queryActivityLapData qui renvoie du JSON, ces deux outils
 * renvoient du texte preformate pour un lecteur humain. Chaque outil a son
 * parseur dedie : un parseur generique "cle: valeur" casserait sur les lignes
 * composites du type "Duration: 57:37 | Distance: 10.85 km".
 *
 * Principe general : ECHEC BRUYANT. Un champ attendu absent ou illisible leve
 * une Error qui le nomme, jamais une valeur de remplacement. Le format Coros
 * peut changer sans preavis et on veut le savoir plutot que de propager des
 * donnees fausses. Seule exception : avg_hr, legitimement absent sur certaines
 * activites, vaut null.
 */

// ── Bilan de forme ───────────────────────────────────────────────────────────

export interface FitnessOverview {
  vo2max: number
  running_level: string
  threshold_pace: string
  predictions: { five_k: string; ten_k: string; half: string; marathon: string }
}

/** Lit une ligne "Libelle: valeur" ancree en debut de ligne. Leve si absente. */
function requireLine(text: string, label: string, field: string): string {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = text.match(new RegExp(`^${escaped}:[ \\t]*([^\\n]+?)[ \\t]*$`, "m"))
  if (!match) throw new Error(`Format Coros inattendu : champ ${field} introuvable`)
  return match[1]
}

export function parseFitnessOverview(text: string): FitnessOverview {
  const rawVo2 = requireLine(text, "VO2max", "vo2max")
  const vo2max = Number(rawVo2)
  if (!Number.isFinite(vo2max)) {
    throw new Error(`Format Coros inattendu : champ vo2max illisible (${rawVo2})`)
  }

  return {
    vo2max,
    running_level: requireLine(text, "Running Level", "running_level"),
    threshold_pace: requireLine(text, "Threshold Pace", "threshold_pace"),
    predictions: {
      five_k: requireLine(text, "5 km Prediction", "predictions.five_k"),
      ten_k: requireLine(text, "10 km Prediction", "predictions.ten_k"),
      half: requireLine(text, "Half Marathon Prediction", "predictions.half"),
      marathon: requireLine(text, "Marathon Prediction", "predictions.marathon"),
    },
  }
}

// ── Historique de seances ────────────────────────────────────────────────────

export interface SportRecord {
  labelId: string
  date: string
  startTimestamp: number | null
  sport_type: number | null
  distance_m: number | null
  duration_sec: number | null
  avg_hr: number | null
}

/** Debut d'un enregistrement numerote : "3. Outdoor Run ... 2026-08-25". */
const RECORD_START = /^\s*\d+\.\s+\S/
/** Nombre d'enregistrements annonce par l'en-tete : "(6 records)". */
const ANNOUNCED_COUNT = /\((\d+)\s+records?\)/

/**
 * "57:37" ou "1:04:21" vers un nombre de secondes. Le format bascule de mm:ss a
 * h:mm:ss des que la seance depasse l'heure.
 */
function parseDuration(raw: string, index: number): number {
  const parts = raw.split(":")
  if (parts.length !== 2 && parts.length !== 3) {
    throw new Error(`Format Coros inattendu : champ duration illisible sur l'enregistrement ${index} (${raw})`)
  }
  let total = 0
  for (const part of parts) {
    const n = Number(part)
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`Format Coros inattendu : champ duration illisible sur l'enregistrement ${index} (${raw})`)
    }
    total = total * 60 + n
  }
  return total
}

/** Capture obligatoire dans un enregistrement. Leve en nommant le champ. */
function requireIn(block: string, re: RegExp, field: string, index: number): string {
  const match = block.match(re)
  if (!match) {
    throw new Error(`Format Coros inattendu : champ ${field} introuvable sur l'enregistrement ${index}`)
  }
  return match[1]
}

function parseRecord(block: string, index: number): SportRecord {
  // La date est en fin de ligne de titre. On l'ancre sur son motif plutot que
  // sur le separateur, qui est un caractere unicode fragile.
  const date = requireIn(block, /(\d{4}-\d{2}-\d{2})[ \t]*$/m, "date", index)
  const labelId = requireIn(block, /LabelId:[ \t]*(\d+)/, "labelId", index)
  const sportType = requireIn(block, /SportType:[ \t]*(\d+)/, "sport_type", index)

  // PIEGE : Coros donne startTimestamp en SECONDES (dix chiffres) alors que
  // toute la chaine en aval attend des millisecondes. Sans cette
  // multiplication les seances atterrissent en 1970, sans lever d'exception.
  const startSec = requireIn(block, /startTimestamp=(\d+)/, "startTimestamp", index)

  const distanceKm = requireIn(block, /Distance:[ \t]*([\d.]+)[ \t]*km/, "distance_m", index)
  const distance = Number(distanceKm)
  if (!Number.isFinite(distance)) {
    throw new Error(`Format Coros inattendu : champ distance_m illisible sur l'enregistrement ${index} (${distanceKm})`)
  }

  const duration = requireIn(block, /Duration:[ \t]*([\d:]+)/, "duration_sec", index)

  // Seul champ optionnel : absent sur les activites enregistrees sans cardio.
  const hrMatch = block.match(/Avg HR:[ \t]*(\d+)[ \t]*bpm/)

  return {
    labelId,
    date,
    startTimestamp: Number(startSec) * 1000,
    sport_type: Number(sportType),
    // La source arrondit deja au centieme de kilometre, la precision perdue
    // ne se rattrape pas.
    distance_m: Math.round(distance * 1000),
    duration_sec: parseDuration(duration, index),
    avg_hr: hrMatch ? Number(hrMatch[1]) : null,
  }
}

export function parseSportRecords(text: string): SportRecord[] {
  const lines = text.split("\n")
  const starts: number[] = []
  lines.forEach((line, i) => {
    if (RECORD_START.test(line)) starts.push(i)
  })

  if (starts.length === 0) {
    // Zero resultat est un cas normal, mais il faut le distinguer d'un format
    // devenu illisible : seul un en-tete annoncant explicitement 0 le prouve.
    const announced = text.match(ANNOUNCED_COUNT)
    if (announced && Number(announced[1]) === 0) return []
    throw new Error("Format Coros inattendu : aucun enregistrement lisible et aucun en-tete annoncant zero resultat")
  }

  return starts.map((start, i) => {
    const end = i + 1 < starts.length ? starts[i + 1] : lines.length
    return parseRecord(lines.slice(start, end).join("\n"), i + 1)
  })
}
