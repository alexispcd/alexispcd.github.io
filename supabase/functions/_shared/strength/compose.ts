// Séances Renfo composées à la carte (lot R1) : préremplissage d'une composition,
// titre, contrôle de la composition et du choix du modèle, dosage des exercices,
// assemblage, ajustement et remplacement. Module pur, sans import Deno ni npm :
// il est aussi importé par le front.
//
// Le modèle choisit seulement les exercices (et l'élastique d'un exercice sans
// base) ; tout le reste est posé ici : dose, élastique, tours, repos, titre, durée.

import { type Anchor, EXERCISE_INDEX, type Exercise } from "./catalog.ts"
import { estimateSessionMinutes, supersetMembers } from "./estimate.ts"
import {
  COOLDOWN_ITEMS_MAX, COOLDOWN_ITEMS_MIN, type Dose, effectiveTrisetRules, type Group, GROUP_LABELS,
  GROUP_ORDER, groupOfFocus, type Intensity, INTENSITY_SUPERSETS, isCurrentTheme, isIntensity,
  ROUNDS_MAX, ROUNDS_MIN, type SessionBlock, type SessionContent, SUPERSET_EXERCISES_MAX,
  SUPERSET_EXERCISES_MIN, SUPERSET_REST_SEC, type SupersetBlock, SUPERSETS_MAX, SUPERSETS_MIN,
  THEMES_BY_GROUP, type TrisetFocus, type TrisetRequirement, WARMUP_EXTRAS, WARMUP_ITEMS_MAX,
  WARMUP_ITEMS_MIN,
} from "./rules.ts"

// ── Types ────────────────────────────────────────────────────────────────────

export interface CompositionSuperset {
  focus: TrisetFocus
  exercise_count: number
  rounds: number
}

export interface Composition {
  intensity: Intensity
  supersets: CompositionSuperset[]
}

/** Dernier réglage d'un exercice (strength_exercise_bases). */
export interface Base {
  reps?: number | null
  duration_sec?: number | null
  band_kg?: number | null
}

export type Bases = Record<string, Base>

/** Séance faite, telle que lue en base. */
export interface DoneSession {
  completed_at: string | null
  content: unknown
  status?: string
}

type Rec = Record<string, unknown>

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v)

const isIntIn = (v: unknown, min: number, max: number): boolean =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max

const blocksOf = (content: unknown): Rec[] => {
  const blocks = isRecord(content) ? content.blocks : null
  return Array.isArray(blocks) ? blocks.filter(isRecord) : []
}

/** Membres d'un superset lu en base (nouveau format ou a, b, c), sans slug écarté. */
const membersOf = (block: Rec): Dose[] =>
  supersetMembers(block as { exercises?: Dose[] }).filter((d) => isRecord(d) && typeof d.slug === "string")

/** Tous les exercices d'un bloc, dans l'ordre de jeu. */
const blockDoses = (block: Rec): Dose[] =>
  block.type === "superset"
    ? membersOf(block)
    : (Array.isArray(block.items) ? block.items : []).filter((d): d is Dose => isRecord(d) && typeof d.slug === "string")

const contentSlugs = (content: unknown): string[] => blocksOf(content).flatMap((b) => blockDoses(b).map((d) => d.slug))

const onBarAnchor = (exercise: Exercise | undefined): Anchor | null =>
  exercise && exercise.equipment.includes("bar") && exercise.anchor ? exercise.anchor : null

const timeOf = (iso: string | null | undefined): number => {
  const t = typeof iso === "string" ? Date.parse(iso) : NaN
  return Number.isNaN(t) ? -Infinity : t
}

// ── Thèmes et dernière fois ──────────────────────────────────────────────────

/** Exercices disponibles d'un thème : catégories effectives du matériel du compte. */
export function exercicesDuTheme(focus: TrisetFocus, available: Exercise[]): Exercise[] {
  const { categories } = effectiveTrisetRules(focus, available)
  return available.filter((e) => categories.includes(e.category))
}

