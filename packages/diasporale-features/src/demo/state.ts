/**
 * État du fournisseur de DÉMONSTRATION — FICTIF de bout en bout.
 *
 * Aucune personne, aucune association, aucune entreprise, aucun poste de cet
 * état n'existe : les noms de personnes sont composés à partir de noms de
 * rivières du Gabon, les organisations portent la mention « (démo) », et le
 * poste consulaire est un « poste de démonstration ». Aucune donnée réelle,
 * aucune donnée consulaire. Les dates sont relatives au premier chargement,
 * pour que la démonstration reste vivante.
 */
import {
  DEFAULT_FACET_VISIBILITY,
  LIGHT_ACCOUNT_GROUNDS,
  consentRecord,
  type ConsentRecord,
  type ContentModerationState,
  type ContentScope,
  type CountryCode,
  type DiasporaFacet,
  type DirectoryVisibility,
  type MembershipGrounds,
  type PageOwnerKind,
  type PageSource,
  type PostAudience,
  type Visibility,
} from "@diasporale/domain"

import type { AssociationType, CompanySector, EventCategory, NotificationKind, ReactionKind } from "../data/types"

/** Version de l'état persisté : v2 = relations (demandes, blocages, abonnements) ; v3 = cloche. */
export const DEMO_STATE_VERSION = 3

export interface DemoPerson {
  readonly id: string
  readonly idn: {
    readonly sub: string
    readonly loa: number
    readonly gaboneseNationality: boolean | null
    readonly firstName: string
    readonly lastName: string
  } | null
  readonly local: { readonly kind: "email" | "phone"; readonly value: string } | null
  /** Profil social : n'existe qu'APRÈS l'onboarding (adhésion explicite, invariant 5). */
  readonly profile: { readonly handle: string; readonly displayName: string; readonly headline: string | null } | null
  readonly administrationLink: boolean
  readonly createdAt: number
  /** Compte de démonstration proposé au sélecteur (clé de description). */
  readonly demoAccountKey: string | null
}

export interface DemoMembership {
  readonly personId: string
  readonly grounds: MembershipGrounds
  readonly joinedAt: number
  readonly verifiedSince: number | null
  readonly facet: DiasporaFacet
  readonly directoryVisibility: DirectoryVisibility
  readonly attestation: {
    readonly outcome: "none" | "verified" | "not_confirmed"
    readonly postSlug: string | null
    readonly requestedAt: number | null
  }
}

export interface DemoSponsorship {
  readonly id: string
  readonly sponsorId: string
  readonly sponsoredId: string
  readonly createdAt: number
  readonly revokedAt: number | null
}

export interface DemoConsent extends ConsentRecord {
  readonly personId: string
}

export interface DemoPage {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly ownerKind: PageOwnerKind
  readonly source: PageSource
  readonly claimValidated: boolean
  readonly country: CountryCode | null
  readonly city: string | null
  readonly description: string
  readonly followers: number
  readonly associationType?: AssociationType
  readonly sector?: CompanySector
  /** Association relais du lancement (ouverture d'un pays, A8). */
  readonly relay?: boolean
}

export interface DemoPost {
  readonly id: string
  readonly author: { readonly kind: "person" | "page"; readonly id: string }
  readonly body: string
  readonly scope: ContentScope
  readonly audience: PostAudience
  readonly visibility: Visibility
  readonly moderation: ContentModerationState
  readonly createdAt: number
  readonly reactions: Readonly<Record<string, ReactionKind>>
  readonly baseReactions: number
  readonly commentCount: number
}

export interface DemoEvent {
  readonly id: string
  readonly title: string
  readonly startsAt: number
  readonly city: string
  readonly scope: ContentScope
  readonly category: EventCategory
  readonly organizerPageId: string
  readonly capacity: number | null
  readonly registered: number
  readonly moderation: ContentModerationState
}

/** Une demande de connexion en attente de réponse. */
export interface DemoConnectionRequest {
  readonly id: string
  readonly fromId: string
  readonly toId: string
  readonly createdAt: number
}

