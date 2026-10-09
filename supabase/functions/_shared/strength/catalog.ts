// Catalogue des exercices du module Renfo. Module pur, sans import Deno ni npm :
// il est aussi importé par le front. Les textes sont affichés tels quels.
//
// sec_per_rep sert à l'estimation de durée (null en mode duration). ref est le
// dosage de référence (répétitions ou secondes, par côté si unilateral). assist :
// élastique d'assistance, plus il est fort, plus l'exercice est facile. image : nom
// du dossier source dans free-exercise-db (photos dans public/renfo/<slug>-0.webp
// et -1.webp, script scripts/renfo-images.mjs), ou null.

export type Category =
  | "warmup" | "legs" | "posterior_chain" | "calves_feet" | "pull"
  | "push" | "arms" | "core" | "balance" | "cooldown"

export type Equipment = "band" | "bar" | "chair"

/** Hauteur de la barre de traction, qui est mobile. */
export type Anchor = "high" | "mid" | "low"

export type Mode = "reps" | "duration"

export interface Exercise {
  slug: string
  name: string
  category: Category
  equipment: Equipment[]
  anchor: Anchor | null
  unilateral: boolean
  assist: boolean
  mode: Mode
  sec_per_rep: number | null
  ref: number
  setup: string | null
  description: string
  tip: string
  image: string | null
}

export const CATEGORY_LABELS: Record<Category, string> = {
  warmup: "Échauffement",
  legs: "Jambes",
  posterior_chain: "Chaîne postérieure",
  calves_feet: "Mollets et pieds",
  pull: "Tirage",
  push: "Poussée",
  arms: "Bras",
  core: "Tronc",
  balance: "Équilibre",
  cooldown: "Retour au calme",
}