/** Un thème est proposé à partir de 2 exercices disponibles. */
export const themeDisponible = (focus: TrisetFocus, available: Exercise[]): boolean =>
  exercicesDuTheme(focus, available).length >= SUPERSET_EXERCISES_MIN

export interface DernieresFois {
  groupes: Partial<Record<Group, string>>
  themes: Partial<Record<TrisetFocus, string>>
}

/**
 * Date la plus récente (completed_at) par groupe et par thème, sur les séances faites.
 * Un superset date son groupe, et son thème si c'est un thème actuel. Un superset sans
 * focus et un bloc principal sont ignorés.
 */
export function derniereFois(sessions: DoneSession[]): DernieresFois {
  const out: DernieresFois = { groupes: {}, themes: {} }
  const keep = <K extends string>(map: Partial<Record<K, string>>, key: K, date: string) => {
    if (timeOf(date) > timeOf(map[key])) map[key] = date
  }
  for (const s of sessions) {
    if (!s?.completed_at || (s.status !== undefined && s.status !== "done")) continue
    for (const block of blocksOf(s.content)) {
      if (block.type !== "superset") continue
      const group = groupOfFocus(block.focus)
      if (!group) continue
      keep(out.groupes, group, s.completed_at)
      if (isCurrentTheme(block.focus)) keep(out.themes, block.focus, s.completed_at)
    }
  }
  return out
}

/** Ordre « travaillé il y a le plus longtemps d'abord » : jamais travaillé en tête, puis date croissante. */
const byOldest = (date: (key: string) => string | undefined, order: string[]) => (x: string, y: string) => {
  const dx = date(x)
  const dy = date(y)
  if (!dx !== !dy) return dx ? 1 : -1
  const diff = dx && dy ? timeOf(dx) - timeOf(dy) : 0
  return diff || order.indexOf(x) - order.indexOf(y)
}

/** Thèmes disponibles d'un groupe, du plus ancien au plus récent. */
const themesTries = (group: Group, dernieres: DernieresFois, available: Exercise[]): TrisetFocus[] =>
  THEMES_BY_GROUP[group]
    .filter((t) => themeDisponible(t, available))
    .sort(byOldest((t) => dernieres.themes[t as TrisetFocus], THEMES_BY_GROUP[group]))

/** Groupes ayant au moins un thème disponible, du plus ancien au plus récent, égalité selon GROUP_ORDER. */
export function groupesTries(dernieres: DernieresFois, available: Exercise[]): Group[] {
  return GROUP_ORDER
    .filter((g) => themesTries(g, dernieres, available).length > 0)
    .sort(byOldest((g) => dernieres.groupes[g as Group], GROUP_ORDER) as (x: Group, y: Group) => number)
}

/** Patrons de répartition par nombre de supersets : index dans les groupes triés. */
const REPARTITION: Record<number, number[]> = {
  1: [0],
  2: [0, 1],
  3: [0, 0, 1],
  4: [0, 0, 1, 2],
}

/**
 * Groupe de chaque superset : 1 [a] ; 2 [a, b] ; 3 [a, a, b] ; 4 [a, a, b, c], avec
 * a, b, c les groupes triés. Faute d'assez de groupes, le dernier disponible reprend.
 */
export function repartition(n: number, groupes: Group[]): Group[] {
  if (!groupes.length) return []
  const pattern = REPARTITION[n] ?? []
  return pattern.map((i) => groupes[Math.min(i, groupes.length - 1)])
}

// ── Composition ──────────────────────────────────────────────────────────────

export const DEFAULT_EXERCISE_COUNT = 3
export const DEFAULT_ROUNDS = 3

