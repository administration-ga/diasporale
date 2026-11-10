/**
 * Table des routes de diasporale.com — le SEUL fichier de l'application où une
 * URL interne s'écrit (cliquet `no-hardcoded-urls`, convention du moteur). Les
 * surfaces de `@diasporale/features` ne connaissent aucune URL : elles reçoivent
 * cette table par `RoutingProvider`.
 */
import { contextualConversationKey } from "@antsia/social-features/features/messagerie/messagerie-dock"
import { conversationHref } from "@antsia/social-features/features/messagerie/messagerie-routes"
import { parseResidenceCountry, type CommunityRule, type CountryCode, type FeedScope } from "@diasporale/domain"
import { PAGE_ASSOCIATION_TYPES, PAGE_COMPANY_SECTORS, type PageAssociationType, type PageCompanySector } from "@antsia/social-domain/pagePresentation"

/** Le jeton peut contenir une expansion Unicode de minuscule (İ → i̇) : ne pas le redécouper. */
export function normalizeFeedTag(raw: string | null | undefined): string | undefined {
  return raw?.trim().toLowerCase() || undefined
}

function feedHref(scope?: FeedScope, tag?: string, country?: CountryCode): string {
  const query = new URLSearchParams()
  if (scope !== undefined) query.set("scope", scope)
  const canonicalTag = normalizeFeedTag(tag)
  if (canonicalTag !== undefined) query.set("tag", canonicalTag)
  const residence = parseResidenceCountry(country)
  if (residence.ok) query.set("country", residence.value)
  const search = query.toString()
  return search ? `/fil?${search}` : "/fil"
}

/** Une rubrique communautaire filtrée par pays (et ville saisie, sans GPS) : adresses partageables. */
function zoneHref(base: string, country?: CountryCode, city?: string): string {
  const query = new URLSearchParams()
  const residence = parseResidenceCountry(country)
  if (residence.ok) query.set("pays", residence.value)
  const typed = city?.trim()
  if (typed) query.set("ville", typed)
  const search = query.toString()
  return search ? `${base}?${search}` : base
}

/**
 * ET-04 — les vues de l'entraide dans l'adresse (`?vue=`), en mots du site ; la vue par
 * défaut de chaque onglet (questions ouvertes, missions à venir) ne s'écrit pas.
 */
export const AID_QUESTION_VIEW_SLUGS = { open: null, unanswered: "sans-reponse", resolved: "resolues", closed: "closes", mine: "miennes" } as const
export const AID_MISSION_VIEW_SLUGS = { upcoming: null, mine: "mes-inscriptions", team: "mes-associations" } as const
export type AidQuestionRouteView = keyof typeof AID_QUESTION_VIEW_SLUGS
export type AidMissionRouteView = keyof typeof AID_MISSION_VIEW_SLUGS

/**
 * L'onglet, sa vue, le thème et les mots de l'entraide, portés par l'adresse (ET-04) : une
 * adresse filtrée se partage et se recharge à l'identique. Le thème et les mots ne
 * restreignent que les questions ; ils restent dans l'adresse d'un onglet à l'autre.
 */
export interface MutualAidRouteFilters {
  readonly tab?: "questions" | "missions"
  /** La vue de l'onglet affiché (`AID_QUESTION_VIEW_SLUGS` ou `AID_MISSION_VIEW_SLUGS`). */
  readonly view?: AidQuestionRouteView | AidMissionRouteView
  readonly theme?: string | null
  readonly q?: string
}

function mutualAidHref(country?: CountryCode, city?: string, filters?: MutualAidRouteFilters): string {
  const query = new URLSearchParams(zoneHref("/entraide", country, city).split("?")[1] ?? "")
  const missions = filters?.tab === "missions"
  if (missions) query.set("onglet", "missions")
  const slugs: Readonly<Record<string, string | null>> = missions ? AID_MISSION_VIEW_SLUGS : AID_QUESTION_VIEW_SLUGS
  const slug = filters?.view ? slugs[filters.view] ?? null : null
  if (slug) query.set("vue", slug)
  if (filters?.theme) query.set("theme", filters.theme)
  const q = filters?.q?.trim()
  if (q) query.set("q", q)
  const search = query.toString()
  return search ? `/entraide?${search}` : "/entraide"
}

/** ET-04 — les mots cherchés et la rubrique du kit, portés par l'adresse. */
export interface ArrivalKitRouteFilters {
  readonly q?: string
  readonly category?: string | null
}

