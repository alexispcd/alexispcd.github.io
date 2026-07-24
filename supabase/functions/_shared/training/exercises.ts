// Catalogue curaté d'exercices de renforcement réalisables à la maison avec, au
// plus, un tapis de sol et une chaise. Aucun autre matériel (pas d'élastique).
//
// Le modèle ne compose PAS de noms d'exercices : il pioche des `slug` dans ce
// catalogue. Le code enrichit ensuite chaque exercice (name, description,
// category, equipment) depuis l'index par slug.
//
// L'athlète est entraîné : on assume des variantes exigeantes (unilatéral,
// leviers longs, isométries longues, excentriques). On exclut tout ce qui
// demande de la souplesse extrême, une position acrobatique ou présente un
// risque de chute.

export type ExerciseCategory =
  | "activation_mobilite"
  | "fessiers"
  | "ischios"
  | "gainage"
  | "proprioception"
  | "pied_mollets"
  | "haut_corps"

export type Equipment = "none" | "chair"
export type ExerciseMode = "reps" | "duration"

export interface Exercise {
  slug: string
  name: string
  description: string
  category: ExerciseCategory
  equipment: Equipment
  mode: ExerciseMode
  /** Exercice travaillé côté par côté (compte les deux côtés dans l'estimation). */
  unilateral: boolean
  // Valeurs par défaut (le modèle peut les moduler selon le bloc du plan) :
  sets: number
  reps?: number
  duration_sec?: number
  rest_sec: number
  // Dosage de RÉFÉRENCE, exposé au modèle via CATALOG_SUMMARY comme ancrage.
  // Exclusif selon le mode : reps → ref_reps, duration → ref_duration_sec.
  // Pour un exercice unilatéral, la valeur est PAR CÔTÉ (calibrée pour ~45 s de
  // travail par tour, cohérent avec l'estimateur de strength.ts).
  ref_reps?: number
  ref_duration_sec?: number
}