/** Composition proposée pour une intensité, d'après les séances faites et le matériel. */
export function preremplir(
  { intensity, sessions, available }: { intensity: Intensity; sessions: DoneSession[]; available: Exercise[] },
): Composition {
  const dernieres = derniereFois(sessions)
  const groupes = repartition(INTENSITY_SUPERSETS[intensity], groupesTries(dernieres, available))
  const used: Partial<Record<Group, number>> = {}
  const supersets = groupes.map((group) => {
    const themes = themesTries(group, dernieres, available)
    const k = used[group] ?? 0
    used[group] = k + 1
    // Thèmes distincts tant qu'il en reste, puis on reprend depuis le plus ancien.
    const focus = themes[k % themes.length]
    return {
      focus,
      exercise_count: Math.min(DEFAULT_EXERCISE_COUNT, exercicesDuTheme(focus, available).length),
      rounds: DEFAULT_ROUNDS,
    }
  })
  return { intensity, supersets: tenirDansLeCatalogue(supersets, available) }
}

/** Exercices différents offerts par l'ensemble des thèmes. */
const exercicesDistincts = (focuses: TrisetFocus[], available: Exercise[]): number =>
  new Set(focuses.flatMap((t) => exercicesDuTheme(t, available).map((e) => e.slug))).size

/**
 * Ramène le total des exercices demandés au nombre d'exercices différents des thèmes
 * (matériel réduit) : un exercice de moins au superset le plus fourni, le dernier en
 * cas d'égalité, sans descendre sous le minimum ; puis un superset de moins en fin de liste.
 */
function tenirDansLeCatalogue(supersets: CompositionSuperset[], available: Exercise[]): CompositionSuperset[] {
  const out = supersets.map((s) => ({ ...s }))
  const total = () => out.reduce((sum, s) => sum + s.exercise_count, 0)
  while (out.length > 1 && total() > exercicesDistincts(out.map((s) => s.focus), available)) {
    let k = -1
    out.forEach((s, i) => {
      if (s.exercise_count > SUPERSET_EXERCISES_MIN && (k < 0 || s.exercise_count >= out[k].exercise_count)) k = i
    })
    if (k >= 0) out[k].exercise_count -= 1
    else out.pop()
  }
  return out
}

/** Composition d'une séance au nouveau format, pour la rouvrir en composition. */
export function compositionDe(content: unknown): Composition {
  const supersets = blocksOf(content)
    .filter((b) => b.type === "superset")
    .map((b) => ({
      focus: b.focus as TrisetFocus,
      exercise_count: membersOf(b).length,
      rounds: Number(b.rounds),
    }))
  const stored = isRecord(content) ? content.intensity : undefined
  const fallback = (Object.keys(INTENSITY_SUPERSETS) as Intensity[])
    .find((i) => INTENSITY_SUPERSETS[i] === supersets.length) ?? "normale"
  return { intensity: isIntensity(stored) ? stored : fallback, supersets }
}

/** Groupes d'une liste de thèmes, dans l'ordre d'apparition. */
export const groupesDe = (focuses: unknown[]): Group[] =>
  [...new Set(focuses.map(groupOfFocus).filter((g): g is Group => g !== null))]

/** Titre : « Jambes », « Jambes et tronc », « Haut du corps et tronc », « Corps complet ». */
export function titreSeance(focuses: unknown[]): string {
  const groupes = groupesDe(focuses)
  if (groupes.length >= 3) return "Corps complet"
  if (groupes.length === 2) return `${GROUP_LABELS[groupes[0]]} et ${GROUP_LABELS[groupes[1]].toLowerCase()}`
  if (groupes.length === 1) return GROUP_LABELS[groupes[0]]
  return "Renfo"
}