/** Un blocage : il vaut pour toute la paire, et seul son auteur le voit. */
export interface DemoBlock {
  readonly id: string
  readonly byId: string
  readonly targetId: string
  readonly createdAt: number
}

/** Un avis de la cloche (genres DIASPORALE, comme le moteur les émet). */
export interface DemoNotification {
  readonly id: string
  readonly recipientId: string
  readonly kind: Exclude<NotificationKind, "other">
  /** Qui a agi ; `null` pour un avis du système (issue d'une attestation). */
  readonly actorId: string | null
  readonly createdAt: number
  readonly readAt: number | null
  /** La demande de relation que l'avis annonce, pour y répondre d'ici. */
  readonly connectionRequestId: string | null
  /** La demande annoncée, refusée par la personne avisée : le moteur garde cet état, l'avis le dit. */
  readonly inviteDeclined: boolean
}

export interface DemoState {
  readonly version: number
  readonly createdAt: number
  readonly persons: Readonly<Record<string, DemoPerson>>
  readonly memberships: Readonly<Record<string, DemoMembership>>
  readonly sponsorships: readonly DemoSponsorship[]
  readonly consents: readonly DemoConsent[]
  readonly pages: Readonly<Record<string, DemoPage>>
  readonly posts: readonly DemoPost[]
  readonly events: readonly DemoEvent[]
  readonly connections: readonly (readonly [string, string])[]
  readonly connectionRequests: readonly DemoConnectionRequest[]
  readonly blocks: readonly DemoBlock[]
  /** Abonnements : [qui suit, qui est suivi]. */
  readonly follows: readonly (readonly [string, string])[]
  readonly notifications: readonly DemoNotification[]
  readonly openCountries: readonly CountryCode[]
  readonly countryModerators: Readonly<Partial<Record<CountryCode, number>>>
  readonly networkModerators: number
  readonly session: { readonly personId: string | null }
  readonly pendingCode: {
    readonly kind: "email" | "phone"
    readonly value: string
    readonly code: string
    readonly expiresAt: number
  } | null
  readonly sequence: number
}

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/** Identités IDN proposées par l'écran de connexion simulé (aucune n'existe). */
export const DEMO_IDN_IDENTITIES = [
  { key: "awa", firstName: "Awa", lastName: "Ogooué", loa: 2, gaboneseNationality: true },
  { key: "yannick", firstName: "Yannick", lastName: "Nyanga", loa: 1, gaboneseNationality: true },
  { key: "foreign", firstName: "Camille", lastName: "Martin", loa: 2, gaboneseNationality: false },
] as const

function member(
  id: string,
  grounds: Partial<MembershipGrounds>,
  facet: Partial<DiasporaFacet> & Pick<DiasporaFacet, "countryOfResidence">,
  joinedAt: number,
  extra: Partial<Pick<DemoMembership, "verifiedSince" | "directoryVisibility" | "attestation">> = {},
): DemoMembership {
  return {
    personId: id,
    grounds: { ...LIGHT_ACCOUNT_GROUNDS, ...grounds },
    joinedAt,
    verifiedSince: extra.verifiedSince ?? null,
    facet: { associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY, ...facet },
    directoryVisibility: extra.directoryVisibility ?? "hidden",
    attestation: extra.attestation ?? { outcome: "none", postSlug: null, requestedAt: null },
  }
}

function person(
  id: string,
  displayName: string,
  handle: string,
  headline: string | null,
  createdAt: number,
  options: { idnLoa?: number; administrationLink?: boolean; demoAccountKey?: string; email?: string } = {},
): DemoPerson {
  const [firstName = "", ...rest] = displayName.split(" ")
  return {
    id,
    idn:
      options.idnLoa !== undefined
        ? { sub: `idn-${id}`, loa: options.idnLoa, gaboneseNationality: true, firstName, lastName: rest.join(" ") }
        : null,
    local: options.email !== undefined ? { kind: "email", value: options.email } : null,
    profile: { handle, displayName, headline },
    administrationLink: options.administrationLink ?? false,
    createdAt,
    demoAccountKey: options.demoAccountKey ?? null,
  }
}

