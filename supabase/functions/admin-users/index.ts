import "@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import { loadAccess } from "../_shared/access.ts"
import { withCors } from "../_shared/cors.ts"
import { isModuleId, type ModuleId } from "../_shared/modules.ts"

// Bannissement "permanent" (100 ans) pour désactiver un compte, "none" pour le réactiver.
const BAN_FOREVER = "876000h"
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const json = (status: number, body: unknown) => Response.json(body, { status })

function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  )
}

/** Vérifie le JWT porté par la requête. Retourne l'id utilisateur ou null. */
async function authenticate(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return null

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user.id
}

/** Liste de modules valide et dédoublonnée, ou null si une valeur est inconnue. */
function parseModules(value: unknown): ModuleId[] | null {
  if (!Array.isArray(value) || !value.every(isModuleId)) return null
  return [...new Set(value)]
}

Deno.serve(withCors(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée" })
  try {
    return await handleRequest(req)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error("[admin-users] uncaught:", detail)
    return json(500, { error: "Internal server error" })
  }
}))

async function handleRequest(req: Request): Promise<Response> {
  const userId = await authenticate(req)
  if (!userId) return json(401, { error: "Unauthorized" })

  // Le rôle est lu côté serveur, jamais depuis le client.
  const admin = adminClient()
  const access = await loadAccess(admin, userId)
  if (access.role !== "admin") return json(403, { error: "Accès réservé à l'administrateur" })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (err) {
    return json(400, { error: "Corps invalide", detail: String(err) })
  }

  switch (body?.action) {
    case "list": return await handleList(admin)
    case "create": return await handleCreate(admin, body)
    case "set_modules": return await withTarget(admin, body, (id) => setModules(admin, id, body.modules))
    case "disable": return await withTarget(admin, body, (id) => setBan(admin, id, BAN_FOREVER))
    case "enable": return await withTarget(admin, body, (id) => setBan(admin, id, "none"))
    case "delete": return await withTarget(admin, body, (id) => deleteUser(admin, id))
    default: return json(400, { error: "Action inconnue" })
  }
}

/** Valide user_id et refuse toute action sur un compte admin, y compris le sien. */
async function withTarget(
  admin: SupabaseClient,
  body: Record<string, unknown>,
  run: (userId: string) => Promise<Response>,
): Promise<Response> {
  const targetId = body.user_id
  if (typeof targetId !== "string" || !UUID_RE.test(targetId)) return json(400, { error: "user_id invalide" })
  const target = await loadAccess(admin, targetId)
  if (target.role === "admin") return json(403, { error: "Action impossible sur un compte administrateur" })
  return await run(targetId)
}

async function handleList(admin: SupabaseClient): Promise<Response> {
  const { data: { users }, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw new Error(`listUsers: ${error.message}`)

  const [profiles, modules, coros] = await Promise.all([
    admin.from("profiles").select("id, role"),
    admin.from("user_modules").select("user_id, module_id"),
    admin.from("coros_tokens").select("user_id"),
  ])
  for (const r of [profiles, modules, coros]) if (r.error) throw new Error(r.error.message)

  const roleOf = new Map((profiles.data ?? []).map((p: { id: string; role: string }) => [p.id, p.role]))
  const corosUsers = new Set((coros.data ?? []).map((c: { user_id: string }) => c.user_id))
  const modulesOf = new Map<string, string[]>()
  for (const m of (modules.data ?? []) as { user_id: string; module_id: string }[]) {
    modulesOf.set(m.user_id, [...(modulesOf.get(m.user_id) ?? []), m.module_id])
  }

  const now = Date.now()
  const result = users.map((u) => ({
    id: u.id,
    email: u.email ?? null,
    role: roleOf.get(u.id) === "admin" ? "admin" : "user",
    created_at: u.created_at,
    last_sign_in_at: u.last_sign_in_at ?? null,
    disabled: Boolean(u.banned_until && new Date(u.banned_until).getTime() > now),
    coros_connected: corosUsers.has(u.id),
    modules: modulesOf.get(u.id) ?? [],
  }))
  result.sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))
  return json(200, { users: result })
}

async function handleCreate(admin: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  if (!EMAIL_RE.test(email)) return json(400, { error: "Adresse email invalide" })
  const modules = parseModules(body.modules ?? [])
  if (!modules) return json(400, { error: "Module inconnu" })

  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true })
  if (error) {
    if (error.code === "email_exists" || /already been registered|already exists/i.test(error.message)) {
      return json(409, { error: "Un compte existe déjà avec cet email" })
    }
    throw new Error(`createUser: ${error.message}`)
  }

  // Le profil est créé par le trigger on_auth_user_created.
  if (modules.length > 0) {
    const { error: grantError } = await admin
      .from("user_modules")
      .insert(modules.map((module_id) => ({ user_id: data.user.id, module_id })))
    if (grantError) {
      // Compte sans droits cohérents : on annule la création plutôt que de le laisser à moitié.
      await admin.auth.admin.deleteUser(data.user.id)
      throw new Error(`user_modules: ${grantError.message}`)
    }
  }
  return json(200, { user: { id: data.user.id, email, modules } })
}

async function setModules(admin: SupabaseClient, userId: string, value: unknown): Promise<Response> {
  const modules = parseModules(value)
  if (!modules) return json(400, { error: "Module inconnu" })

  // Remplacement atomique (delete puis insert dans une seule transaction SQL).
  const { error } = await admin.rpc("set_user_modules", { p_user_id: userId, p_modules: modules })
  if (error) throw new Error(`set_user_modules: ${error.message}`)
  return json(200, { ok: true, modules })
}

async function setBan(admin: SupabaseClient, userId: string, duration: string): Promise<Response> {
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: duration })
  if (error) throw new Error(`updateUserById: ${error.message}`)
  return json(200, { ok: true, disabled: duration !== "none" })
}

async function deleteUser(admin: SupabaseClient, userId: string): Promise<Response> {
  // Toutes les tables publiques sont en ON DELETE CASCADE sur auth.users.
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) throw new Error(`deleteUser: ${error.message}`)
  return json(200, { ok: true })
}
