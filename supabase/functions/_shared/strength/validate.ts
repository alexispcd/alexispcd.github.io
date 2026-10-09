// Validation du contenu d'une séance Renfo produit par le modèle. Module pur,
// aussi importé par le front. Renvoie la liste des erreurs en français (vide si valide).

import { type Anchor, type Equipment, EXERCISE_INDEX, type Exercise } from "./catalog.ts"
import {
  BLOCK_CATEGORIES, BLOCK_ORDER, COOLDOWN_ITEMS_MAX, COOLDOWN_ITEMS_MIN,
  DURATION_MAX_SEC, DURATION_MIN_SEC, MAIN_ITEMS_MAX, MAIN_ITEMS_MIN, MAIN_REST_MAX_SEC,
  MAIN_REST_MIN_SEC, MAIN_SETS_MAX, MAIN_SETS_MIN, REPS_MAX, REPS_MIN, type SessionKind,
  SUPERSET_REST_MAX_SEC, SUPERSET_REST_MIN_SEC, SUPERSET_ROUNDS_MAX, SUPERSET_ROUNDS_MIN,
  WARMUP_EXTRAS, WARMUP_ITEMS_MAX, WARMUP_ITEMS_MIN,
} from "./rules.ts"

export interface ValidationContext {
  kind: SessionKind
  /** Matériel hors élastiques (chair, bar). */
  equipment: Equipment[]
  /** Bandes du compte, en kg. */
  bandsKg: number[]
  /** Exercices principaux imposés (cycle en cours), dans n'importe quel ordre. */
  mainSlugs?: string[]
}

type Rec = Record<string, unknown>

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v)

const isIntIn = (v: unknown, min: number, max: number): boolean =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max

