/**
 * Table des routes de diasporale.com — le SEUL fichier de l'application où une
 * URL interne s'écrit (cliquet `no-hardcoded-urls`, convention du moteur). Les
 * surfaces de `@diasporale/features` ne connaissent aucune URL : elles reçoivent
 * cette table par `RoutingProvider`.
 */
import { contextualConversationKey } from "@antsia/social-features/features/messagerie/messagerie-dock"
import { conversationHref } from "@antsia/social-features/features/messagerie/messagerie-routes"
import { parseResidenceCountry, type CountryCode, type FeedScope } from "@diasporale/domain"
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
  /** Entraide : questions, réponses retenues et missions bénévoles (DG-024, vague H). */
  mutualAid: (country?: CountryCode, city?: string) => zoneHref("/entraide", country, city),
  mutualAidItem: (itemId: string) => `/entraide/${encodeURIComponent(itemId)}`,
  /** Kit d'arrivée : ressources datées, sourcées et relues, par pays et ville (DG-024). */
  arrivalKit: (country?: CountryCode, city?: string) => zoneHref("/kit-arrivee", country, city),
  arrivalKitResource: (resourceId: string) => `/kit-arrivee/${encodeURIComponent(resourceId)}`,
  /** Mentorat : mentors volontaires, demandes et créneaux consentis (DG-024). */
  mentoring: (country?: CountryCode) => zoneHref("/mentorat", country),
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