// ── Catalogue ────────────────────────────────────────────────────────────────
export const EXERCISES: Exercise[] = [
  // ── Activation / mobilité (échauffement) ──────────────────────────────────
  {
    slug: "rotations_hanches",
    name: "Cercles de hanche",
    description: "Debout, dessine de grands cercles avec le bassin, sans bouger les épaules. Change de sens à mi-temps.",
    category: "activation_mobilite", equipment: "none", mode: "duration", unilateral: false,
    sets: 1, duration_sec: 40, rest_sec: 15, ref_duration_sec: 30,
  },
  {
    slug: "balancements_jambe",
    name: "Balancements de jambe",
    description: "En appui sur une main, balance une jambe d'avant en arrière puis latéralement. Garde le buste stable.",
    category: "activation_mobilite", equipment: "none", mode: "duration", unilateral: true,
    sets: 1, duration_sec: 30, rest_sec: 10, ref_duration_sec: 20,
  },
  {
    slug: "chat_vache",
    name: "Chat vache",
    description: "À quatre pattes, alterne dos rond et dos creux au rythme de la respiration. Mouvement lent et contrôlé.",
    category: "activation_mobilite", equipment: "none", mode: "duration", unilateral: false,
    sets: 1, duration_sec: 45, rest_sec: 15, ref_duration_sec: 40,
  },
  {
    slug: "rotation_thoracique",
    name: "Rotation thoracique",
    description: "À quatre pattes, une main derrière la tête, ouvre le coude vers le plafond puis reviens. Le bassin reste fixe.",
    category: "activation_mobilite", equipment: "none", mode: "duration", unilateral: true,
    sets: 1, duration_sec: 30, rest_sec: 10, ref_duration_sec: 20,
  },
  {
    slug: "fentes_marchees",
    name: "Fentes marchées",
    description: "Avance en fentes amples, genou arrière proche du sol. Buste droit, poussée franche sur la jambe avant.",
    category: "activation_mobilite", equipment: "none", mode: "reps", unilateral: false,
    sets: 1, reps: 12, rest_sec: 20, ref_reps: 12,
  },
  {
    slug: "squats_air",
    name: "Squats au poids du corps",
    description: "Pieds largeur de bassin, descends fesses vers l'arrière jusqu'aux cuisses parallèles, remonte en poussant dans les talons.",
    category: "activation_mobilite", equipment: "none", mode: "reps", unilateral: false,
    sets: 1, reps: 20, rest_sec: 20, ref_reps: 15,
  },

  // ── Fessiers ──────────────────────────────────────────────────────────────
  {
    slug: "pont_fessier",
    name: "Pont fessier",
    description: "Sur le dos, pieds au sol, monte le bassin en serrant les fessiers, épaules ancrées. Marque un temps en haut.",
    category: "fessiers", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 15, rest_sec: 60, ref_reps: 15,
  },
  {
    slug: "pont_fessier_unipodal",
    name: "Pont fessier une jambe",
    description: "En pont, tends une jambe et monte le bassin sur l'appui unique. Garde le bassin bien horizontal.",
    category: "fessiers", equipment: "none", mode: "reps", unilateral: true,
    sets: 3, reps: 10, rest_sec: 45, ref_reps: 8,
  },
  {
    slug: "squat_bulgare",
    name: "Squat bulgare",
    description: "Pied arrière posé sur la chaise, descends sur la jambe avant jusqu'à la cuisse parallèle, remonte. Buste légèrement penché.",
    category: "fessiers", equipment: "chair", mode: "reps", unilateral: true,
    sets: 3, reps: 10, rest_sec: 60, ref_reps: 8,
  },
  {
    slug: "fente_arriere",
    name: "Fente arrière",
    description: "Recule une jambe et descends le genou vers le sol, puis reviens en poussant sur la jambe avant. Alterne les côtés.",
    category: "fessiers", equipment: "none", mode: "reps", unilateral: true,
    sets: 3, reps: 10, rest_sec: 45, ref_reps: 8,
  },
  {
    slug: "hip_thrust_chaise",
    name: "Hip thrust sur chaise",
    description: "Haut du dos posé sur la chaise, pieds au sol, monte le bassin à l'horizontale en serrant les fessiers.",
    category: "fessiers", equipment: "chair", mode: "reps", unilateral: false,
    sets: 3, reps: 15, rest_sec: 60, ref_reps: 14,
  },
  {
    slug: "abduction_hanche",
    name: "Abduction de hanche",
    description: "Allongé sur le côté, jambes tendues, monte lentement la jambe du dessus puis redescends sans la poser.",
    category: "fessiers", equipment: "none", mode: "reps", unilateral: true,
    sets: 3, reps: 15, rest_sec: 30, ref_reps: 10,
  },
  {
    slug: "step_up_chaise",
    name: "Montée sur chaise",
    description: "Monte sur la chaise avec une jambe, tends la hanche en haut, redescends en contrôle. Ne prends pas d'élan.",
    category: "fessiers", equipment: "chair", mode: "reps", unilateral: true,
    sets: 3, reps: 10, rest_sec: 45, ref_reps: 8,
  },
  {
    slug: "chaise_murale",
    name: "Chaise contre le mur",
    description: "Dos au mur, cuisses parallèles au sol, tiens la position sans t'asseoir. Poids réparti sur les talons.",
    category: "fessiers", equipment: "none", mode: "duration", unilateral: false,
    sets: 3, duration_sec: 45, rest_sec: 45, ref_duration_sec: 45,
  },

  // ── Ischio-jambiers ───────────────────────────────────────────────────────
  {
    slug: "nordic_curl_assiste",
    name: "Nordic curl assisté",
    description: "À genoux, chevilles bloquées, descends le buste vers l'avant en freinant avec les ischios, aide-toi des mains en bas.",
    category: "ischios", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 6, rest_sec: 60, ref_reps: 8,
  },
  {
    slug: "slider_ischio",
    name: "Curl ischio glissé",
    description: "En pont, talons sur une serviette, glisse les pieds loin puis ramène-les en gardant le bassin haut. Sol lisse requis.",
    category: "ischios", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 10, rest_sec: 45, ref_reps: 12,
  },
  {
    slug: "pont_ischio_chaise",
    name: "Pont ischios talons sur chaise",
    description: "Sur le dos, talons posés sur la chaise, jambes tendues, monte le bassin en tirant avec les ischios.",
    category: "ischios", equipment: "chair", mode: "reps", unilateral: false,
    sets: 3, reps: 12, rest_sec: 45, ref_reps: 12,
  },
  {
    slug: "good_morning_pdc",
    name: "Good morning au poids du corps",
    description: "Debout, mains sur la nuque, penche le buste vers l'avant dos plat en poussant les hanches en arrière, puis reviens.",
    category: "ischios", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 12, rest_sec: 30, ref_reps: 15,
  },
  {
    slug: "souleve_terre_unipodal",
    name: "Soulevé de terre une jambe",
    description: "Sur une jambe, penche le buste en tendant l'autre jambe derrière, dos plat, puis reviens à la verticale.",
    category: "ischios", equipment: "none", mode: "reps", unilateral: true,
    sets: 3, reps: 10, rest_sec: 60, ref_reps: 8,
  },

  // ── Gainage ───────────────────────────────────────────────────────────────
  {
    slug: "planche",
    name: "Planche",
    description: "Appui sur les avant-bras et la pointe des pieds, corps aligné. Gaine les abdos et les fessiers, sans creuser le dos.",
    category: "gainage", equipment: "none", mode: "duration", unilateral: false,
    sets: 3, duration_sec: 60, rest_sec: 30, ref_duration_sec: 45,
  },
  {
    slug: "planche_laterale",
    name: "Planche latérale",
    description: "Sur un avant-bras, corps aligné sur le côté, monte le bassin et tiens. Change de côté à chaque série.",
    category: "gainage", equipment: "none", mode: "duration", unilateral: true,
    sets: 3, duration_sec: 40, rest_sec: 30, ref_duration_sec: 25,
  },
  {
    slug: "planche_leve_jambe",
    name: "Planche avec lever de jambe",
    description: "En planche, lève une jambe tendue puis l'autre en alternance, sans bouger le bassin.",
    category: "gainage", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 12, rest_sec: 30, ref_reps: 14,
  },
  {
    slug: "dead_bug",
    name: "Dead bug",
    description: "Sur le dos, bras et jambes levés, descends un bras et la jambe opposée en gardant le bas du dos plaqué au sol.",
    category: "gainage", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 15, rest_sec: 45, ref_reps: 14,
  },
  {
    slug: "bird_dog",
    name: "Bird dog",
    description: "À quatre pattes, tends un bras et la jambe opposée à l'horizontale, tiens l'alignement, puis change de côté.",
    category: "gainage", equipment: "none", mode: "reps", unilateral: true,
    sets: 3, reps: 10, rest_sec: 30, ref_reps: 8,
  },
  {
    slug: "hollow_hold",
    name: "Hollow hold",
    description: "Sur le dos, bras et jambes tendus au-dessus du sol, bas du dos plaqué, tiens la position creusée.",
    category: "gainage", equipment: "none", mode: "duration", unilateral: false,
    sets: 3, duration_sec: 30, rest_sec: 40, ref_duration_sec: 35,
  },
  {
    slug: "releve_jambes",
    name: "Relevé de jambes",
    description: "Sur le dos, jambes tendues, descends-les lentement sans décoller le bas du dos, puis remonte.",
    category: "gainage", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 12, rest_sec: 30, ref_reps: 14,
  },
  {
    slug: "copenhague_courte",
    name: "Planche de Copenhague genou posé",
    description: "En planche latérale, genou de la jambe haute posé sur la chaise, monte le bassin et tiens. Version d'entrée.",
    category: "gainage", equipment: "chair", mode: "duration", unilateral: true,
    sets: 3, duration_sec: 20, rest_sec: 40, ref_duration_sec: 25,
  },
  {
    slug: "copenhague_longue",
    name: "Planche de Copenhague mollet posé",
    description: "En planche latérale, mollet de la jambe haute posé sur la chaise, jambe tendue, monte le bassin et tiens. Version exigeante.",
    category: "gainage", equipment: "chair", mode: "duration", unilateral: true,
    sets: 3, duration_sec: 20, rest_sec: 45, ref_duration_sec: 20,
  },

  // ── Proprioception ────────────────────────────────────────────────────────
  // Pas d'équilibre unipodal statique : peu de transfert vers la course et
  // pénible à dérouler dans le player. La proprioception passe par des
  // exercices dynamiques (réception, appui contrôlé, réactivité de cheville).
  {
    slug: "corde_imaginaire",
    name: "Corde à sauter imaginaire",
    description: "Sauts légers sur place, pieds joints, en poussant depuis les chevilles. Reste sur l'avant du pied, contact au sol bref.",
    category: "proprioception", equipment: "none", mode: "duration", unilateral: false,
    sets: 3, duration_sec: 40, rest_sec: 30, ref_duration_sec: 45,
  },
  {
    slug: "marche_pointes",
    name: "Marche sur pointes",
    description: "Marche sur place ou en aller-retour sur la pointe des pieds, talons hauts et bassin gainé. Pas courts et réguliers.",
    category: "proprioception", equipment: "none", mode: "duration", unilateral: false,
    sets: 2, duration_sec: 45, rest_sec: 30, ref_duration_sec: 40,
  },
  {
    slug: "equilibre_reach",
    name: "Équilibre avec touches au sol",
    description: "Sur une jambe, penche-toi pour toucher le sol devant puis sur les côtés avec la main, sans poser l'autre pied.",
    category: "proprioception", equipment: "none", mode: "reps", unilateral: true,
    sets: 2, reps: 8, rest_sec: 30, ref_reps: 8,
  },
  {
    slug: "squat_unipodal_chaise",
    name: "Squat une jambe sur chaise",
    description: "Assieds-toi sur la chaise sur une seule jambe puis relève-toi sans élan. Contrôle la descente.",
    category: "proprioception", equipment: "chair", mode: "reps", unilateral: true,
    sets: 3, reps: 8, rest_sec: 45, ref_reps: 8,
  },
  {
    slug: "sauts_unipodaux",
    name: "Sauts stabilisés sur une jambe",
    description: "Petits sauts sur une jambe, amortis et fige la réception une seconde avant le saut suivant. Genou dans l'axe.",
    category: "proprioception", equipment: "none", mode: "reps", unilateral: true,
    sets: 3, reps: 10, rest_sec: 40, ref_reps: 8,
  },

  // ── Pied / mollets ────────────────────────────────────────────────────────
  {
    slug: "montees_mollets",
    name: "Montées sur pointes",
    description: "Debout, monte lentement sur la pointe des pieds puis redescends en contrôle. Amplitude complète.",
    category: "pied_mollets", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 20, rest_sec: 30, ref_reps: 15,
  },
  {
    slug: "montees_mollets_unipodal",
    name: "Montée sur pointe une jambe",
    description: "Sur une jambe, monte sur la pointe puis redescends lentement. Appuie une main sur un mur pour l'équilibre.",
    category: "pied_mollets", equipment: "none", mode: "reps", unilateral: true,
    sets: 3, reps: 12, rest_sec: 45, ref_reps: 8,
  },
  {
    slug: "mollet_genou_flechi",
    name: "Mollet genou fléchi",
    description: "Genoux légèrement pliés, monte sur les pointes pour cibler le soléaire, puis redescends en contrôle.",
    category: "pied_mollets", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 18, rest_sec: 30, ref_reps: 15,
  },
  {
    slug: "excentrique_mollet",
    name: "Mollet excentrique",
    description: "Monte sur deux pointes, transfère sur une jambe et descends très lentement le talon sous le niveau du pied.",
    category: "pied_mollets", equipment: "none", mode: "reps", unilateral: true,
    // Injecté d'office dans le bloc Force par strength.ts (withMandatoryCalf) :
    // le modèle ne le choisit jamais. Dosage bas, le geste est lent.
    sets: 3, reps: 10, rest_sec: 40, ref_reps: 10,
  },
  {
    slug: "arche_pied",
    name: "Renforcement de l'arche",
    description: "Pied à plat, creuse la voûte en rapprochant l'avant-pied du talon sans plier les orteils. Tiens brièvement.",
    category: "pied_mollets", equipment: "none", mode: "duration", unilateral: false,
    sets: 2, duration_sec: 40, rest_sec: 20, ref_duration_sec: 40,
  },
  {
    slug: "pogo_hops",
    name: "Sautillements de cheville",
    description: "Petits rebonds sur place jambes quasi tendues, en poussant depuis les chevilles. Contact au sol bref et élastique.",
    category: "pied_mollets", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 20, rest_sec: 30, ref_reps: 20,
  },

  // ── Haut du corps (complément léger) ──────────────────────────────────────
  {
    slug: "pompes",
    name: "Pompes",
    description: "Mains sous les épaules, corps gainé, descends la poitrine près du sol puis pousse. Coudes proches du corps.",
    category: "haut_corps", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 12, rest_sec: 45, ref_reps: 12,
  },
  {
    slug: "pompes_inclinees_chaise",
    name: "Pompes inclinées sur chaise",
    description: "Mains sur la chaise, corps gainé en pente, descends la poitrine vers l'assise puis pousse. Version accessible.",
    category: "haut_corps", equipment: "chair", mode: "reps", unilateral: false,
    sets: 3, reps: 15, rest_sec: 40, ref_reps: 15,
  },
  {
    slug: "pompes_pieds_sureleves",
    name: "Pompes pieds surélevés",
    description: "Pieds posés sur la chaise, mains au sol, descends la poitrine puis pousse. Version plus exigeante pour les épaules.",
    category: "haut_corps", equipment: "chair", mode: "reps", unilateral: false,
    sets: 3, reps: 10, rest_sec: 45, ref_reps: 10,
  },
  {
    slug: "dips_chaise",
    name: "Dips sur chaise",
    description: "Mains sur le bord de la chaise, jambes devant, descends les coudes à 90 degrés puis remonte. Épaules basses.",
    category: "haut_corps", equipment: "chair", mode: "reps", unilateral: false,
    sets: 3, reps: 12, rest_sec: 45, ref_reps: 12,
  },
  {
    slug: "superman",
    name: "Superman",
    description: "À plat ventre, décolle simultanément bras et jambes tendus en contractant les lombaires, puis redescends.",
    category: "haut_corps", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 12, rest_sec: 30, ref_reps: 14,
  },
  {
    slug: "shoulder_taps",
    name: "Touches d'épaule en planche",
    description: "En planche sur les mains, touche l'épaule opposée avec une main sans balancer le bassin. Alterne les côtés.",
    category: "haut_corps", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 16, rest_sec: 30, ref_reps: 16,
  },
  {
    slug: "pike_push_up",
    name: "Pompes en pique",
    description: "En V renversé, bassin haut, descends le sommet de la tête vers le sol puis pousse. Cible les épaules.",
    category: "haut_corps", equipment: "none", mode: "reps", unilateral: false,
    sets: 3, reps: 8, rest_sec: 45, ref_reps: 10,
  },
]