function arrivalKitHref(country?: CountryCode, city?: string, filters?: ArrivalKitRouteFilters): string {
  const query = new URLSearchParams(zoneHref("/kit-arrivee", country, city).split("?")[1] ?? "")
  const q = filters?.q?.trim()
  if (q) query.set("q", q)
  if (filters?.category) query.set("categorie", filters.category)
  const search = query.toString()
  return search ? `/kit-arrivee?${search}` : "/kit-arrivee"
}

/** ET-04 — le domaine, la langue et la ville saisie d'une recherche de mentors, portés par l'adresse. */
export interface MentoringRouteFilters {
  readonly domain?: string | null
  readonly language?: string | null
  readonly city?: string
}

function mentoringHref(country?: CountryCode, filters?: MentoringRouteFilters): string {
  const query = new URLSearchParams(zoneHref("/mentorat", country, filters?.city).split("?")[1] ?? "")
  if (filters?.domain) query.set("domaine", filters.domain)
  if (filters?.language) query.set("langue", filters.language)
  const search = query.toString()
  return search ? `/mentorat?${search}` : "/mentorat"
}

/** Filtres du catalogue des services, portés par l'adresse (partageables, sans GPS). */
export interface ServiceSearchParams {
  readonly q?: string
  readonly country?: CountryCode
  readonly city?: string
  readonly category?: string
  readonly delivery?: "onsite" | "remote"
}

export interface PageBrowseParams {
  readonly q?: string
  readonly country?: CountryCode
  readonly ownerKind?: "association" | "company"
  readonly associationType?: PageAssociationType
  readonly sector?: PageCompanySector
  readonly followed?: boolean
}

/** Une adresse libre ne transforme jamais une valeur inconnue en catégorie. */
export function pageCategoryFiltersOf(input: {
  readonly ownerKind?: string | null
  readonly associationType?: string | null
  readonly sector?: string | null
}): Pick<PageBrowseParams, "ownerKind" | "associationType" | "sector"> {
  const associationType = input.associationType && (PAGE_ASSOCIATION_TYPES as readonly string[]).includes(input.associationType)
    ? input.associationType as PageAssociationType : undefined
  const sector = input.sector && (PAGE_COMPANY_SECTORS as readonly string[]).includes(input.sector)
    ? input.sector as PageCompanySector : undefined
  if (input.ownerKind === "association") return { ownerKind: "association", ...(associationType ? { associationType } : {}) }
  if (input.ownerKind === "company") return { ownerKind: "company", ...(sector ? { sector } : {}) }
  if (associationType && !sector) return { ownerKind: "association", associationType }
  if (sector && !associationType) return { ownerKind: "company", sector }
  return {}
}

function pagesHref(filters?: PageBrowseParams): string {
  const query = new URLSearchParams()
  if (filters?.followed) query.set("vue", "suivies")
  else {
    const q = filters?.q?.trim()
    if (q) query.set("q", q)
    const category = pageCategoryFiltersOf(filters ?? {})
    if (category.ownerKind) query.set("type", category.ownerKind)
    const country = parseResidenceCountry(filters?.country)
    if (country.ok) query.set("pays", country.value)
    if (category.associationType) query.set("activite", category.associationType)
    if (category.sector) query.set("secteur", category.sector)
  }
  const search = query.toString()
  return search ? `/pages?${search}` : "/pages"
}

function servicesHref(filters?: ServiceSearchParams): string {
  const query = new URLSearchParams()
  const q = filters?.q?.trim()
  if (q) query.set("q", q)
  const residence = parseResidenceCountry(filters?.country)
  if (residence.ok) query.set("pays", residence.value)
  const city = filters?.city?.trim()
  if (city) query.set("ville", city)
  if (filters?.category) query.set("categorie", filters.category)
  if (filters?.delivery) query.set("mode", filters.delivery)
  const search = query.toString()
  return search ? `/services?${search}` : "/services"
}

/** Le segment « nouveau statut » de la route des statuts (lu aussi par la page des statuts). */
export const STORIES_NEW_SEGMENT = "nouvelle"

/**
 * L'ancre de chaque règle de la communauté (MD-05) sur sa page, dans la langue des adresses :
 * la fiche d'une décision et le guichet renvoient à la règle que vise un motif.
 */