/** Construit l'état de démonstration initial, daté par rapport à `now`. */
export function createDemoSeed(now: number): DemoState {
  const persons: Record<string, DemoPerson> = {
    "p-mireille": person("p-mireille", "Mireille Ivindo", "mireille.ivindo", "Infirmière à Paris, bénévole associative", now - 420 * DAY, {
      demoAccountKey: "demo.accounts.mireille",
      email: "mireille@example.com",
    }),
    "p-prisca": person("p-prisca", "Prisca Abanga", "prisca.abanga", "Étudiante en droit à Bordeaux", now - 160 * DAY, {
      idnLoa: 2,
      demoAccountKey: "demo.accounts.prisca",
    }),
    "p-steeve": person("p-steeve", "Steeve Ngounié", "steeve.ngounie", "Développeur à Lyon", now - 75 * DAY, {
      idnLoa: 1,
      demoAccountKey: "demo.accounts.steeve",
    }),
    "p-rodrigue": person("p-rodrigue", "Rodrigue Komo", "rodrigue.komo", "Ingénieur à Montréal", now - 40 * DAY, {
      email: "rodrigue@example.com",
    }),
    "p-nadia": person("p-nadia", "Nadia Mpassa", "nadia.mpassa", "Entrepreneuse à Bruxelles", now - 300 * DAY, {
      idnLoa: 2,
    }),
    "p-clarisse": person("p-clarisse", "Clarisse Mbéi", "clarisse.mbei", null, now - 210 * DAY, {
      idnLoa: 3,
      administrationLink: true,
    }),
  }

  const memberships: Record<string, DemoMembership> = {
    "p-mireille": member("p-mireille", { consularAttestation: true }, { countryOfResidence: "FR", city: "Paris", postSlug: "poste-demo-france", helpAvailable: true }, now - 420 * DAY, {
      verifiedSince: now - 400 * DAY,
      directoryVisibility: "country",
      attestation: { outcome: "verified", postSlug: "poste-demo-france", requestedAt: now - 400 * DAY },
    }),
    "p-prisca": member("p-prisca", { idn: { loa: 2, gaboneseNationality: true }, sponsored: true }, { countryOfResidence: "FR", city: "Bordeaux" }, now - 160 * DAY, {
      verifiedSince: now - 150 * DAY,
      directoryVisibility: "network",
    }),
    "p-steeve": member("p-steeve", { idn: { loa: 1, gaboneseNationality: true } }, { countryOfResidence: "FR", city: "Lyon" }, now - 75 * DAY, {
      directoryVisibility: "country",
    }),
    "p-rodrigue": member("p-rodrigue", { sponsored: true }, { countryOfResidence: "CA", city: "Montréal" }, now - 40 * DAY),
    "p-nadia": member("p-nadia", { consularAttestation: true, idn: { loa: 2, gaboneseNationality: true } }, { countryOfResidence: "BE", city: "Bruxelles" }, now - 300 * DAY, {
      verifiedSince: now - 290 * DAY,
      attestation: { outcome: "verified", postSlug: "poste-demo-belgique", requestedAt: now - 290 * DAY },
    }),
    "p-clarisse": member("p-clarisse", { idn: { loa: 3, gaboneseNationality: true } }, { countryOfResidence: "FR", city: "Paris" }, now - 210 * DAY),
  }

  const sponsorships: DemoSponsorship[] = [
    { id: "s-1", sponsorId: "p-mireille", sponsoredId: "p-prisca", createdAt: now - 151 * DAY, revokedAt: null },
    { id: "s-2", sponsorId: "p-nadia", sponsoredId: "p-rodrigue", createdAt: now - 39 * DAY, revokedAt: null },
  ]

  const consents: DemoConsent[] = Object.keys(memberships).flatMap((personId) => [
    { ...consentRecord("social_profile", true, memberships[personId]!.joinedAt, "onboarding"), personId },
    {
      ...consentRecord("directory", memberships[personId]!.directoryVisibility !== "hidden", memberships[personId]!.joinedAt, "onboarding"),
      personId,
    },
  ])

  const pages: Record<string, DemoPage> = {
    "page-poste-fr": {
      id: "page-poste-fr",
      handle: "poste-demo-france",
      name: "Poste consulaire de démonstration — France",
      ownerKind: "institution",
      source: "consular_import",
      claimValidated: false,
      country: "FR",
      city: "Paris",
      description: "Page officielle FICTIVE d'un poste consulaire, importée par le contrat DIASPORA-COMMUNAUTE-V1 (démonstration).",
      followers: 0,
    },
    "page-asso-lyon": {
      id: "page-asso-lyon",
      handle: "collectif-ivindo-lyon",
      name: "Collectif Ivindo de Lyon (démo)",
      ownerKind: "association",
      source: "community_import",
      claimValidated: true,
      country: "FR",
      city: "Lyon",
      description: "Association culturelle fictive : soirées, accueil des nouveaux arrivants, cuisine du pays.",
      followers: 0,
      associationType: "cultural",
      relay: true,
    },
    "page-asso-bordeaux": {
      id: "page-asso-bordeaux",
      handle: "etudiants-bordeaux-demo",
      name: "Étudiants gabonais de Bordeaux (démo)",
      ownerKind: "association",
      source: "community_import",
      claimValidated: false,
      country: "FR",
      city: "Bordeaux",
      description: "Association étudiante fictive, importée non revendiquée : elle peut être revendiquée par son bureau.",
      followers: 0,
      associationType: "student",
      relay: true,
    },
    "page-asso-montreal": {
      id: "page-asso-montreal",
      handle: "amicale-montreal-demo",
      name: "Amicale de Montréal (démo)",
      ownerKind: "association",
      source: "community_import",
      claimValidated: false,
      country: "CA",
      city: "Montréal",
      description: "Amicale fictive : accueil, entraide et rencontres à Montréal.",
      followers: 0,
      associationType: "solidarity",
    },
    "page-saveurs": {
      id: "page-saveurs",
      handle: "saveurs-okoume-demo",
      name: "Saveurs d'Okoumé (démo)",
      ownerKind: "company",
      source: "member_created",
      claimValidated: true,
      country: "FR",
      city: "Paris",
      description: "Traiteur fictif : plats du pays, commandes par la messagerie.",
      followers: 0,
      sector: "food",
    },
    "page-valise": {
      id: "page-valise",
      handle: "valise-solidaire-demo",
      name: "Valise solidaire (démo)",
      ownerKind: "company",
      source: "member_created",
      claimValidated: false,
      country: "BE",
      city: "Bruxelles",
      description: "Service fictif de mise en relation pour l'envoi de colis vers le Gabon.",
      followers: 0,
      sector: "transport",
    },
  }

  const post = (
    id: string,
    author: DemoPost["author"],
    body: string,
    scope: ContentScope,
    ageMs: number,
    extra: Partial<Pick<DemoPost, "visibility" | "audience" | "baseReactions" | "commentCount">> = {},
  ): DemoPost => ({
    id,
    author,
    body,
    scope,
    audience: extra.audience ?? "public",
    visibility: extra.visibility ?? "network",
    moderation: "published",
    createdAt: now - ageMs,
    reactions: {},
    baseReactions: extra.baseReactions ?? 0,
    commentCount: extra.commentCount ?? 0,
  })

  const posts: DemoPost[] = [
    post(
      "post-1",
      { kind: "page", id: "page-poste-fr" },
      "Permanence consulaire mobile à Lyon : la page officielle annonce la date et les modalités de rendez-vous. (Information de démonstration.)",
      { reach: "local", country: "FR" },
      3 * HOUR,
      { baseReactions: 12, commentCount: 3 },
    ),
    post(
      "post-2",
      { kind: "person", id: "p-mireille" },
      "Je rentre à Libreville en novembre : il me reste de la place dans ma valise pour des médicaments ou des courriers. Écrivez-moi par la messagerie.",
      { reach: "diaspora", country: "FR" },
      9 * HOUR,
      { baseReactions: 8, commentCount: 5 },
    ),
    post(
      "post-3",
      { kind: "page", id: "page-asso-lyon" },
      "Merci à toutes celles et ceux qui sont venus à notre soirée culturelle ! Les photos arrivent dans l'album du collectif.",
      { reach: "local", country: "FR" },
      DAY + 2 * HOUR,
      { baseReactions: 21, commentCount: 4 },
    ),
    post(
      "post-4",
      { kind: "person", id: "p-rodrigue" },
      "Bienvenue aux étudiants arrivés à Montréal cette rentrée ! Une rencontre d'accueil se prépare avec l'amicale.",
      { reach: "local", country: "CA" },
      2 * DAY,
      { baseReactions: 6, commentCount: 2 },
    ),
    post(
      "post-5",
      { kind: "person", id: "p-nadia" },
      "Qui serait intéressé par un groupe « Entrepreneurs de la diaspora » ? Je lance l'idée, vos avis m'intéressent.",
      { reach: "diaspora", country: "BE" },
      2 * DAY + 5 * HOUR,
      { baseReactions: 15, commentCount: 9 },
    ),
    post(
      "post-6",
      { kind: "person", id: "p-steeve" },
      "Match de l'équipe nationale ce soir : on se retrouve où à Lyon pour le regarder ensemble ?",
      { reach: "local", country: "FR" },
      3 * DAY,
      { visibility: "root", baseReactions: 4, commentCount: 7 },
    ),
    post(
      "post-7",
      { kind: "person", id: "p-prisca" },
      "Quelqu'un connaît une coiffeuse afro de confiance à Bordeaux ? Merci d'avance !",
      { reach: "local", country: "FR" },
      4 * DAY,
      { baseReactions: 3, commentCount: 6 },
    ),
    post(
      "post-8",
      { kind: "page", id: "page-saveurs" },
      "Nouveau : plats à emporter le week-end. Les commandes passent par la messagerie de la page.",
      { reach: "local", country: "FR" },
      5 * DAY,
      { baseReactions: 9, commentCount: 1 },
    ),
  ]

  const events: DemoEvent[] = [
    {
      id: "evt-1",
      title: "Permanence consulaire mobile (démo)",
      startsAt: now + 11 * DAY,
      city: "Lyon",
      scope: { reach: "local", country: "FR" },
      category: "diplomacy",
      organizerPageId: "page-poste-fr",
      capacity: null,
      registered: 0,
      moderation: "published",
    },
    {
      id: "evt-2",
      title: "Tournoi de football inter-associations",
      startsAt: now + 18 * DAY,
      city: "Bordeaux",
      scope: { reach: "local", country: "FR" },
      category: "sport",
      organizerPageId: "page-asso-bordeaux",
      capacity: 64,
      registered: 40,
      moderation: "published",
    },
    {
      id: "evt-3",
      title: "Rencontre d'accueil des nouveaux arrivants",
      startsAt: now + 9 * DAY,
      city: "Montréal",
      scope: { reach: "local", country: "CA" },
      category: "culture",
      organizerPageId: "page-asso-montreal",
      capacity: 40,
      registered: 40,
      moderation: "published",
    },
    {
      id: "evt-4",
      title: "Soirée contes et musiques du pays, en ligne",
      startsAt: now + 30 * DAY,
      city: "Lyon",
      scope: { reach: "diaspora", country: "FR" },
      category: "culture",
      organizerPageId: "page-asso-lyon",
      capacity: 150,
      registered: 84,
      moderation: "published",
    },
  ]

  return {
    version: DEMO_STATE_VERSION,
    createdAt: now,
    persons,
    memberships,
    sponsorships,
    consents,
    pages,
    posts,
    events,
    connections: [
      ["p-mireille", "p-prisca"],
      ["p-prisca", "p-steeve"],
    ],
    connectionRequests: [],
    blocks: [],
    follows: [["p-steeve", "p-mireille"]],
    notifications: [],
    openCountries: ["FR"],
    countryModerators: { FR: 2 },
    networkModerators: 2,
    session: { personId: null },
    pendingCode: null,
    sequence: 1,
  }
}
