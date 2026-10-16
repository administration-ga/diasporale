/**
 * Table des routes de diasporale.com — le SEUL fichier de l'application où une
 * URL interne s'écrit (cliquet `no-hardcoded-urls`, convention du moteur). Les
 * surfaces de `@diasporale/features` ne connaissent aucune URL : elles reçoivent
 * cette table par `RoutingProvider`.
 */
import type { CountryCode, FeedScope } from "@diasporale/domain"

/** Le segment « nouveau statut » de la route des statuts (lu aussi par la page des statuts). */
export const STORIES_NEW_SEGMENT = "nouvelle"

export const routes = {
  home: () => "/",
  enter: () => "/entrer",
  /** Résultat de déconnexion, sans masquer un échec de révocation des autres sessions. */
  enterAfterSignOut: (incomplete: boolean) => incomplete ? "/entrer?deconnexion=incomplete" : "/entrer",
  enterIdn: () => "/entrer/idn",
  enterCode: () => "/entrer/code",
  welcome: () => "/bienvenue",
  feed: (scope?: FeedScope) => (scope ? `/fil?scope=${scope}` : "/fil"),
  hub: (country: CountryCode) => `/pays/${country.toLowerCase()}`,
  /** Adresse publique `/@handle` (réécrite vers `/profil/handle` par next.config). */
  profile: (handle: string) => `/@${handle}`,
  /** Se voir comme les autres membres (EXF-DG-07, `?apercu=1`). */
  profilePreview: (handle: string) => `/@${handle}?apercu=1`,
  /** Onglets du profil, alignés sur le contrat des albums du moteur. */
  profileTab: (handle: string, tab: "publications" | "photos" | "albums", preview = false) =>
    `/@${handle}?onglet=${tab}${preview ? "&apercu=1" : ""}`,
  album: (handle: string, albumId: string) => `/@${handle}/albums/${encodeURIComponent(albumId)}`,
  newAlbum: (handle: string) => `/@${handle}?onglet=albums&nouveau=1`,
  page: (handle: string) => `/pages/${handle}`,
  /** Une publication seule (depuis la cloche, un signet, son horodatage). */
  post: (postId: string) => `/publication/${postId}`,
  /** Mes signets (EXF-DG-12). */
  bookmarks: () => "/enregistrements",
  /** L'annuaire opt-in des membres (EXF-DG-19). */
  members: () => "/membres",
  /** Mes relations et les demandes reçues, sans recherche d'annuaire générique. */
  relations: (kind?: "accepted" | "received") => kind === "received" ? "/relations?onglet=demandes" : "/relations",
  /**
   * iCom en pages (PD7) : la messagerie et ses sous-adresses. Au téléphone, la page
   * iCom ; au bureau, l'adresse ouvre la carte iCom détachée sur le fil.
   */
  messages: () => "/messages",
  /** Statuts (stories) en plein écran, ouverts depuis iCom ; `…/nouvelle` ouvre le composeur. */
  stories: () => "/actus",
  story: (handle: string | null) => handle === null ? "/actus" : `/actus?${new URLSearchParams({ auteur: handle })}`,
  newStory: () => `/actus/${STORIES_NEW_SEGMENT}`,
  /** Conférence en direct (lot `live` du moteur, PD7 point 4) : pas encore servie ici. */
  conference: (sessionId: string) => `/direct/${encodeURIComponent(sessionId)}`,
  settings: () => "/parametres",
  /** Images du profil commun, sans commandes de retrait global de profil. */
  settingsImages: () => "/parametres#images",
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
