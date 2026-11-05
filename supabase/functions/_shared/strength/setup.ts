// Matériel Renfo du compte (profil et élastiques), lu par renfo-session.

import type { SupabaseClient } from "npm:@supabase/supabase-js@^2"
import type { Equipment } from "./catalog.ts"

export const PROFILE_MISSING = {
  error: "Règle d'abord ton matériel et ta fréquence",
  code: "profile_missing",
}

export interface StrengthSetup {
  frequency: 1 | 2 | 3
  /** Matériel hors élastiques. */
  equipment: Equipment[]
  bandsKg: number[]
}

/** Profil et élastiques du compte, ou null sans profil. `admin` : client service role. */
export async function loadStrengthSetup(admin: SupabaseClient, userId: string): Promise<StrengthSetup | null> {
  const [profile, bands] = await Promise.all([
    admin.from("strength_profiles").select("frequency, equipment").eq("user_id", userId).maybeSingle(),
    admin.from("strength_bands").select("kg").eq("user_id", userId).order("kg"),
  ])
  if (profile.error) throw new Error(`strength_profiles: ${profile.error.message}`)
  if (bands.error) throw new Error(`strength_bands: ${bands.error.message}`)
  if (!profile.data) return null
  return {
    frequency: profile.data.frequency as 1 | 2 | 3,
    equipment: (profile.data.equipment ?? []) as Equipment[],
    bandsKg: (bands.data ?? []).map((b: { kg: number | string }) => Number(b.kg)),
  }
}
