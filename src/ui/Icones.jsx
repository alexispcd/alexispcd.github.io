// Icônes au trait du Design System : viewBox 24, trait 2, extrémités arrondies,
// couleur héritée du texte. Décoratives par défaut (aria-hidden) ; avec `titre`,
// elles deviennent une image nommée.

const Trait = ({ taille = 24, titre, children, ...rest }) => (
  <svg
    width={taille}
    height={taille}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    focusable="false"
    {...(titre ? { role: 'img', 'aria-label': titre } : { 'aria-hidden': true })}
    {...rest}
  >
    {children}
  </svg>
)

export const ChevronRetour = (props) => (
  <Trait {...props}><polyline points="15 6 9 12 15 18" /></Trait>
)

export const ChevronDroit = (props) => (
  <Trait {...props}><polyline points="9 6 15 12 9 18" /></Trait>
)

export const ChevronBas = (props) => (
  <Trait {...props}><polyline points="6 9 12 15 18 9" /></Trait>
)

export const ChevronHaut = (props) => (
  <Trait {...props}><polyline points="6 15 12 9 18 15" /></Trait>
)

export const TroisPoints = (props) => (
  <Trait {...props} stroke="none">
    <circle cx="5" cy="12" r="1.6" fill="currentColor" />
    <circle cx="12" cy="12" r="1.6" fill="currentColor" />
    <circle cx="19" cy="12" r="1.6" fill="currentColor" />
  </Trait>
)

export const Montre = (props) => (
  <Trait {...props}>
    <rect x="7" y="6" width="10" height="12" rx="3" />
    <path d="M9 6V3h6v3M9 18v3h6v-3" />
  </Trait>
)

export const Croix = (props) => (
  <Trait {...props}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </Trait>
)

export const Partager = (props) => (
  <Trait {...props}>
    <path d="M12 3v12" />
    <polyline points="8 7 12 3 16 7" />
    <path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" />
  </Trait>
)

// Coche : absente des fiches LigneSaisie et Compteur ; tracé repris de la planche
// TrainingV2 du canevas (bloc de zone fait).
export const Coche = (props) => (
  <Trait {...props}><polyline points="4 12 9 17 20 6" /></Trait>
)

// Moins et plus : tracés de la fiche Compteur.
export const Moins = (props) => (
  <Trait {...props}><line x1="6" y1="12" x2="18" y2="12" /></Trait>
)

export const Plus = (props) => (
  <Trait {...props}>
    <line x1="12" y1="6" x2="12" y2="18" />
    <line x1="6" y1="12" x2="18" y2="12" />
  </Trait>
)