export const COMMUNITY_RULE_ANCHORS: Readonly<Record<CommunityRule, string>> = {
  spirit: "esprit",
  respect: "respect",
  scams: "arnaques",
  impersonation: "usurpation",
  politics: "debat-politique",
  privacy: "vie-privee",
  prohibited: "contenus-interdits",
  reporting: "signaler",
  measures: "mesures-et-recours",
}

/** Le paramètre de `/parrainer` qui porte l'identifiant public à parrainer (EA-10). */
export const SPONSOR_REQUEST_PARAM = "pour"

export const routes = {
  home: () => "/",
  enter: () => "/entrer",
  register: () => "/entrer?inscription=1",
  /** Résultat de déconnexion, sans masquer un échec de révocation des autres sessions. */
  enterAfterSignOut: (incomplete: boolean) => incomplete ? "/entrer?deconnexion=incomplete" : "/entrer",
  enterIdn: () => "/entrer/idn",
  enterCode: () => "/entrer/code",
  welcome: () => "/bienvenue",
  feed: feedHref,
  hub: (country: CountryCode) => `/pays/${country.toLowerCase()}`,
  /** Le hub d'un nouveau membre, avec l'avis de bienvenue : la fin de l'accueil. */
  hubWelcome: (country: CountryCode) => `/pays/${country.toLowerCase()}?bienvenue=1`,
  /** Adresse publique `/@handle` (réécrite vers `/profil/handle` par next.config). */
  profile: (handle: string) => `/@${handle}`,
  /** Se voir comme les autres membres (EXF-DG-07, `?apercu=1`). */
  profilePreview: (handle: string) => `/@${handle}?apercu=1`,
  /** Onglets du profil, alignés sur le contrat des albums du moteur. */
  profileTab: (handle: string, tab: "publications" | "photos" | "albums", preview = false) =>
    `/@${handle}?onglet=${tab}${preview ? "&apercu=1" : ""}`,
  album: (handle: string, albumId: string) => `/@${handle}/albums/${encodeURIComponent(albumId)}`,
  editAlbum: (handle: string, albumId: string) => `/@${handle}/albums/${encodeURIComponent(albumId)}?modifier=1`,
  newAlbum: (handle: string) => `/@${handle}?onglet=albums&nouveau=1`,
  page: (handle: string) => `/pages/${handle}`,
  /** Section publique du catalogue réel de la page, sans créer de conversation. */
  pageServices: (handle: string) => `/pages/${handle}#services-de-la-page`,
  /** Annuaire des pages et abonnements du lecteur, distincts de leur gestion. */
  pages: pagesHref,
  /** Une publication seule (depuis la cloche, un signet, son horodatage). */
  post: (postId: string) => `/publication/${postId}`,
  /** Mes signets (EXF-DG-12). */
  bookmarks: () => "/enregistrements",
  /** L'annuaire opt-in des membres (EXF-DG-19). */
  members: () => "/membres",
  /** Mes liens dans le réseau, sans recherche d'annuaire générique. */
  relations: (kind?: "accepted" | "received" | "sent" | "following" | "blocked" | "dismissed") => kind === "received"
    ? "/relations?onglet=demandes"
    : kind === "sent" ? "/relations?onglet=envoyees"
      : kind === "following" ? "/relations?onglet=abonnements"
        : kind === "blocked" ? "/relations?onglet=blocages"
          : kind === "dismissed" ? "/relations?onglet=masquees" : "/relations",
  /**
   * iCom en pages (PD7) : la messagerie et ses sous-adresses. Au téléphone, la page
   * iCom ; au bureau, l'adresse ouvre la carte iCom détachée sur le fil.
   */
  messages: () => "/messages",
  /** Une conversation de mise en relation (CC-6) : `/messages/mise-en-relation/<fil>`, composée par la messagerie du moteur. */
  contextualConversation: (threadId: string) => conversationHref(contextualConversationKey(threadId), "/messages") ?? "/messages",
  /** Statuts (stories) en plein écran, ouverts depuis iCom ; `…/nouvelle` ouvre le composeur. */
  stories: () => "/actus",
  story: (handle: string | null) => handle === null ? "/actus" : `/actus?${new URLSearchParams({ auteur: handle })}`,
  newStory: () => `/actus/${STORIES_NEW_SEGMENT}`,
  /** Conférence en direct (lot `live` du moteur, PD7 point 4) : pas encore servie ici. */
  conference: (sessionId: string) => `/direct/${encodeURIComponent(sessionId)}`,
  /** Explorer : membres, pages et pays (destination principale, DG-005). */
  explore: () => "/explorer",
  /** Communautés : le hub de son pays, ses associations, groupes et évènements (DG-005). */
  communities: () => "/communautes",
  /** Agenda personnel et inscriptions associatives actuellement accessibles. */
  agenda: () => "/agenda",
  /** Le catalogue des services, borné au réseau (DG-011/012) ; filtres en paramètres. */
  services: servicesHref,
  serviceOffer: (offerId: string) => `/services/${encodeURIComponent(offerId)}`,
  /** Mon activité : les pages que je gère, leurs offres et leurs demandes reçues. */
  myActivity: (tab?: "offres" | "demandes" | "emplois" | "pages") => tab ? `/mon-activite?onglet=${tab}` : "/mon-activite",
  /** Une demande reçue par une de mes pages (côté professionnel). */
  activityRequest: (requestId: string) => `/mon-activite/demandes/${encodeURIComponent(requestId)}`,
  /** Mes demandes de service (côté demandeur). */
  myServiceRequests: () => "/mes-demandes",
  serviceRequest: (requestId: string) => `/mes-demandes/${encodeURIComponent(requestId)}`,
  /** Créer une page d'association ou d'entreprise (DG-008). */
  newPage: (kind?: "association" | "company") => kind ? `/nouvelle-page?type=${kind}` : "/nouvelle-page",
  /** Gérer une page : publications, services/demandes, avis, emplois, identité, équipe, revendications et décisions de modération sous mandat vivant. */
  pageManage: (handle: string, tab?: "identite" | "equipe" | "revendications" | "publications" | "services" | "demandes" | "avis" | "emplois" | "decisions") =>
    tab ? `/pages/${handle}/gerer?onglet=${tab}` : `/pages/${handle}/gerer`,
  /** Les décisions de modération qui ont retiré un contenu de la page, et son recours (P16 · G9). */
  pageDecisions: (handle: string) => `/pages/${handle}/gerer?onglet=decisions`,
  /** Les adhérents d'une association : demandes, membres, rôles (responsables seulement, DG-010). */
  associationMembers: (handle: string) => `/pages/${handle}/adherents`,
  associationGroup: (handle: string) => `/pages/${encodeURIComponent(handle)}/groupe`,
  associationEvent: (handle: string, eventId: string) => `/pages/${encodeURIComponent(handle)}/evenements/${encodeURIComponent(eventId)}`,
  /** Mes adhésions aux associations. */
  myAssociations: () => "/mes-associations",
  /** Le fil en mode découverte verticale (DG-017) ; la liste reste le mode par défaut. */
  feedDiscovery: () => "/fil?vue=decouverte",
  /** Entraide : questions, réponses retenues et missions bénévoles (DG-024, vague H) ; onglet, vue, thème et mots dans l'adresse (ET-04). */
  mutualAid: mutualAidHref,
  mutualAidItem: (itemId: string) => `/entraide/${encodeURIComponent(itemId)}`,
  /** Kit d'arrivée : ressources datées, sourcées et relues, par pays et ville (DG-024) ; mots et rubrique dans l'adresse (ET-04). */
  arrivalKit: arrivalKitHref,
  arrivalKitResource: (resourceId: string) => `/kit-arrivee/${encodeURIComponent(resourceId)}`,
  /** Mentorat : mentors volontaires, demandes et créneaux consentis (DG-024) ; domaine, langue et ville dans l'adresse (ET-04). */
  mentoring: mentoringHref,
  mentorProfile: (mentorId: string) => `/mentorat/${encodeURIComponent(mentorId)}`,
  myMentoring: () => "/mes-mentorats",
  /** Talents et emploi : offres des pages, candidatures privées, profils opt-in (DG-025). */
  jobs: (country?: CountryCode, city?: string) => zoneHref("/emploi", country, city),
  jobOffer: (jobId: string) => `/emploi/${encodeURIComponent(jobId)}`,
  myApplications: () => "/mes-candidatures",
  talents: (country?: CountryCode) => zoneHref("/talents", country),
  /** Modération par pays (PD6, G9) : file, décisions et recours, équipes habilitées seulement. */
  moderationDesk: (tab?: "file" | "recours" | "equipe") => tab ? `/moderation?onglet=${tab}` : "/moderation",
  /** Mesure du pilote (G11, DG-027) : agrégats sans contenu privé, responsables du réseau seulement. */
  pilotDashboard: () => "/pilote",
  /** Revendiquer une page existante (preuves privées, instruction). */
  pageClaim: (handle: string) => `/pages/${handle}/revendiquer`,
  settings: () => "/parametres",
  /** Les choix privés de masquage et de sourdine dans le fil. */
  settingsFeed: () => "/parametres#mon-fil",
  /** Images du profil commun, sans commandes de retrait global de profil. */
  settingsImages: () => "/parametres#images",
  /** Mes données : export, effacement, décisions et recours (DG-026). */
  settingsData: () => "/parametres#mes-donnees",
  /** Mes signalements : accusé de réception, échéance légale et issue (SU01d du moteur). */
  settingsReports: () => "/parametres#mes-signalements",
  /**
   * « Mes données » hors de la coque de membre (NP-02, EA-05) : export, effacement, décisions,
   * recours et signalements pour toute personne connectée — membre, partie, suspendue ou sans
   * adhésion. Aucune surface sociale n'y est montée.
   */
  myData: () => "/mes-donnees",
  /** L'aide « obtenir un parrainage », dans les paramètres. */
  sponsorHelp: () => "/parametres#parrainage",
  sponsor: () => "/parrainer",
  /**
   * La demande de parrainage d'un compte en attente (EA-10) : `/parrainer` prérempli par son
   * identifiant PUBLIC, seul porté par le lien (ni jeton, ni adresse, ni nom).
   */
  sponsorFor: (handle: string) => `/parrainer?${new URLSearchParams({ [SPONSOR_REQUEST_PARAM]: handle })}`,
  attestation: () => "/verification",
  demo: () => "/demo",
  charte: () => "/charte",
  legalNotice: () => "/mentions-legales",
  privacy: () => "/confidentialite",
  /** Les textes du site ajoutés par LX-05 : chacun sa page, sa version, sa date et son marqueur tant qu'il n'est pas fourni. */
  terms: () => "/conditions-utilisation",
  communityRules: () => "/regles-communaute",
  /** Une règle de la communauté, à son ancre (MD-05) : celle que vise le motif d'un signalement. */
  communityRule: (rule: CommunityRule) => `/regles-communaute#${COMMUNITY_RULE_ANCHORS[rule]}`,
  contact: () => "/contact",
  health: () => "/sante-fonctionnelle",
  healthApi: () => "/api/sante-fonctionnelle",
  /**
   * Les icônes de l'application installée que le manifeste déclare (MO-02) : 192 et 512 px, et la
   * variante masquable (symbole tenu dans la zone sûre). L'icône d'onglet et l'icône Apple sont
   * celles des conventions de Next (`app/icon.tsx`, `app/apple-icon.tsx`), liées par lui.
   */
  appIcon: (format: "192" | "512" | "masquable") => `/icone-application/${format}`,
  /**
   * Le script de fond UNIQUE du site (MO-05) : page hors-ligne en réserve, écouteurs de
   * notification. Son adresse ne change pas : une autre adresse ferait un second script.
   */
  serviceWorker: () => "/script-de-fond",
  /** La page hors-ligne, la seule réserve du script de fond (MO-05). */
  offline: () => "/hors-ligne",
} as const

/**
 * Les paramètres de filtre que cette table compose (pays, ville, onglet…) : les seuls qu'une page
 * demandée avant la connexion garde (UX-02, MO-03). Un jeton, un code ou un traceur n'y survivent
 * pas. Un test vérifie qu'aucune adresse de la table n'en emploie un autre, hors de l'entrée.
 */
export const ROUTE_FILTER_KEYS = [
  "scope",
  "tag",
  "country",
  "vue",
  "pays",
  "ville",
  "q",
  "type",
  "activite",
  "secteur",
  "categorie",
  "mode",
  "apercu",
  "onglet",
  "modifier",
  "nouveau",
  "auteur",
  // L'identifiant public d'une demande de parrainage (EA-10) : il survit à l'entrée, rien d'autre.
  "pour",
  // ET-04 : le thème d'une question, le domaine et la langue d'un mentor.
  "theme",
  "domaine",
  "langue",
] as const

/** Ancres internes de la vitrine. */
export const anchors = {
  howToEnter: "#comment-entrer",
  content: "#contenu",
} as const
