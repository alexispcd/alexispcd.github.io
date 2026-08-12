// Libelles d'affichage des valeurs de type et d'angle portees par les cartes.
// Repli sur la valeur brute pour toute valeur nouvelle apparaissant dans un
// JSON depose plus tard, sans avoir a toucher ce fichier.
const LABELS = {
  definition: 'Définition',
  evenement: 'Événement',
  chiffre: 'Chiffre',
  acteur: 'Acteur',
  controverse: 'Controverse',
  technique: 'Technique',
  economique: 'Économique',
  souverainete: 'Souveraineté',
  securite: 'Sécurité',
  organisationnel: 'Organisationnel',
}

export const labelOf = (value) => LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1)