export const EXERCISES: Exercise[] = [
  {slug: "cercles_hanche", name: "Cercles de hanche", category: "warmup", equipment: [], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 8, setup: null, description: "Debout sur une jambe, genou levé à hauteur de hanche, dessine de grands cercles avec le genou vers l'extérieur.", tip: "Garde le bassin face à toi, seule la hanche tourne.", image: "Standing_Hip_Circles"},
  {slug: "balancements_jambe", name: "Balancements de jambe", category: "warmup", equipment: [], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 2, ref: 12, setup: "Une main en appui sur un mur ou la chaise.", description: "Balance une jambe tendue d'avant en arrière, puis sur le côté.", tip: "Amplitude progressive, sans forcer en fin de mouvement.", image: "Front_Leg_Raises"},
  {slug: "ecartes_elastique", name: "Écartés d'élastique", category: "warmup", equipment: ["band"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 15, setup: "Élastique tenu à deux mains, bras tendus devant toi à hauteur d'épaules.", description: "Écarte les bras jusqu'à toucher la poitrine avec l'élastique.", tip: "Serre les omoplates en fin de mouvement, épaules basses.", image: "Band_Pull_Apart"},
  {slug: "suspension_scapulaire", name: "Suspension scapulaire", category: "warmup", equipment: ["bar"], anchor: "high", unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: "Barre en haut, suspendu bras tendus.", description: "Abaisse les épaules pour monter de quelques centimètres sans plier les coudes, puis relâche.", tip: "Le mouvement vient des omoplates, pas des bras.", image: "Scapular_Pull-Up"},
  {slug: "squat_elastique", name: "Squat élastique", category: "legs", equipment: ["band"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 15, setup: "Élastique sous les pieds, l'autre extrémité passée derrière la nuque.", description: "Squat profond puis remonte en poussant dans les talons.", tip: "Genoux dans l'axe des pieds, buste droit.", image: "Squats_-_With_Bands"},
  {slug: "squat_bulgare", name: "Squat bulgare", category: "legs", equipment: ["chair"], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: "Pied arrière posé sur la chaise, pied avant à un grand pas devant.", description: "Descends le genou arrière vers le sol, poids sur la jambe avant, puis remonte.", tip: "Le genou avant reste au-dessus du pied, sans rentrer.", image: "Split_Squat_with_Dumbbells"},
  {slug: "squat_bulgare_elastique", name: "Squat bulgare élastique", category: "legs", equipment: ["chair","band"], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 8, setup: "Pied arrière sur la chaise, élastique sous le pied avant et tenu aux épaules.", description: "Même mouvement que le squat bulgare, chargé par l'élastique.", tip: "Contrôle la descente, l'élastique tire plus fort en haut.", image: "Split_Squat_with_Dumbbells"},
  {slug: "fente_arriere", name: "Fente arrière", category: "legs", equipment: [], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: null, description: "Grand pas en arrière, genou arrière qui frôle le sol, retour en poussant sur le talon avant.", tip: "Buste droit, le poids reste sur la jambe avant.", image: "Crossover_Reverse_Lunge"},
  {slug: "step_up", name: "Step-up", category: "legs", equipment: ["chair"], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: "Chaise stable contre un mur.", description: "Pose un pied sur la chaise et monte en poussant sur ce pied seulement, redescends en contrôlant.", tip: "Ne pousse pas avec la jambe restée au sol.", image: "Step-up_with_Knee_Raise"},
  {slug: "squat_unipodal_chaise", name: "Squat unipodal sur chaise", category: "legs", equipment: ["chair"], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 4, ref: 6, setup: "Debout sur une jambe devant la chaise, l'autre jambe tendue devant.", description: "Descends t'asseoir lentement puis remonte sans poser l'autre pied.", tip: "Si c'est trop dur, effleure la chaise sans t'y poser.", image: "Single-Leg_High_Box_Squat"},
  {slug: "flexion_hanche_elastique", name: "Flexion de hanche élastique", category: "legs", equipment: ["bar","band"], anchor: "low", unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Barre en bas, élastique accroché à la barre et passé à la cheville, dos à la barre.", description: "Monte le genou à hauteur de hanche, marque un temps, redescends.", tip: "Reste grand, c'est la montée de genou du coureur.", image: "Hip_Flexion_with_Band"},
  {slug: "squat_saute", name: "Squat sauté", category: "legs", equipment: [], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 2, ref: 10, setup: null, description: "Squat puis saut vertical explosif, réception souple.", tip: "Réception silencieuse sur l'avant du pied, genoux souples.", image: "Freehand_Jump_Squat"},
  {slug: "sdt_roumain_elastique", name: "Soulevé de terre roumain élastique", category: "posterior_chain", equipment: ["band"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Élastique sous les pieds, tenu à deux mains, jambes presque tendues.", description: "Bascule le buste en avant en reculant les fesses, dos plat, puis redresse-toi.", tip: "Tu dois sentir l'étirement derrière les cuisses, pas dans le dos.", image: "Romanian_Deadlift"},
  {slug: "pont_fessier_unipodal", name: "Pont fessier unipodal", category: "posterior_chain", equipment: [], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Couché sur le dos, un pied au sol, l'autre jambe tendue.", description: "Monte le bassin en poussant dans le talon, marque un temps en haut.", tip: "Le bassin reste horizontal, sans pencher d'un côté.", image: "Single_Leg_Glute_Bridge"},
  {slug: "nordic_curl", name: "Nordic curl assisté", category: "posterior_chain", equipment: ["bar"], anchor: "low", unilateral: false, assist: false, mode: "reps", sec_per_rep: 5, ref: 5, setup: "Barre en bas, à genoux dessous, talons calés sous la barre. Vérifie qu'elle tient avant de commencer.", description: "Descends le buste droit vers l'avant le plus lentement possible, rattrape-toi avec les mains, remonte en t'aidant des bras.", tip: "Hanches tendues du genou à l'épaule, c'est la descente qui compte.", image: "Floor_Glute-Ham_Raise"},
  {slug: "kickback_elastique", name: "Kickback fessier élastique", category: "posterior_chain", equipment: ["bar","band"], anchor: "low", unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Barre en bas, élastique accroché à la barre et passé à la cheville, face à la barre.", description: "Pousse la jambe tendue vers l'arrière, marque un temps, reviens.", tip: "Le dos ne se creuse pas, c'est le fessier qui travaille.", image: "Hip_Extension_with_Bands"},
  {slug: "marche_laterale", name: "Marche latérale élastique", category: "posterior_chain", equipment: ["band"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 2, ref: 12, setup: "Élastique autour des chevilles ou juste au-dessus des genoux.", description: "En demi-squat, fais des pas chassés sur le côté, puis repars dans l'autre sens.", tip: "L'élastique reste tendu en permanence, les pieds ne se touchent jamais.", image: "Monster_Walk"},
  {slug: "abduction_elastique", name: "Abduction debout élastique", category: "posterior_chain", equipment: ["band"], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 15, setup: "Élastique autour des chevilles, une main en appui.", description: "Debout sur une jambe, écarte l'autre jambe tendue sur le côté puis reviens.", tip: "Le buste ne penche pas, le mouvement est petit et contrôlé.", image: "Side_Leg_Raises"},
  {slug: "mollet_excentrique", name: "Mollet excentrique", category: "calves_feet", equipment: [], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 5, ref: 10, setup: "Avant des pieds sur une marche, talons dans le vide.", description: "Monte sur les deux pointes, puis redescends sur une seule jambe en 3 à 4 secondes.", tip: "Descends bien sous le niveau de la marche, la lenteur fait l'exercice.", image: "Standing_Dumbbell_Calf_Raise"},
  {slug: "extension_cheville_elastique", name: "Extension de cheville élastique", category: "calves_feet", equipment: ["band"], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 15, setup: "Assis jambe tendue, élastique passé sous l'avant du pied, extrémités en main.", description: "Pousse la pointe du pied vers l'avant contre l'élastique, puis reviens lentement.", tip: "Seule la cheville bouge, le genou reste tendu.", image: null},
  {slug: "releves_pointes", name: "Relevés de pointes", category: "calves_feet", equipment: [], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 2, ref: 20, setup: "Dos au mur, talons à 30 cm du mur.", description: "Relève l'avant des pieds vers les tibias, puis repose-les.", tip: "Tu dois sentir le devant de la jambe chauffer.", image: null},
  {slug: "tractions_pronation", name: "Tractions pronation", category: "pull", equipment: ["bar"], anchor: "high", unilateral: false, assist: false, mode: "reps", sec_per_rep: 4, ref: 6, setup: "Barre en haut, paumes vers l'avant, mains un peu plus larges que les épaules.", description: "Monte le menton au-dessus de la barre, redescends bras tendus.", tip: "Pas d'élan : abaisse les épaules avant de tirer.", image: "Pullups"},
  {slug: "tractions_supination", name: "Tractions supination", category: "pull", equipment: ["bar"], anchor: "high", unilateral: false, assist: false, mode: "reps", sec_per_rep: 4, ref: 6, setup: "Barre en haut, paumes vers toi, mains à largeur d'épaules.", description: "Monte le menton au-dessus de la barre, redescends bras tendus.", tip: "Coudes vers les côtes en montant.", image: "Chin-Up"},
  {slug: "tractions_assistees", name: "Tractions assistées", category: "pull", equipment: ["bar","band"], anchor: "high", unilateral: false, assist: true, mode: "reps", sec_per_rep: 4, ref: 8, setup: "Barre en haut, élastique noué à la barre, un pied ou un genou dans la boucle.", description: "Monte le menton au-dessus de la barre, redescends bras tendus.", tip: "Plus l'élastique est fort, plus tu es aidé : la progression va vers les bandes plus légères.", image: "Band_Assisted_Pull-Up"},
  {slug: "tractions_negatives", name: "Tractions négatives", category: "pull", equipment: ["bar","chair"], anchor: "high", unilateral: false, assist: false, mode: "reps", sec_per_rep: 6, ref: 5, setup: "Barre en haut, chaise dessous pour te placer menton au-dessus de la barre.", description: "Descends le plus lentement possible jusqu'aux bras tendus, remonte avec la chaise.", tip: "Vise 4 à 5 secondes de descente.", image: "Pullups"},
  {slug: "tirage_vertical_genoux", name: "Tirage vertical à genoux", category: "pull", equipment: ["bar","band"], anchor: "high", unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Barre en haut, élastique accroché à la barre, à genoux dessous.", description: "Tire les mains vers le haut de la poitrine, puis remonte bras tendus.", tip: "Poitrine sortie, coudes vers le bas et l'arrière.", image: "Kneeling_High_Pulley_Row"},
  {slug: "rowing_bucheron", name: "Rowing bûcheron", category: "pull", equipment: ["band"], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Élastique sous le pied avant, buste penché dos plat, main libre sur la cuisse.", description: "Tire le coude vers l'arrière le long du corps, puis tends le bras.", tip: "Le buste ne tourne pas, seul le bras bouge.", image: "One-Arm_Dumbbell_Row"},
  {slug: "tirage_horizontal", name: "Tirage horizontal supination", category: "pull", equipment: ["bar","band"], anchor: "mid", unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Barre à mi-hauteur, élastique accroché à hauteur de poitrine, recule pour le tendre.", description: "Tire les coudes le long du corps paumes vers le haut, puis tends les bras.", tip: "Serre les omoplates à la fin de chaque tirage.", image: null},
  {slug: "rowing_inverse", name: "Rowing inversé", category: "pull", equipment: ["bar"], anchor: "low", unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: "Barre en bas, à hauteur de taille, allongé dessous talons au sol. Seulement si la barre tient ton poids à cette hauteur.", description: "Tire la poitrine vers la barre, corps gainé, puis redescends bras tendus.", tip: "Plus les pieds sont loin, plus c'est dur.", image: "Inverted_Row"},
  {slug: "face_pull", name: "Face pull", category: "pull", equipment: ["bar","band"], anchor: "mid", unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 15, setup: "Barre à mi-hauteur, élastique accroché à hauteur de visage.", description: "Tire vers ton visage en écartant les mains et en ouvrant les coudes.", tip: "Les pouces finissent vers l'arrière, épaules basses.", image: "Face_Pull"},
  {slug: "pompes", name: "Pompes", category: "push", equipment: [], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Mains sous les épaules, corps gainé.", description: "Descends la poitrine près du sol puis repousse.", tip: "Coudes à 45° du corps, pas écartés à l'horizontale.", image: "Pushups"},
  {slug: "pompes_elastique", name: "Pompes élastique", category: "push", equipment: ["band"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: "Élastique passé dans le dos, extrémités tenues sous les mains.", description: "Pompes classiques, l'élastique charge la poussée en haut.", tip: "Corps aligné de la tête aux talons.", image: "Pushups"},
  {slug: "pompes_pieds_sureleves", name: "Pompes pieds surélevés", category: "push", equipment: ["chair"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: "Pieds sur la chaise, mains au sol.", description: "Pompes en gardant le corps aligné.", tip: "Le bassin ne s'affaisse pas.", image: "Push-Ups_With_Feet_Elevated"},
  {slug: "pompes_piquees", name: "Pompes piquées", category: "push", equipment: [], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 8, setup: "Fesses hautes, corps en V inversé.", description: "Plie les coudes pour amener le haut de la tête vers le sol, puis repousse.", tip: "Prépare les tractions et le développé, garde les coudes serrés.", image: null},
  {slug: "developpe_epaules_elastique", name: "Développé épaules élastique", category: "push", equipment: ["band"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Élastique sous les pieds, mains à hauteur d'épaules.", description: "Pousse les mains au-dessus de la tête, puis redescends.", tip: "Abdos serrés, le dos ne se creuse pas.", image: "Shoulder_Press_-_With_Bands"},
  {slug: "dips_chaise", name: "Dips sur chaise", category: "push", equipment: ["chair"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Mains au bord de la chaise derrière toi, jambes devant.", description: "Descends jusqu'à avoir les coudes à 90°, puis remonte.", tip: "Épaules loin des oreilles, coudes vers l'arrière.", image: "Bench_Dips"},
  {slug: "curl_biceps", name: "Curl biceps élastique", category: "arms", equipment: ["band"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Élastique sous les pieds, paumes vers le haut.", description: "Coudes collés au corps, monte les mains aux épaules puis redescends.", tip: "Pas d'élan avec le buste.", image: "Dumbbell_Bicep_Curl"},
  {slug: "curl_marteau", name: "Curl marteau élastique", category: "arms", equipment: ["band"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Élastique sous les pieds, prise neutre, pouces vers le haut.", description: "Coudes collés au corps, monte les mains aux épaules puis redescends.", tip: "Pouces vers le haut tout au long du mouvement.", image: "Hammer_Curls"},
  {slug: "extension_triceps_barre", name: "Extension triceps à la barre", category: "arms", equipment: ["bar","band"], anchor: "high", unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Barre en haut, élastique accroché à la barre, face à elle.", description: "Coudes fixes, pousse les mains vers le bas jusqu'aux bras tendus.", tip: "Seuls les avant-bras bougent.", image: "Triceps_Pushdown_-_Rope_Attachment"},
  {slug: "extension_triceps_tete", name: "Extension triceps au-dessus de la tête", category: "arms", equipment: ["band"], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 12, setup: "Élastique sous le pied, mains derrière la nuque.", description: "Tends les bras vers le plafond, puis redescends derrière la tête.", tip: "Coudes près de la tête, pointés vers le plafond.", image: "Speed_Band_Overhead_Triceps"},
  {slug: "rotation_externe", name: "Rotation externe d'épaule", category: "arms", equipment: ["band"], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 15, setup: "Élastique tenu à deux mains, coude collé au corps plié à 90°.", description: "Fais pivoter l'avant-bras vers l'extérieur contre l'élastique, puis reviens.", tip: "Le coude ne décolle pas du corps.", image: "External_Rotation_with_Band"},
  {slug: "planche", name: "Planche", category: "core", equipment: [], anchor: null, unilateral: false, assist: false, mode: "duration", sec_per_rep: null, ref: 45, setup: "Sur les avant-bras, corps aligné des talons à la tête.", description: "Tiens la position.", tip: "Fessiers et abdos serrés, respire normalement.", image: "Plank"},
  {slug: "planche_laterale", name: "Planche latérale", category: "core", equipment: [], anchor: null, unilateral: true, assist: false, mode: "duration", sec_per_rep: null, ref: 30, setup: "Sur un avant-bras, de côté, pieds l'un sur l'autre.", description: "Bassin levé dans l'alignement du corps, tiens la position.", tip: "Le bassin ne tombe pas vers le sol.", image: "Side_Bridge"},
  {slug: "copenhague", name: "Copenhague", category: "core", equipment: ["chair"], anchor: null, unilateral: true, assist: false, mode: "duration", sec_per_rep: null, ref: 20, setup: "En planche latérale, jambe du dessus posée sur la chaise, l'autre décollée.", description: "Tiens la position, corps aligné.", tip: "Muscle l'intérieur de la cuisse. Commence genou posé sur la chaise si c'est trop dur.", image: null},
  {slug: "pallof_press", name: "Pallof press", category: "core", equipment: ["bar","band"], anchor: "mid", unilateral: true, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: "Barre à mi-hauteur, élastique à hauteur de poitrine, de profil à la barre, élastique tenu contre le sternum.", description: "Tends les bras devant toi, tiens 2 secondes, ramène.", tip: "Le buste ne tourne pas vers la barre.", image: "Pallof_Press"},
  {slug: "dead_bug", name: "Dead bug", category: "core", equipment: [], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: "Sur le dos, bras tendus vers le plafond, genoux levés à 90°.", description: "Allonge en même temps un bras derrière la tête et la jambe opposée, sans toucher le sol, puis change de côté.", tip: "Le bas du dos reste plaqué au sol.", image: "Dead_Bug"},
  {slug: "releve_genoux_suspendu", name: "Relevé de genoux suspendu", category: "core", equipment: ["bar"], anchor: "high", unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 10, setup: "Barre en haut, suspendu bras tendus.", description: "Monte les genoux vers la poitrine, redescends sans balancer.", tip: "Enroule le bassin en haut du mouvement.", image: "Hanging_Leg_Raise"},
  {slug: "releve_jambes_suspendu", name: "Relevé de jambes suspendu", category: "core", equipment: ["bar"], anchor: "high", unilateral: false, assist: false, mode: "reps", sec_per_rep: 3, ref: 8, setup: "Barre en haut, suspendu bras tendus.", description: "Monte les jambes tendues à l'horizontale, redescends sans balancer.", tip: "Plus dur que les genoux, à réserver quand ceux-ci passent facilement.", image: "Hanging_Leg_Raise"},
  {slug: "planche_touchers_epaule", name: "Planche avec touchers d'épaule", category: "core", equipment: [], anchor: null, unilateral: false, assist: false, mode: "reps", sec_per_rep: 2, ref: 20, setup: "En planche bras tendus, pieds écartés.", description: "Touche une épaule avec la main opposée, en alternant.", tip: "Le bassin reste immobile.", image: null},
  {slug: "equilibre_unipodal", name: "Équilibre unipodal yeux fermés", category: "balance", equipment: [], anchor: null, unilateral: true, assist: false, mode: "duration", sec_per_rep: null, ref: 30, setup: null, description: "Debout sur une jambe, genou légèrement fléchi, ferme les yeux et tiens.", tip: "Commence yeux ouverts si tu perds l'équilibre tout de suite.", image: null},
  {slug: "atteintes_etoile", name: "Atteintes en étoile", category: "balance", equipment: [], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 4, ref: 6, setup: null, description: "Sur une jambe, va toucher le sol loin devant, sur le côté puis derrière avec l'autre pied.", tip: "Le genou d'appui reste dans l'axe du pied.", image: null},
  {slug: "montee_pointe_yeux_fermes", name: "Montée sur pointe yeux fermés", category: "balance", equipment: [], anchor: null, unilateral: true, assist: false, mode: "reps", sec_per_rep: 4, ref: 10, setup: null, description: "Sur une jambe, yeux fermés, monte lentement sur la pointe et redescends.", tip: "Une main près du mur pour te rattraper si besoin.", image: null},
  {slug: "etirement_flechisseurs", name: "Étirement des fléchisseurs de hanche", category: "cooldown", equipment: [], anchor: null, unilateral: true, assist: false, mode: "duration", sec_per_rep: null, ref: 40, setup: "Un genou au sol, l'autre pied devant.", description: "Avance le bassin en gardant le buste droit.", tip: "Serre le fessier de la jambe arrière pour mieux sentir l'étirement.", image: "Kneeling_Hip_Flexor"},
  {slug: "pigeon", name: "Pigeon couché", category: "cooldown", equipment: [], anchor: null, unilateral: true, assist: false, mode: "duration", sec_per_rep: null, ref: 40, setup: "Sur le dos, cheville posée sur le genou opposé.", description: "Ramène les jambes vers la poitrine en tenant la cuisse du dessous.", tip: "Relâche la nuque et les épaules.", image: "Ankle_On_The_Knee"},
  {slug: "etirement_mollet_mur", name: "Étirement du mollet au mur", category: "cooldown", equipment: [], anchor: null, unilateral: true, assist: false, mode: "duration", sec_per_rep: null, ref: 40, setup: "Mains au mur, une jambe tendue derrière, talon au sol.", description: "Avance le bassin vers le mur.", tip: "Plie ensuite légèrement le genou arrière pour étirer le bas du mollet.", image: "Calf_Stretch_Hands_Against_Wall"},
  {slug: "posture_enfant", name: "Posture de l'enfant", category: "cooldown", equipment: [], anchor: null, unilateral: false, assist: false, mode: "duration", sec_per_rep: null, ref: 45, setup: "À genoux, fesses sur les talons.", description: "Allonge les bras devant toi, front au sol, et respire.", tip: "Expire longuement pour relâcher le dos.", image: "Childs_Pose"},
  {slug: "suspension_passive", name: "Suspension passive", category: "cooldown", equipment: ["bar"], anchor: "high", unilateral: false, assist: false, mode: "duration", sec_per_rep: null, ref: 30, setup: "Barre en haut, mains à largeur d'épaules.", description: "Suspendu, pieds au sol ou décollés, relâche les épaules et respire.", tip: "Décompresse le dos après la séance.", image: "One_Handed_Hang"},
]

export const EXERCISE_INDEX: Record<string, Exercise> = Object.fromEntries(
  EXERCISES.map((e) => [e.slug, e]),
)

const CATEGORY_ORDER: Category[] = Object.keys(CATEGORY_LABELS) as Category[]

/** Exercices dont tout le matériel est disponible. band : au moins une bande. */
export function availableExercises(equipment: Equipment[], bandsKg: number[]): Exercise[] {
  const has = (eq: Equipment) => eq === "band" ? bandsKg.length > 0 : equipment.includes(eq)
  return EXERCISES.filter((e) => e.equipment.every(has))
}

/** Une ligne par exercice, groupée par catégorie, sans les textes longs (prompts). */
export function catalogSummary(available: Exercise[]): string {
  const lines: string[] = []
  for (const category of CATEGORY_ORDER) {
    const group = available.filter((e) => e.category === category)
    if (!group.length) continue
    lines.push(`[${category}] ${CATEGORY_LABELS[category]}`)
    for (const e of group) {
      const parts = [e.slug, e.mode]
      if (e.equipment.length) parts.push(e.equipment.join("+"))
      if (e.anchor) parts.push(`barre ${e.anchor}`)
      if (e.unilateral) parts.push("unilat")
      if (e.assist) parts.push("assist")
      parts.push(`ref ${e.ref}${e.mode === "duration" ? " s" : ""}`)
      lines.push(parts.join(" · "))
    }
  }
  return lines.join("\n")
}