/** Contrôle d'une composition reçue du client. Liste d'erreurs en français, vide si valide. */
export function validateComposition(composition: unknown, available: Exercise[]): string[] {
  if (!isRecord(composition)) return ["La composition doit être un objet"]
  const errors: string[] = []
  if (!isIntensity(composition.intensity)) errors.push("Intensité inconnue")
  const supersets = composition.supersets
  if (!Array.isArray(supersets) || supersets.length < SUPERSETS_MIN || supersets.length > SUPERSETS_MAX) {
    errors.push(`${SUPERSETS_MIN} à ${SUPERSETS_MAX} supersets attendus`)
    return errors
  }
  const themes = new Set<TrisetFocus>()
  let total = 0
  supersets.forEach((s: unknown, i) => {
    const label = `Superset ${i + 1}`
    if (!isRecord(s)) {
      errors.push(`${label} : objet attendu`)
      return
    }
    const known = isCurrentTheme(s.focus)
    if (!known) errors.push(`${label} : thème inconnu`)
    if (!isIntIn(s.exercise_count, SUPERSET_EXERCISES_MIN, SUPERSET_EXERCISES_MAX)) {
      errors.push(`${label} : ${SUPERSET_EXERCISES_MIN} à ${SUPERSET_EXERCISES_MAX} exercices`)
    } else {
      total += s.exercise_count as number
      if (known) {
        const count = exercicesDuTheme(s.focus as TrisetFocus, available).length
        if ((s.exercise_count as number) > count) {
          errors.push(`${label} : ${count} exercice${count > 1 ? "s" : ""} disponible${count > 1 ? "s" : ""} au plus pour ce thème`)
        }
      }
    }
    if (!isIntIn(s.rounds, ROUNDS_MIN, ROUNDS_MAX)) errors.push(`${label} : ${ROUNDS_MIN} à ${ROUNDS_MAX} tours`)
    if (known) themes.add(s.focus as TrisetFocus)
  })
  const distinct = exercicesDistincts([...themes], available)
  if (themes.size && total > distinct) {
    errors.push(`Trop d'exercices demandés : ${distinct} exercices différents au plus pour ces thèmes`)
  }
  return errors
}

// ── Dosage ───────────────────────────────────────────────────────────────────

/** Bande du milieu du compte : index floor((n - 1) / 2) de la liste triée. */
export function bandeDuMilieu(bandsKg: number[]): number | null {
  if (!bandsKg.length) return null
  const sorted = [...bandsKg].sort((a, b) => a - b)
  return sorted[Math.floor((sorted.length - 1) / 2)]
}

/** Bande du compte la plus proche, la plus légère en cas d'égalité. */
export function bandeLaPlusProche(kg: number, bandsKg: number[]): number | null {
  let best: number | null = null
  for (const b of [...bandsKg].sort((x, y) => x - y)) {
    if (best === null || Math.abs(b - kg) < Math.abs(best - kg)) best = b
  }
  return best
}

const present = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

/**
 * Dose d'un exercice : reps ou duration_sec selon le mode, depuis la base, sinon la
 * référence. Élastique : celui de la base (ramené à la bande du compte la plus proche),
 * sinon `bandChoisie`, sinon la bande du milieu. Pas de band_kg sans élastique.
 */
export function doseDe(
  exercise: Exercise,
  { base, bandsKg, bandChoisie }: { base?: Base | null; bandsKg: number[]; bandChoisie?: number | null },
): Dose {
  const dose: Dose = { slug: exercise.slug }
  if (exercise.mode === "reps") dose.reps = present(base?.reps) ? base.reps : exercise.ref
  else dose.duration_sec = present(base?.duration_sec) ? base.duration_sec : exercise.ref
  if (exercise.equipment.includes("band")) {
    const wanted = present(base?.band_kg) ? base.band_kg : present(bandChoisie) ? bandChoisie : null
    const kg = wanted !== null ? bandeLaPlusProche(wanted, bandsKg) : bandeDuMilieu(bandsKg)
    if (kg !== null) dose.band_kg = kg
  }
  return dose
}

// ── Choix du modèle ──────────────────────────────────────────────────────────

/** Superset à faire remplir par le modèle. */
export interface SupersetDemande {
  /** Position dans la séance, à partir de 1. */
  position: number
  focus: TrisetFocus
  exercise_count: number
}

