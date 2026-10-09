// Identifiants des modules attribuables à un compte. Doit rester aligné sur les
// descripteurs du front (src/apps/<id>/module.js), hors module admin réservé au rôle.
export const MODULE_IDS = ["cotes", "training", "revisions", "veille", "renfo"] as const

export type ModuleId = typeof MODULE_IDS[number]

export const isModuleId = (value: unknown): value is ModuleId =>
  typeof value === "string" && (MODULE_IDS as readonly string[]).includes(value)