export function validateSessionContent(content: unknown, ctx: ValidationContext): string[] {
  const errors: string[] = []
  if (!isRecord(content)) return ["Le contenu doit être un objet"]
  if (typeof content.title !== "string" || !content.title.trim()) errors.push("Titre manquant")

  const blocks = content.blocks
  if (!Array.isArray(blocks) || blocks.length !== BLOCK_ORDER.length) {
    errors.push(`La séance doit compter exactement ${BLOCK_ORDER.length} blocs`)
    return errors
  }
  const types = blocks.map((b) => isRecord(b) ? b.type : undefined)
  if (BLOCK_ORDER.some((type, i) => types[i] !== type)) {
    errors.push(`Blocs attendus dans cet ordre : ${BLOCK_ORDER.join(", ")}`)
    return errors
  }

  const rules = BLOCK_CATEGORIES[ctx.kind]
  const seen = new Set<string>()
  const anchors = new Set<Anchor>()

  // Contrôle commun d'un exercice : slug, catégorie, dosage, matériel, bande.
  const checkDose = (
    dose: unknown,
    where: string,
    allowed: (e: Exercise) => boolean,
  ): Exercise | null => {
    if (!isRecord(dose) || typeof dose.slug !== "string") {
      errors.push(`${where} : exercice sans slug`)
      return null
    }
    const slug = dose.slug
    const exercise = EXERCISE_INDEX[slug]
    if (!exercise) {
      errors.push(`${where} : exercice inconnu « ${slug} »`)
      return null
    }
    if (seen.has(slug)) errors.push(`${where} : « ${slug} » apparaît plusieurs fois dans la séance`)
    seen.add(slug)
    if (!allowed(exercise)) errors.push(`${where} : « ${slug} » (${exercise.category}) n'est pas autorisé dans ce bloc`)

    if (exercise.mode === "reps") {
      if (dose.duration_sec !== undefined) errors.push(`${where} : « ${slug} » se dose en répétitions, pas en durée`)
      if (!isIntIn(dose.reps, REPS_MIN, REPS_MAX)) {
        errors.push(`${where} : « ${slug} » demande reps entier entre ${REPS_MIN} et ${REPS_MAX}`)
      }
    } else {
      if (dose.reps !== undefined) errors.push(`${where} : « ${slug} » se dose en durée, pas en répétitions`)
      if (!isIntIn(dose.duration_sec, DURATION_MIN_SEC, DURATION_MAX_SEC)) {
        errors.push(`${where} : « ${slug} » demande duration_sec entier entre ${DURATION_MIN_SEC} et ${DURATION_MAX_SEC}`)
      }
    }

    for (const eq of exercise.equipment) {
      const available = eq === "band" ? ctx.bandsKg.length > 0 : ctx.equipment.includes(eq)
      if (!available) errors.push(`${where} : « ${slug} » demande du matériel indisponible (${eq})`)
    }

    const usesBand = exercise.equipment.includes("band")
    if (usesBand) {
      if (typeof dose.band_kg !== "number" || !ctx.bandsKg.includes(dose.band_kg)) {
        errors.push(`${where} : « ${slug} » demande band_kg parmi les bandes du compte (${ctx.bandsKg.join(", ")} kg)`)
      }
    } else if (dose.band_kg !== undefined) {
      errors.push(`${where} : « ${slug} » n'utilise pas d'élastique, band_kg interdit`)
    }

    if (exercise.anchor && exercise.equipment.includes("bar")) anchors.add(exercise.anchor)
    return exercise
  }

  const checkList = (block: Rec, label: string, min: number, max: number, allowed: (e: Exercise) => boolean) => {
    const items = block.items
    if (!Array.isArray(items) || items.length < min || items.length > max) {
      errors.push(`${label} : ${min} à ${max} exercices attendus`)
      return [] as Exercise[]
    }
    return items.map((item, i) => checkDose(item, `${label} ${i + 1}`, allowed))
  }

  // ── Échauffement ──
  checkList(blocks[0] as Rec, "Échauffement", WARMUP_ITEMS_MIN, WARMUP_ITEMS_MAX,
    (e) => e.category === "warmup" || WARMUP_EXTRAS.includes(e.slug))

  // ── Bloc principal ──
  const main = blocks[1] as Rec
  const mainExercises = checkList(main, "Bloc principal", MAIN_ITEMS_MIN, MAIN_ITEMS_MAX,
    (e) => rules.main.includes(e.category))
  if (Array.isArray(main.items)) {
    main.items.forEach((item, i) => {
      if (!isRecord(item)) return
      if (!isIntIn(item.sets, MAIN_SETS_MIN, MAIN_SETS_MAX)) {
        errors.push(`Bloc principal ${i + 1} : sets entier entre ${MAIN_SETS_MIN} et ${MAIN_SETS_MAX}`)
      }
      if (!isIntIn(item.rest_sec, MAIN_REST_MIN_SEC, MAIN_REST_MAX_SEC)) {
        errors.push(`Bloc principal ${i + 1} : rest_sec entier entre ${MAIN_REST_MIN_SEC} et ${MAIN_REST_MAX_SEC}`)
      }
    })
  }
  const mainCategories = mainExercises.filter((e): e is Exercise => e !== null).map((e) => e.category)
  for (const group of rules.mainRequires) {
    if (mainExercises.length && !mainCategories.some((c) => group.includes(c))) {
      errors.push(`Bloc principal : au moins un exercice ${group.join(" ou ")} attendu`)
    }
  }
  if (ctx.mainSlugs && Array.isArray(main.items)) {
    const got = main.items.map((item) => isRecord(item) ? item.slug : undefined).sort()
    const want = [...ctx.mainSlugs].sort()
    if (got.length !== want.length || got.some((s, i) => s !== want[i])) {
      errors.push(`Bloc principal : exercices imposés pour ce cycle : ${ctx.mainSlugs.join(", ")}`)
    }
  }

  // ── Supersets ──
  for (const [n, index] of [[1, 2], [2, 3]]) {
    const block = blocks[index] as Rec
    const label = `Superset ${n}`
    if (!isIntIn(block.rounds, SUPERSET_ROUNDS_MIN, SUPERSET_ROUNDS_MAX)) {
      errors.push(`${label} : rounds entier entre ${SUPERSET_ROUNDS_MIN} et ${SUPERSET_ROUNDS_MAX}`)
    }
    if (!isIntIn(block.rest_sec, SUPERSET_REST_MIN_SEC, SUPERSET_REST_MAX_SEC)) {
      errors.push(`${label} : rest_sec entier entre ${SUPERSET_REST_MIN_SEC} et ${SUPERSET_REST_MAX_SEC}`)
    }
    const allowed = (e: Exercise) => rules.superset.includes(e.category)
    const a = checkDose(block.a, `${label} A`, allowed)
    const b = checkDose(block.b, `${label} B`, allowed)
    if (a?.equipment.includes("bar") && b?.equipment.includes("bar") && a.anchor !== b.anchor) {
      errors.push(`${label} : A et B utilisent la barre à des hauteurs différentes (${a.anchor}, ${b.anchor})`)
    }
  }

  // ── Retour au calme ──
  checkList(blocks[4] as Rec, "Retour au calme", COOLDOWN_ITEMS_MIN, COOLDOWN_ITEMS_MAX,
    (e) => e.category === "cooldown")

  if (anchors.size > 2) {
    errors.push(`Barre utilisée à ${anchors.size} hauteurs différentes, deux au plus par séance`)
  }
  return errors
}
