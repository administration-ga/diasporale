/**
 * Table des routes de diasporale.com — le SEUL fichier de l'application où une
 * URL interne s'écrit (cliquet `no-hardcoded-urls`, convention du moteur). Les
 * surfaces de `@diasporale/features` ne connaissent aucune URL : elles reçoivent
 * cette table par `RoutingProvider`.
 */
import type { CountryCode, FeedScope } from "@diasporale/domain"

export const routes = {
  home: () => "/",
  enter: () => "/entrer",
  enterIdn: () => "/entrer/idn",
  enterCode: () => "/entrer/code",
  welcome: () => "/bienvenue",
  feed: (scope?: FeedScope) => (scope ? `/fil?scope=${scope}` : "/fil"),
  hub: (country: CountryCode) => `/pays/${country.toLowerCase()}`,
  /** Adresse publique `/@handle` (réécrite vers `/profil/handle` par next.config). */
  profile: (handle: string) => `/@${handle}`,
  /** Se voir comme les autres membres (EXF-DG-07, `?apercu=1`). */
  profilePreview: (handle: string) => `/@${handle}?apercu=1`,
  page: (handle: string) => `/pages/${handle}`,
  settings: () => "/parametres",
  /** L'aide « obtenir un parrainage », dans les paramètres. */
  sponsorHelp: () => "/parametres#parrainage",
  sponsor: () => "/parrainer",
  attestation: () => "/verification",
  demo: () => "/demo",
  charte: () => "/charte",
  legalNotice: () => "/mentions-legales",
  privacy: () => "/confidentialite",
  health: () => "/sante-fonctionnelle",
  healthApi: () => "/api/sante-fonctionnelle",
} as const

/** Ancres internes de la vitrine. */
export const anchors = {
  howToEnter: "#comment-entrer",
  content: "#contenu",
} as const