export interface Demande {
  supersets: SupersetDemande[]
  /** Échauffement et retour au calme à choisir (sinon gardés). */
  echauffement: boolean
}

export interface ChoixExercice { slug: string; band_kg?: number }

export interface Choix {
  warmup?: ChoixExercice[]
  supersets: Array<{ position: number; exercises: ChoixExercice[] }>
  cooldown?: ChoixExercice[]
}

export interface ChoixContexte {
  demande: Demande
  /** Exercices déjà gardés sur la séance (supersets gardés, échauffement gardé). */
  gardes: string[]
  available: Exercise[]
  bandsKg: number[]
  /** Exercices qui ont déjà une base : l'élastique n'est pas demandé pour eux. */
  avecBase: string[]
}

/** Exigences d'un superset, chaque minimum ramené aussi au nombre d'exercices du superset. */
export function exigencesDuSuperset(focus: TrisetFocus, count: number, available: Exercise[]): TrisetRequirement[] {
  return effectiveTrisetRules(focus, available).requires
    .map((r) => ({ categories: r.categories, min: Math.min(r.min, count) }))
    .filter((r) => r.min > 0)
}

/** Élastique demandé au modèle : exercice à élastique sans base. */
export const bandeDemandee = (slug: string, avecBase: string[]): boolean =>
  !!EXERCISE_INDEX[slug]?.equipment.includes("band") && !avecBase.includes(slug)

export const echauffementPermis = (e: Exercise): boolean => e.category === "warmup" || WARMUP_EXTRAS.includes(e.slug)
export const retourAuCalmePermis = (e: Exercise): boolean => e.category === "cooldown"