// ── Index et helpers ─────────────────────────────────────────────────────────

/** Index par slug pour l'enrichissement et la validation. */
export const EXERCISE_INDEX: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.slug, e]),
)

export const isExerciseSlug = (slug: unknown): slug is string =>
  typeof slug === "string" && slug in EXERCISE_INDEX

// ── Structure de blocs (ordre fixe) ───────────────────────────────────────────
// La séance renfo suit toujours 4 blocs dans cet ordre. Le 4e (bonus) alterne
// d'une semaine à l'autre entre deux thèmes.

export type BonusKind = "proprio_pied" | "haut_corps"

/** Catégories autorisées pour chaque bloc (par index 0..3). */
export const BLOCK_CATEGORIES: ExerciseCategory[][] = [
  ["activation_mobilite"],           // 0 échauffement
  ["fessiers", "ischios"],           // 1 force
  ["gainage"],                       // 2 gainage
  [],                                // 3 bonus : selon BONUS_CATEGORIES
]

export const BONUS_CATEGORIES: Record<BonusKind, ExerciseCategory[]> = {
  proprio_pied: ["proprioception", "pied_mollets"],
  haut_corps: ["haut_corps"],
}

/** Libellés de bloc déterministes (posés à l'enrichissement, hors tiret cadratin). */
export const BLOCK_THEMES: Record<number, string> = {
  0: "Échauffement",
  1: "Force",
  2: "Gainage",
}
export const BONUS_THEME: Record<BonusKind, string> = {
  proprio_pied: "Proprioception et pied",
  haut_corps: "Haut du corps",
}

