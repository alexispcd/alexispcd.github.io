import type { SupabaseClient } from "npm:@supabase/supabase-js@^2"

export type Role = "user" | "admin"

export interface Access {
  role: Role
  modules: string[]
}

/** Vrai si le compte a le module dans user_modules. Aucune exception pour le rôle admin. */
export const hasModule = (access: Access, moduleId: string): boolean =>
  access.modules.includes(moduleId)

/** Charge rôle et modules d'un compte. `admin` doit être un client service role. */
export async function loadAccess(admin: SupabaseClient, userId: string): Promise<Access> {
  const [profile, modules] = await Promise.all([
    admin.from("profiles").select("role").eq("id", userId).maybeSingle(),
    admin.from("user_modules").select("module_id").eq("user_id", userId),
  ])
  if (profile.error) throw new Error(`profiles: ${profile.error.message}`)
  if (modules.error) throw new Error(`user_modules: ${modules.error.message}`)
  return {
    role: profile.data?.role === "admin" ? "admin" : "user",
    modules: (modules.data ?? []).map((row: { module_id: string }) => row.module_id),
  }
}

/**
 * Contrôle d'accès à appeler juste après l'authentification d'une Edge Function
 * rattachée à un module. Renvoie une réponse 403 si l'accès manque, sinon null.
 */
export async function requireModule(
  admin: SupabaseClient,
  userId: string,
  moduleId: string,
  headers: Record<string, string> = {},
): Promise<Response | null> {
  const access = await loadAccess(admin, userId)
  if (hasModule(access, moduleId)) return null
  return Response.json(
    { error: "Accès refusé", detail: `Module ${moduleId} non attribué à ce compte` },
    { status: 403, headers },
  )
}
