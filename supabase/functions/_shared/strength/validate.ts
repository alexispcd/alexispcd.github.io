// Validation du contenu d'une séance Renfo produit par le modèle. Module pur,
// aussi importé par le front. Renvoie la liste des erreurs en français (vide si valide).

import { type Anchor, availableExercises, type Equipment, EXERCISE_INDEX, type Exercise } from "./catalog.ts"
import {
  blockOrder, COOLDOWN_ITEMS_MAX, COOLDOWN_ITEMS_MIN, DURATION_MAX_SEC, DURATION_MIN_SEC,
  effectiveTrisetRules, REPS_MAX, REPS_MIN, type SessionKind, SUPERSET_REST_MAX_SEC,
  SUPERSET_REST_MIN_SEC, SUPERSET_ROUNDS_MAX, SUPERSET_ROUNDS_MIN, type TrisetFocus,
  TRISET_FOCUS_LABELS, TRISETS_BY_KIND, WARMUP_EXTRAS, WARMUP_ITEMS_MAX, WARMUP_ITEMS_MIN,
} from "./rules.ts"

export interface ValidationContext {
  kind: SessionKind
  /** Matériel hors élastiques (chair, bar). Avec bandsKg, fixe aussi les règles effectives des trisets. */
  equipment: Equipment[]
  /** Bandes du compte, en kg. */
  bandsKg: number[]
  /**
   * Exercices figés sur le cycle en cours (lockedSlugs) : les 9 slugs des trisets
   * à plat, comparés triset par triset (ordre libre à l'intérieur d'un triset).
   */
  mainSlugs?: string[]
}

type Rec = Record<string, unknown>

const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v)

const isIntIn = (v: unknown, min: number, max: number): boolean =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max

/** Mêmes slugs des deux côtés, ordre indifférent. */
const sameSet = (got: unknown[], want: string[]): boolean => {
  const a = [...got].map(String).sort()
  const b = [...want].sort()
  return a.length === b.length && a.every((s, i) => s === b[i])
}

export function validateSessionContent(content: unknown, ctx: ValidationContext): string[] {
  const errors: string[] = []
  if (!isRecord(content)) return ["Le contenu doit être un objet"]
  if (typeof content.title !== "string" || !content.title.trim()) errors.push("Titre manquant")

  const order = blockOrder(ctx.kind)
  const blocks = content.blocks
  if (!Array.isArray(blocks) || blocks.length !== order.length) {
    errors.push(`La séance doit compter exactement ${order.length} blocs`)
    return errors
  }
  const types = blocks.map((b) => isRecord(b) ? b.type : undefined)
  if (order.some((type, i) => types[i] !== type)) {
    errors.push(`Blocs attendus dans cet ordre : ${order.join(", ")}`)
    return errors
  }

  const trisets = TRISETS_BY_KIND[ctx.kind]
  const available = availableExercises(ctx.equipment, ctx.bandsKg)
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

  const checkRoundsAndRest = (block: Rec, label: string) => {
    if (!isIntIn(block.rounds, SUPERSET_ROUNDS_MIN, SUPERSET_ROUNDS_MAX)) {
      errors.push(`${label} : rounds entier entre ${SUPERSET_ROUNDS_MIN} et ${SUPERSET_ROUNDS_MAX}`)
    }
    if (!isIntIn(block.rest_sec, SUPERSET_REST_MIN_SEC, SUPERSET_REST_MAX_SEC)) {
      errors.push(`${label} : rest_sec entier entre ${SUPERSET_REST_MIN_SEC} et ${SUPERSET_REST_MAX_SEC}`)
    }
  }

  // ── Trisets ──
  trisets.forEach((focus, i) => checkTriset(blocks[i + 1] as Rec, i + 1, focus))
  if (ctx.mainSlugs) {
    trisets.forEach((_, i) => {
      const block = blocks[i + 1] as Rec
      const got = [block.a, block.b, block.c].map((d) => isRecord(d) ? d.slug : undefined)
      const want = ctx.mainSlugs!.slice(i * 3, i * 3 + 3)
      if (!sameSet(got, want)) {
        errors.push(`Triset ${i + 1} : exercices imposés pour ce cycle : ${want.join(", ")}`)
      }
    })
  }

  function checkTriset(block: Rec, n: number, focus: TrisetFocus) {
    const label = `Triset ${n}`
    const rules = effectiveTrisetRules(focus, available)
    checkRoundsAndRest(block, label)
    if (block.focus !== focus) {
      errors.push(`${label} : focus « ${focus} » (${TRISET_FOCUS_LABELS[focus]}) attendu à cette position`)
    }
    if (block.c === undefined) errors.push(`${label} : trois exercices a, b et c attendus`)
    const allowed = (e: Exercise) => rules.categories.includes(e.category)
    const members = (["a", "b", "c"] as const)
      .filter((key) => key !== "c" || block.c !== undefined)
      .map((key) => checkDose(block[key], `${label} ${key.toUpperCase()}`, allowed))
      .filter((e): e is Exercise => e !== null)
    for (const { categories, min } of rules.requires) {
      if (members.length && members.filter((e) => categories.includes(e.category)).length < min) {
        const what = min > 1 ? `${min} exercices` : "un exercice"
        errors.push(`${label} : au moins ${what} ${categories.join(" ou ")} attendu${min > 1 ? "s" : ""}`)
      }
    }
    const onBar = members.filter((e) => e.equipment.includes("bar"))
    if (new Set(onBar.map((e) => e.anchor)).size > 1) {
      const detail = onBar.map((e) => `${e.slug} barre ${e.anchor}`).join(", ")
      errors.push(
        `${label} : barre utilisée à des hauteurs différentes (${detail}), une seule par triset : ` +
          "garde des exercices à barre de même hauteur ou remplace par un exercice sans barre",
      )
    }
  }

  // ── Retour au calme ──
  checkList(blocks[blocks.length - 1] as Rec, "Retour au calme", COOLDOWN_ITEMS_MIN, COOLDOWN_ITEMS_MAX,
    (e) => e.category === "cooldown")

  if (anchors.size > 2) {
    errors.push(`Barre utilisée à ${anchors.size} hauteurs différentes, deux au plus par séance`)
  }
  return errors
}
