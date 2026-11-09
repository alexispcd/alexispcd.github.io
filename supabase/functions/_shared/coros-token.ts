import type { SupabaseClient } from "npm:@supabase/supabase-js@^2"
import { getValidToken } from "./sources/connexions.ts"

/**
 * Jeton d'accès Coros valide pour userId (rafraîchi sous 2 jours, voir
 * sources/connexions.ts). Lève une erreur si aucune connexion n'existe ou si le
 * rafraîchissement échoue : les appelants traitent toute erreur comme
 * « Coros à reconnecter ».
 */
export const getValidCorosToken = (supabaseAdmin: SupabaseClient, userId: string): Promise<string> =>
  getValidToken(supabaseAdmin, userId, "coros")
