import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { requireModule } from "../_shared/access.ts"
import { withCors } from "../_shared/cors.ts"
import { internalError } from "../_shared/http.ts"
import { availableExercises, EXERCISE_INDEX } from "../_shared/strength/catalog.ts"
import {
  ajuster, assembler, type Bases, type Choix, type Composition, doseDe, dosesDeSeance, type DoneSession,
  estNouveauFormat, groupesDe, planMiseAJour, remplacants, remplacer, sansBande, validateComposition,
} from "../_shared/strength/compose.ts"
import {
  DURATION_MAX_SEC, DURATION_MIN_SEC, type Dose, REPS_MAX, REPS_MIN, type SessionContent,
} from "../_shared/strength/rules.ts"
import { choisirExercices } from "../_shared/strength/seance.ts"
import { loadStrengthSetup, PROFILE_MISSING, type StrengthSetup } from "../_shared/strength/setup.ts"
import { mondayOf, todayISO } from "../_shared/training/weeks.ts"

// Séances faites lues pour l'historique du modèle.
const RECENT_SESSIONS = 12

const TAG = "renfo-session"

const json = (status: number, body: unknown) => Response.json(body, { status })

const NOT_FOUND = { error: "Séance introuvable" }
const NOT_EDITABLE = { error: "Cette séance ne peut plus être modifiée", code: "session_non_modifiable" }
const BAD_SETTING = { error: "Réglage invalide", code: "reglage_invalide" }
const BAD_REPLACEMENT = { error: "Remplacement invalide", code: "remplacement_invalide" }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Row = Record<string, unknown> & { content: unknown }

const isIntIn = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= max

async function handleRequest(req: Request): Promise<Response> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return json(401, { error: "Missing authorization" })

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json(401, { error: "Unauthorized" })
  const denied = await requireModule(supabaseAdmin, user.id, "renfo")
  if (denied) return denied

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(400, { error: "Corps JSON invalide" })
  }

  const ctx: Ctx = { admin: supabaseAdmin, userId: user.id }
  switch (body?.action) {
    case "create":
      return await createAction(ctx, body)
    case "update":
      return await updateAction(ctx, body)
    case "adjust":
      return await adjustAction(ctx, body)
    case "replace":
      return await replaceAction(ctx, body)
    default:
      return json(400, { error: "Action inconnue" })
  }
}

// ── Séances composées (lot R1) ───────────────────────────────────────────────

interface Ctx {
  admin: SupabaseClient
  userId: string
}

/** Bases du compte, par slug. */
async function loadBases(ctx: Ctx, slugs?: string[]): Promise<Bases> {
  let query = ctx.admin
    .from("strength_exercise_bases")
    .select("slug, reps, duration_sec, band_kg")
    .eq("user_id", ctx.userId)
  if (slugs) query = query.in("slug", slugs)
  const { data, error } = await query
  if (error) throw new Error(`strength_exercise_bases: ${error.message}`)
  const bases: Bases = {}
  for (const row of data ?? []) {
    bases[row.slug] = {
      reps: row.reps,
      duration_sec: row.duration_sec,
      band_kg: row.band_kg == null ? null : Number(row.band_kg),
    }
  }
  return bases
}

/** Dernières séances faites, de la plus récente à la plus ancienne. */
async function loadRecentDone(ctx: Ctx): Promise<DoneSession[]> {
  const { data, error } = await ctx.admin
    .from("strength_sessions")
    .select("completed_at, content, status")
    .eq("user_id", ctx.userId)
    .eq("status", "done")
    .order("completed_at", { ascending: false })
    .limit(RECENT_SESSIONS)
  if (error) throw new Error(`strength_sessions récentes: ${error.message}`)
  return (data ?? []) as DoneSession[]
}

/** Séance à faire la plus récente, ligne complète, ou null. */
async function loadPending(ctx: Ctx): Promise<Row | null> {
  const { data, error } = await ctx.admin
    .from("strength_sessions")
    .select("*")
    .eq("user_id", ctx.userId)
    .eq("status", "planned")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(`strength_sessions à faire: ${error.message}`)
  return (data as Row | null) ?? null
}

/** Ajoute les bases manquantes sans écraser les existantes. Un échec est journalisé, sans plus. */
async function addMissingBases(ctx: Ctx, doses: Dose[]): Promise<void> {
  const rows = [...new Map(doses.map((d) => [d.slug, d])).values()].map((d) => ({
    user_id: ctx.userId,
    slug: d.slug,
    reps: d.reps ?? null,
    duration_sec: d.duration_sec ?? null,
    band_kg: d.band_kg ?? null,
  }))
  if (!rows.length) return
  const { error } = await ctx.admin
    .from("strength_exercise_bases")
    .upsert(rows, { onConflict: "user_id,slug", ignoreDuplicates: true })
  if (error) console.error(`[${TAG}] ${ctx.userId} bases manquantes non écrites :`, error.message)
}

/** Composition reçue, réduite aux champs attendus (déjà validée). */
const normalize = (raw: unknown): Composition => {
  const c = raw as Composition
  return {
    intensity: c.intensity,
    supersets: c.supersets.map(({ focus, exercise_count, rounds }) => ({ focus, exercise_count, rounds })),
  }
}