/** Contrôle du choix du modèle. Liste d'erreurs en français, vide si valide. */
export function validerChoix(raw: unknown, ctx: ChoixContexte): string[] {
  if (!isRecord(raw)) return ["La réponse doit être un objet JSON"]
  const errors: string[] = []
  const availableSlugs = new Set(ctx.available.map((e) => e.slug))
  const seen = new Set<string>(ctx.gardes)
  const anchors = new Set<Anchor>()
  for (const slug of ctx.gardes) {
    const anchor = onBarAnchor(EXERCISE_INDEX[slug])
    if (anchor) anchors.add(anchor)
  }

  const checkItem = (item: unknown, where: string, allowed: (e: Exercise) => boolean): Exercise | null => {
    if (!isRecord(item) || typeof item.slug !== "string") {
      errors.push(`${where} : exercice sans slug`)
      return null
    }
    const slug = item.slug
    const exercise = EXERCISE_INDEX[slug]
    if (!exercise) {
      errors.push(`${where} : exercice inconnu « ${slug} »`)
      return null
    }
    if (!availableSlugs.has(slug)) {
      errors.push(`${where} : « ${slug} » demande du matériel indisponible`)
      return null
    }
    if (seen.has(slug)) errors.push(`${where} : « ${slug} » apparaît plusieurs fois dans la séance`)
    seen.add(slug)
    if (!allowed(exercise)) errors.push(`${where} : « ${slug} » (${exercise.category}) n'est pas autorisé ici`)
    if (bandeDemandee(slug, ctx.avecBase) && (!present(item.band_kg) || !ctx.bandsKg.includes(item.band_kg))) {
      errors.push(`${where} : « ${slug} » demande band_kg parmi les bandes du compte (${ctx.bandsKg.join(", ")} kg)`)
    }
    const anchor = onBarAnchor(exercise)
    if (anchor) anchors.add(anchor)
    return exercise
  }

  const checkList = (key: "warmup" | "cooldown", label: string, min: number, max: number, allowed: (e: Exercise) => boolean) => {
    const list = raw[key]
    if (!Array.isArray(list) || list.length < min || list.length > max) {
      errors.push(`${label} : ${min} à ${max} exercices attendus`)
      return
    }
    list.forEach((item, i) => checkItem(item, `${label} ${i + 1}`, allowed))
  }

  if (ctx.demande.echauffement) {
    checkList("warmup", "Échauffement", WARMUP_ITEMS_MIN, WARMUP_ITEMS_MAX, echauffementPermis)
  }

  const supersets = Array.isArray(raw.supersets) ? raw.supersets.filter(isRecord) : []
  const positions = supersets.map((s) => s.position)
  const wanted = ctx.demande.supersets.map((s) => s.position)
  if (
    !Array.isArray(raw.supersets) || supersets.length !== raw.supersets.length ||
    positions.length !== wanted.length || wanted.some((p) => !positions.includes(p))
  ) {
    errors.push(`supersets doit contenir exactement les positions ${wanted.join(", ")}`)
  }
  for (const d of ctx.demande.supersets) {
    const s = supersets.find((x) => x.position === d.position)
    if (!s) continue
    const label = `Superset ${d.position}`
    const list = s.exercises
    if (!Array.isArray(list) || list.length !== d.exercise_count) {
      errors.push(`${label} : exactement ${d.exercise_count} exercices attendus`)
      if (!Array.isArray(list)) continue
    }
    const { categories } = effectiveTrisetRules(d.focus, ctx.available)
    const members = list
      .map((item: unknown, i: number) => checkItem(item, `${label} exercice ${i + 1}`, (e) => categories.includes(e.category)))
      .filter((e: Exercise | null): e is Exercise => e !== null)
    for (const { categories: cats, min } of exigencesDuSuperset(d.focus, d.exercise_count, ctx.available)) {
      if (members.filter((e: Exercise) => cats.includes(e.category)).length < min) {
        const what = min > 1 ? `${min} exercices` : "un exercice"
        errors.push(`${label} : au moins ${what} ${cats.join(" ou ")} attendu${min > 1 ? "s" : ""}`)
      }
    }
    const onBar = members.filter((e: Exercise) => onBarAnchor(e))
    if (new Set(onBar.map((e: Exercise) => e.anchor)).size > 1) {
      const detail = onBar.map((e: Exercise) => `${e.slug} barre ${e.anchor}`).join(", ")
      errors.push(`${label} : barre à des hauteurs différentes (${detail}), une seule par superset`)
    }
  }

  if (ctx.demande.echauffement) {
    checkList("cooldown", "Retour au calme", COOLDOWN_ITEMS_MIN, COOLDOWN_ITEMS_MAX, retourAuCalmePermis)
  }

  if (anchors.size > 2) errors.push(`Barre utilisée à ${anchors.size} hauteurs différentes, deux au plus par séance`)
  return errors
}

// ── Assemblage ───────────────────────────────────────────────────────────────

export interface AssemblageParams {
  composition: Composition
  /** Choix du modèle validé (supersets à générer, échauffement s'il est demandé). */
  choix: Choix | null
  /** Superset gardé par position (index 0 = position 1), ou null s'il est généré. */
  gardes: Array<SupersetBlock | null>
  /** Échauffement et retour au calme gardés, si le choix n'en contient pas. */
  echauffementGarde?: { warmup: Dose[]; cooldown: Dose[] } | null
  bases: Bases
  bandsKg: number[]
}

const dosesDuChoix = (items: ChoixExercice[], p: AssemblageParams): Dose[] =>
  items.map((item) => doseDe(EXERCISE_INDEX[item.slug], {
    base: p.bases[item.slug],
    bandsKg: p.bandsKg,
    bandChoisie: item.band_kg ?? null,
  }))