/**
 * Parité du bloc bonus : semaines IMPAIRES = proprioception / pied, semaines
 * PAIRES = haut du corps. Alternance stricte d'une semaine à l'autre.
 */
export const bonusKindForWeek = (weekNumber: number): BonusKind =>
  weekNumber % 2 === 1 ? "proprio_pied" : "haut_corps"

/** Détecte le type de bonus d'un bloc d'après les catégories de ses exercices. */
export const detectBonusKind = (categories: ExerciseCategory[]): BonusKind | null => {
  if (categories.length === 0) return null
  if (categories.every((c) => c === "haut_corps")) return "haut_corps"
  if (categories.every((c) => c === "proprioception" || c === "pied_mollets")) return "proprio_pied"
  return null
}

/** Dosage de référence lisible (« 15 reps » ou « 30 s ») pour CATALOG_SUMMARY. */
const refDose = (e: Exercise): string =>
  e.ref_duration_sec != null ? `${e.ref_duration_sec} s` : `${e.ref_reps ?? 0} reps`

/**
 * Résumé compact du catalogue pour injection dans les prompts : une ligne par
 * exercice « slug · mode · equipment · dosage de référence », groupé par
 * catégorie, SANS les descriptions (économie de tokens). Le dosage de référence
 * ancre le modèle pour qu'il estime la durée (voir la formule dans RENFO_RULES).
 */
export const CATALOG_SUMMARY: string = (() => {
  const byCat = new Map<ExerciseCategory, Exercise[]>()
  for (const e of EXERCISES) {
    const arr = byCat.get(e.category) ?? []
    arr.push(e)
    byCat.set(e.category, arr)
  }
  const lines: string[] = []
  for (const [cat, list] of byCat) {
    lines.push(`[${cat}]`)
    for (const e of list) {
      const uni = e.unilateral ? " unilat" : ""
      lines.push(`  ${e.slug} · ${e.mode} · ${e.equipment}${uni} · ref ${refDose(e)}`)
    }
  }
  return lines.join("\n")
})()