type Setup = { setup: StrengthSetup } | { response: Response }

async function requireSetup(ctx: Ctx): Promise<Setup> {
  const setup = await loadStrengthSetup(ctx.admin, ctx.userId)
  return setup ? { setup } : { response: json(409, PROFILE_MISSING) }
}

type Editable = { session: Row } | { response: Response }

/** Séance du compte, à faire et au nouveau format. */
async function loadEditable(ctx: Ctx, sessionId: unknown): Promise<Editable> {
  if (typeof sessionId !== "string" || !UUID.test(sessionId)) return { response: json(404, NOT_FOUND) }
  const { data, error } = await ctx.admin
    .from("strength_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", ctx.userId)
    .maybeSingle()
  if (error) throw new Error(`strength_sessions: ${error.message}`)
  if (!data) return { response: json(404, NOT_FOUND) }
  if (data.status !== "planned" || !estNouveauFormat(data.content)) {
    return { response: json(409, NOT_EDITABLE) }
  }
  return { session: data as Row }
}

/**
 * Écrit le nouveau contenu (et le titre) d'une séance, renvoie la ligne complète.
 * extra : autres colonnes écrites en même temps (bands_used pour adjust et replace).
 */
async function saveContent(
  ctx: Ctx,
  sessionId: string,
  content: SessionContent,
  extra: Record<string, unknown> = {},
): Promise<Response> {
  const { data, error } = await ctx.admin
    .from("strength_sessions")
    .update({ ...extra, content, title: content.title })
    .eq("id", sessionId)
    .eq("user_id", ctx.userId)
    .select("*")
    .single()
  if (error || !data) return internalError(TAG, error?.message ?? "update sans ligne")
  return json(200, { session: data })
}

const invalidModel = (ctx: Ctx, errors: string[]) => {
  console.error(`[${TAG}] ${ctx.userId} choix invalide après retry :`, errors.slice(0, 10))
  return json(422, { error: "Séance générée invalide", details: errors.slice(0, 10) })
}

async function createAction(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const loaded = await requireSetup(ctx)
  if ("response" in loaded) return loaded.response
  const { setup } = loaded
  const available = availableExercises(setup.equipment, setup.bandsKg)
  const errors = validateComposition(body.composition, available)
  if (errors.length) return json(400, { error: "Composition invalide", code: "composition_invalide", details: errors })
  const composition = normalize(body.composition)

  // Une seule séance à faire à la fois : on renvoie celle qui attend.
  const enAttente = await loadPending(ctx)
  if (enAttente) {
    return json(409, { error: "Une séance est déjà à faire", code: "seance_en_attente", session: enAttente })
  }

  const [recentes, bases] = await Promise.all([loadRecentDone(ctx), loadBases(ctx)])
  const result = await choisirExercices({
    demande: {
      supersets: composition.supersets.map((s, i) => ({ position: i + 1, focus: s.focus, exercise_count: s.exercise_count })),
      echauffement: true,
    },
    gardes: [],
    available,
    bandsKg: setup.bandsKg,
    avecBase: Object.keys(bases),
    groupes: groupesDe(composition.supersets.map((s) => s.focus)),
    recentes,
    logTag: `[${TAG}] ${ctx.userId}`,
  })
  if (!result.ok) return invalidModel(ctx, result.errors)

  const content = assembler({
    composition,
    choix: result.choix,
    gardes: composition.supersets.map(() => null),
    bases,
    bandsKg: setup.bandsKg,
  })

  const weekStart = mondayOf(todayISO())
  const { count, error: countError } = await ctx.admin
    .from("strength_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", ctx.userId)
    .eq("week_start", weekStart)
  if (countError) return internalError(TAG, countError.message)

  const { data: session, error: insertError } = await ctx.admin
    .from("strength_sessions")
    .insert({
      user_id: ctx.userId,
      week_start: weekStart,
      position: count ?? 0,
      kind: null,
      title: content.title,
      content,
    })
    .select("*")
    .single()
  if (insertError || !session) return internalError(TAG, insertError?.message ?? "insert sans ligne")

  await addMissingBases(ctx, dosesDeSeance(content))
  return json(200, { session })
}