/** Contenu complet d'une séance composée : titre, intensité, durée et repos posés par le code. */
export function assembler(p: AssemblageParams): SessionContent {
  const warmup = p.choix?.warmup ? dosesDuChoix(p.choix.warmup, p) : p.echauffementGarde?.warmup ?? []
  const cooldown = p.choix?.cooldown ? dosesDuChoix(p.choix.cooldown, p) : p.echauffementGarde?.cooldown ?? []
  const supersets: SupersetBlock[] = p.composition.supersets.map((s, i) => {
    const garde = p.gardes[i]
    const exercises = garde
      ? supersetMembers(garde)
      : dosesDuChoix(p.choix?.supersets.find((x) => x.position === i + 1)?.exercises ?? [], p)
    return { type: "superset", focus: s.focus, rounds: s.rounds, rest_sec: SUPERSET_REST_SEC, exercises }
  })
  const blocks: SessionBlock[] = [
    { type: "warmup", items: warmup },
    ...supersets,
    { type: "cooldown", items: cooldown },
  ]
  return {
    title: titreSeance(p.composition.supersets.map((s) => s.focus)),
    estimated_min: estimateSessionMinutes({ blocks }),
    intensity: p.composition.intensity,
    blocks,
  }
}

/** Ce qu'une nouvelle composition garde d'une séance existante. */
export interface PlanMiseAJour {
  /** Superset repris par position (index 0 = position 1), avec les tours demandés, ou null. */
  gardes: Array<SupersetBlock | null>
  /** Supersets à faire choisir au modèle. */
  aGenerer: SupersetDemande[]
  /** Échauffement et retour au calme gardés (mêmes groupes), sinon null : à régénérer. */
  echauffementGarde: { warmup: Dose[]; cooldown: Dose[] } | null
}

/**
 * Chaque superset demandé reprend le premier ancien superset non utilisé de même focus
 * et de même nombre d'exercices, quelle que soit sa position, avec les tours demandés.
 * Échauffement et retour au calme gardés si l'ensemble des groupes ne change pas.
 */
export function planMiseAJour(content: unknown, composition: Composition): PlanMiseAJour {
  const blocks = blocksOf(content)
  const anciens = blocks.filter((b) => b.type === "superset")
  const utilises = new Set<number>()
  const gardes: Array<SupersetBlock | null> = []
  const aGenerer: SupersetDemande[] = []
  composition.supersets.forEach((s, i) => {
    const j = anciens.findIndex((b, k) =>
      !utilises.has(k) && b.focus === s.focus && membersOf(b).length === s.exercise_count)
    if (j >= 0) {
      utilises.add(j)
      gardes.push({
        type: "superset", focus: s.focus, rounds: s.rounds, rest_sec: SUPERSET_REST_SEC,
        exercises: membersOf(anciens[j]).map((d) => ({ ...d })),
      })
    } else {
      gardes.push(null)
      aGenerer.push({ position: i + 1, focus: s.focus, exercise_count: s.exercise_count })
    }
  })
  const avant = new Set(groupesDe(anciens.map((b) => b.focus)))
  const apres = new Set(groupesDe(composition.supersets.map((s) => s.focus)))
  const memesGroupes = avant.size === apres.size && [...avant].every((g) => apres.has(g))
  const warmup = blocks.find((b) => b.type === "warmup")
  const cooldown = blocks.find((b) => b.type === "cooldown")
  const echauffementGarde = memesGroupes && warmup && cooldown
    ? { warmup: blockDoses(warmup).map((d) => ({ ...d })), cooldown: blockDoses(cooldown).map((d) => ({ ...d })) }
    : null
  return { gardes, aGenerer, echauffementGarde }
}

// ── Historique pour le modèle ────────────────────────────────────────────────

/**
 * Exercices du thème dans la dernière séance faite sur ce thème, sinon ceux du groupe
 * dans la dernière séance faite sur ce groupe : à éviter quand le modèle a le choix.
 */
export function exercicesRecents(focus: TrisetFocus, sessions: DoneSession[]): string[] {
  const done = sessions
    .filter((s) => s?.completed_at && (s.status === undefined || s.status === "done"))
    .sort((x, y) => timeOf(y.completed_at) - timeOf(x.completed_at))
  const pick = (match: (b: Rec) => boolean): string[] | null => {
    for (const s of done) {
      const blocks = blocksOf(s.content).filter((b) => b.type === "superset" && match(b))
      if (blocks.length) return [...new Set(blocks.flatMap((b) => membersOf(b).map((d) => d.slug)))]
    }
    return null
  }
  const group = groupOfFocus(focus)
  return pick((b) => b.focus === focus) ?? (group ? pick((b) => groupOfFocus(b.focus) === group) : null) ?? []
}