async function updateAction(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const editable = await loadEditable(ctx, body.session_id)
  if ("response" in editable) return editable.response
  const { session } = editable
  const loaded = await requireSetup(ctx)
  if ("response" in loaded) return loaded.response
  const { setup } = loaded
  const available = availableExercises(setup.equipment, setup.bandsKg)
  const errors = validateComposition(body.composition, available)
  if (errors.length) return json(400, { error: "Composition invalide", code: "composition_invalide", details: errors })
  const composition = normalize(body.composition)

  const plan = planMiseAJour(session.content, composition)
  const regenererEchauffement = plan.echauffementGarde === null
  let choix: Choix | null = null
  let bases: Bases = {}
  if (plan.aGenerer.length || regenererEchauffement) {
    const gardes = [
      ...plan.gardes.flatMap((g) => g?.exercises ?? []),
      ...(plan.echauffementGarde ? [...plan.echauffementGarde.warmup, ...plan.echauffementGarde.cooldown] : []),
    ].map((d) => d.slug)
    const [recentes, loadedBases] = await Promise.all([loadRecentDone(ctx), loadBases(ctx)])
    bases = loadedBases
    const result = await choisirExercices({
      demande: { supersets: plan.aGenerer, echauffement: regenererEchauffement },
      gardes,
      available,
      bandsKg: setup.bandsKg,
      avecBase: Object.keys(bases),
      groupes: groupesDe(composition.supersets.map((s) => s.focus)),
      recentes,
      logTag: `[${TAG}] ${ctx.userId}`,
    })
    if (!result.ok) return invalidModel(ctx, result.errors)
    choix = result.choix
  }

  const content = assembler({
    composition,
    choix,
    gardes: plan.gardes,
    echauffementGarde: plan.echauffementGarde,
    bases,
    bandsKg: setup.bandsKg,
  })
  const response = await saveContent(ctx, session.id as string, content)
  if (response.ok && choix) await addMissingBases(ctx, dosesDeSeance(content))
  return response
}

async function adjustAction(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const editable = await loadEditable(ctx, body.session_id)
  if ("response" in editable) return editable.response
  const { session } = editable
  const slug = body.slug
  const exercise = typeof slug === "string" ? EXERCISE_INDEX[slug] : undefined
  const current = exercise ? dosesDeSeance(session.content).find((d) => d.slug === slug) : undefined
  if (!exercise || !current) return json(400, BAD_SETTING)
  const loaded = await requireSetup(ctx)
  if ("response" in loaded) return loaded.response
  const { setup } = loaded

  const dose: Dose = { slug: exercise.slug }
  if (exercise.mode === "reps") {
    if (!isIntIn(body.reps, REPS_MIN, REPS_MAX) || body.duration_sec != null) return json(400, BAD_SETTING)
    dose.reps = body.reps
  } else {
    if (!isIntIn(body.duration_sec, DURATION_MIN_SEC, DURATION_MAX_SEC) || body.reps != null) return json(400, BAD_SETTING)
    dose.duration_sec = body.duration_sec
  }
  if (exercise.equipment.includes("band")) {
    if (body.band_kg === undefined || body.band_kg === null) {
      if (current.band_kg != null) dose.band_kg = current.band_kg
    } else if (typeof body.band_kg === "number" && setup.bandsKg.includes(body.band_kg)) {
      dose.band_kg = body.band_kg
    } else {
      return json(400, BAD_SETTING)
    }
  } else if (body.band_kg != null) {
    return json(400, BAD_SETTING)
  }

  // L'élastique joué de l'exercice laisse la place au réglage (sinon bandOf le préfère).
  const response = await saveContent(ctx, session.id as string, ajuster(session.content as SessionContent, exercise.slug, dose), {
    bands_used: sansBande(session.bands_used, exercise.slug),
  })
  if (!response.ok) return response
  const { error } = await ctx.admin.from("strength_exercise_bases").upsert({
    user_id: ctx.userId,
    slug: exercise.slug,
    reps: dose.reps ?? null,
    duration_sec: dose.duration_sec ?? null,
    band_kg: dose.band_kg ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,slug" })
  if (error) console.error(`[${TAG}] ${ctx.userId} base non écrite (${exercise.slug}) :`, error.message)
  return response
}

async function replaceAction(ctx: Ctx, body: Record<string, unknown>): Promise<Response> {
  const editable = await loadEditable(ctx, body.session_id)
  if ("response" in editable) return editable.response
  const { session } = editable
  const { block_index: blockIndex, slug, new_slug: newSlug } = body
  if (!Number.isInteger(blockIndex) || typeof slug !== "string" || typeof newSlug !== "string") {
    return json(400, BAD_REPLACEMENT)
  }
  const loaded = await requireSetup(ctx)
  if ("response" in loaded) return loaded.response
  const { setup } = loaded
  const available = availableExercises(setup.equipment, setup.bandsKg)
  const index = blockIndex as number
  if (!remplacants(session.content, index, slug, available).some((e) => e.slug === newSlug)) {
    return json(400, BAD_REPLACEMENT)
  }

  const content = session.content as SessionContent
  const old = dosesDeSeance({ blocks: [content.blocks[index]] }).find((d) => d.slug === slug)
  const bases = await loadBases(ctx, [newSlug])
  const dose = doseDe(EXERCISE_INDEX[newSlug], {
    base: bases[newSlug],
    bandsKg: setup.bandsKg,
    bandChoisie: old?.band_kg ?? null,
  })
  const response = await saveContent(ctx, session.id as string, remplacer(content, index, slug, dose), {
    bands_used: sansBande(session.bands_used, slug),
  })
  if (response.ok) await addMissingBases(ctx, [dose])
  return response
}

Deno.serve(withCors(async (req) => {
  try {
    return await handleRequest(req)
  } catch (err) {
    return internalError(TAG, err)
  }
}))