// ── Modifications d'une séance ───────────────────────────────────────────────

const withEstimate = (content: SessionContent): SessionContent => ({
  ...content,
  estimated_min: estimateSessionMinutes(content),
})

const mapBlockDoses = (block: SessionBlock, fn: (d: Dose) => Dose): SessionBlock => {
  if (block.type === "superset") {
    if (Array.isArray(block.exercises)) return { ...block, exercises: block.exercises.map(fn) }
    const out: SupersetBlock = { ...block }
    if (block.a) out.a = fn(block.a)
    if (block.b) out.b = fn(block.b)
    if (block.c) out.c = fn(block.c)
    return out
  }
  if (block.type === "main") return { ...block, items: block.items.map((d) => ({ ...d, ...fn(d) })) }
  return { ...block, items: block.items.map(fn) }
}

/** Nouveau contenu où l'exercice `slug` prend `dose`, durée recalculée. */
export function ajuster(content: SessionContent, slug: string, dose: Dose): SessionContent {
  return withEstimate({
    ...content,
    blocks: content.blocks.map((b) => mapBlockDoses(b, (d) => d.slug === slug ? { ...dose, slug } : d)),
  })
}

/** Nouveau contenu où, dans le bloc `blockIndex`, `slug` est remplacé par `nouvelleDose`. */
export function remplacer(content: SessionContent, blockIndex: number, slug: string, nouvelleDose: Dose): SessionContent {
  return withEstimate({
    ...content,
    blocks: content.blocks.map((b, i) =>
      i === blockIndex ? mapBlockDoses(b, (d) => d.slug === slug ? { ...nouvelleDose } : d) : b),
  })
}

/**
 * Remplaçants de `slug` dans le bloc `blockIndex` : même catégorie, absents de la
 * séance. Pour un exercice à barre : une seule hauteur dans son superset après
 * remplacement, deux au plus sur la séance.
 */
export function remplacants(content: unknown, blockIndex: number, slug: string, available: Exercise[]): Exercise[] {
  const blocks = blocksOf(content)
  const block = blocks[blockIndex]
  const current = EXERCISE_INDEX[slug]
  if (!block || !current || !blockDoses(block).some((d) => d.slug === slug)) return []
  const inSession = new Set(contentSlugs(content))
  const anchorsOf = (doses: Dose[]) =>
    doses.filter((d) => d.slug !== slug).map((d) => onBarAnchor(EXERCISE_INDEX[d.slug])).filter((a): a is Anchor => a !== null)
  const blockAnchors = new Set(block.type === "superset" ? anchorsOf(blockDoses(block)) : [])
  const sessionAnchors = new Set(anchorsOf(blocks.flatMap(blockDoses)))
  return available.filter((e) => {
    if (e.category !== current.category || inSession.has(e.slug)) return false
    const anchor = onBarAnchor(e)
    if (!anchor) return true
    if (blockAnchors.size && !blockAnchors.has(anchor)) return false
    return new Set([...sessionAnchors, anchor]).size <= 2
  })
}

/** Séance au nouveau format : au moins un superset, tous avec `exercises`, aucun bloc principal. */
export function estNouveauFormat(content: unknown): boolean {
  const blocks = blocksOf(content)
  const supersets = blocks.filter((b) => b.type === "superset")
  return supersets.length > 0 && supersets.every((b) => Array.isArray(b.exercises)) &&
    !blocks.some((b) => b.type === "main")
}

/** Tous les exercices d'une séance, dans l'ordre de jeu (pour les bases manquantes). */
export const dosesDeSeance = (content: unknown): Dose[] => blocksOf(content).flatMap(blockDoses)
