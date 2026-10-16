/**
 * Éligibilité et statuts d'adhésion au réseau `diasporale` (cahier §6.2).
 *
 * Le statut n'est jamais SAISI : il se DÉRIVE de faits relus à l'acte — le
 * lien IDN et son niveau de garantie, le parrainage, l'attestation consulaire,
 * une sanction, un départ. `deriveMembershipStatus` est LA règle ; les
 * évènements (`applyMembershipEvent`) ne font que modifier les faits, puis
 * relire la règle. Deux chemins qui calculeraient chacun leur statut finiraient
 * par diverger : il n'y en a qu'un.
 *
 * Portes d'entrée (§6.2) :
 *   · IDN (identite.ga), affichée en premier → `declaree` ; `verifiee` si
 *     `loa ≥ 2` ET (attestation consulaire OU parrainage) ;
 *   · compte léger (code à usage unique) → `en_attente` jusqu'au parrainage
 *     (→ `declaree`) ou à l'attestation consulaire (→ `verifiee`) ;
 *   · attestation consulaire, à la demande de la personne → `verifiee`.
 */
import type { TrustBadge } from "./badges"
import { ok, refuse, type Result } from "./result"

export const MEMBERSHIP_STATUSES = [
  "en_attente",
  "declaree",
  "verifiee",
  "suspendue",
  "partie",
] as const
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number]

/** Niveau de garantie IDN à partir duquel une identité vaut « Vérifié ». */
export const VERIFIED_LOA_THRESHOLD = 2

/** Niveaux de garantie admis dans un lien IDN (entiers de 0 à 4). */
export const IDN_LOA_MIN = 0
export const IDN_LOA_MAX = 4

export const SUSPENSION_READ_ACCESS = ["read_only", "none"] as const
export type SuspensionReadAccess = (typeof SUSPENSION_READ_ACCESS)[number]

export interface IdnGround {
  readonly loa: number
  /**
   * Nationalité gabonaise selon IDN : `false` seulement quand IDN dit
   * explicitement qu'elle est absente. Le réseau est celui des Gabonais de
   * l'étranger : une identité IDN étrangère n'ouvre pas, à elle seule, la porte.
   */
  readonly gaboneseNationality: boolean | null
}

export interface SuspensionGround {
  /** Fin de la sanction (ms UTC) ; `null` = jusqu'à levée explicite. */
  readonly until: number | null
  /** « lecture seule ou rien, selon la sanction » (§6.2). */
  readonly readAccess: SuspensionReadAccess
}

/** Les faits dont le statut se dérive — relus à l'acte, jamais mis en cache. */
export interface MembershipGrounds {
  readonly idn: IdnGround | null
  readonly sponsored: boolean
  readonly consularAttestation: boolean
  readonly suspension: SuspensionGround | null
  readonly leftAt: number | null
}

/** Un compte léger qui vient d'entrer : aucun fait encore. */
export const LIGHT_ACCOUNT_GROUNDS: MembershipGrounds = Object.freeze({
  idn: null,
  sponsored: false,
  consularAttestation: false,
  suspension: null,
  leftAt: null,
})

/** La porte IDN ne compte que si IDN n'exclut pas la nationalité gabonaise. */
export function idnCountsAsGround(idn: IdnGround | null): idn is IdnGround {
  return idn !== null && idn.gaboneseNationality !== false
}

export function isSuspensionActive(suspension: SuspensionGround | null, now: number): boolean {
  if (suspension === null) return false
  return suspension.until === null || suspension.until > now
}

/**
 * LA règle du statut. L'ordre des tests EST la règle :
 *   1. un départ l'emporte sur tout (`partie`) ;
 *   2. une sanction en cours suspend (`suspendue`) ;
 *   3. l'attestation consulaire vérifie ;
 *   4. IDN `loa ≥ 2` ET parrainage vérifient ;
 *   5. IDN seule, ou le parrainage seul, déclarent ;
 *   6. sinon, admission conditionnelle (`en_attente`).
 */
export function deriveMembershipStatus(grounds: MembershipGrounds, now: number): MembershipStatus {
  if (grounds.leftAt !== null) return "partie"
  if (isSuspensionActive(grounds.suspension, now)) return "suspendue"
  if (grounds.consularAttestation) return "verifiee"
  const idn = idnCountsAsGround(grounds.idn) ? grounds.idn : null
  if (idn !== null && idn.loa >= VERIFIED_LOA_THRESHOLD && grounds.sponsored) return "verifiee"
  if (idn !== null || grounds.sponsored) return "declaree"
  return "en_attente"
}

/**
 * Le statut vu par le réseau quand la racine a son mot à dire : une suspension
 * dans ANTSIA suspend partout (invariant 3). Un départ reste un départ.
 */
export function effectiveMembershipStatus(
  networkStatus: MembershipStatus,
  root: { readonly suspended: boolean },
): MembershipStatus {
  if (networkStatus === "partie") return "partie"
  return root.suspended ? "suspendue" : networkStatus
}

// ═══════════════════════════════════════════════════════════════
// Évènements — ils modifient les FAITS, puis la règle est relue
// ═══════════════════════════════════════════════════════════════

export type MembershipEvent =
  | { readonly kind: "idn_linked"; readonly loa: number; readonly gaboneseNationality: boolean | null }
  | { readonly kind: "idn_loa_updated"; readonly loa: number }
  | { readonly kind: "idn_unlinked" }
  | { readonly kind: "sponsored" }
  | { readonly kind: "sponsorship_revoked" }
  | { readonly kind: "attestation_confirmed" }
  | { readonly kind: "attestation_revoked" }
  | { readonly kind: "suspended"; readonly until: number | null; readonly readAccess: SuspensionReadAccess }
  | { readonly kind: "suspension_lifted" }
  | { readonly kind: "left"; readonly at: number }
  | { readonly kind: "rejoined" }

export type MembershipEventKind = MembershipEvent["kind"]

export const MEMBERSHIP_EVENT_REFUSALS = [
  "membership_left",
  "not_left",
  "idn_already_linked",
  "no_idn_link",
  "loa_invalid",
  "already_sponsored",
  "no_sponsorship",
  "already_attested",
  "no_attestation",
  "not_suspended",
] as const
export type MembershipEventRefusal = (typeof MEMBERSHIP_EVENT_REFUSALS)[number]

export interface MembershipTransition {
  readonly grounds: MembershipGrounds
  readonly previous: MembershipStatus
  readonly status: MembershipStatus
}

function isValidLoa(loa: number): boolean {
  return Number.isInteger(loa) && loa >= IDN_LOA_MIN && loa <= IDN_LOA_MAX
}

function nextGrounds(
  grounds: MembershipGrounds,
  event: MembershipEvent,
  now: number,
): Result<MembershipGrounds, MembershipEventRefusal> {
  // Une adhésion quittée n'accepte plus qu'un retour : le reste se rejoue après.
  if (grounds.leftAt !== null && event.kind !== "rejoined") return refuse("membership_left")
  switch (event.kind) {
    case "rejoined":
      if (grounds.leftAt === null) return refuse("not_left")
      // La sanction en cours SURVIT au départ : on ne sort pas d'une sanction
      // en quittant puis en revenant.
      return ok({ ...grounds, leftAt: null })
    case "left":
      // Le parrainage admettait la personne dans le réseau ; il s'éteint avec
      // le départ. Les liens d'identité (IDN, attestation) restent ceux de la personne.
      return ok({ ...grounds, leftAt: event.at, sponsored: false })
    case "idn_linked":
      if (grounds.idn !== null) return refuse("idn_already_linked")
      if (!isValidLoa(event.loa)) return refuse("loa_invalid")
      return ok({ ...grounds, idn: { loa: event.loa, gaboneseNationality: event.gaboneseNationality } })
    case "idn_loa_updated":
      if (grounds.idn === null) return refuse("no_idn_link")
      if (!isValidLoa(event.loa)) return refuse("loa_invalid")
      return ok({ ...grounds, idn: { ...grounds.idn, loa: event.loa } })
    case "idn_unlinked":
      if (grounds.idn === null) return refuse("no_idn_link")
      return ok({ ...grounds, idn: null })
    case "sponsored":
      if (grounds.sponsored) return refuse("already_sponsored")
      return ok({ ...grounds, sponsored: true })
    case "sponsorship_revoked":
      if (!grounds.sponsored) return refuse("no_sponsorship")
      return ok({ ...grounds, sponsored: false })
    case "attestation_confirmed":
      if (grounds.consularAttestation) return refuse("already_attested")
      return ok({ ...grounds, consularAttestation: true })
    case "attestation_revoked":
      // Révocation de l'inscription ou suppression du compte consulaire (webhook
      // de cycle de vie, V2) : `verifiee` retombe selon les faits restants.
      if (!grounds.consularAttestation) return refuse("no_attestation")
      return ok({ ...grounds, consularAttestation: false })
    case "suspended":
      // Une nouvelle sanction remplace la précédente (durée et accès).
      return ok({ ...grounds, suspension: { until: event.until, readAccess: event.readAccess } })
    case "suspension_lifted":
      if (!isSuspensionActive(grounds.suspension, now)) return refuse("not_suspended")
      return ok({ ...grounds, suspension: null })
  }
}

export function applyMembershipEvent(
  grounds: MembershipGrounds,
  event: MembershipEvent,
  now: number,
): Result<MembershipTransition, MembershipEventRefusal> {
  const next = nextGrounds(grounds, event, now)
  if (!next.ok) return next
  return ok({
    grounds: next.value,
    previous: deriveMembershipStatus(grounds, now),
    status: deriveMembershipStatus(next.value, now),
  })
}

// ═══════════════════════════════════════════════════════════════
// Ce que chaque statut autorise (table du cahier §6.2)
// ═══════════════════════════════════════════════════════════════

export const MEMBER_CAPABILITIES = [
  /** Lire le hub pays, les pages et les contenus publics du réseau. */
  "read_network",
  /** Publier, commenter, réagir. */
  "publish",
  /** Messagerie, appels, groupes. */
  "communicate",
  "create_event",
  "create_page",
  /** Apparaître dans l'annuaire opt-in (s'il le choisit). */
  "appear_in_directory",
  "view_directory",
  /** Parrainer — l'ancienneté du parrain se juge en plus (`sponsorship.ts`). */
  "sponsor",
  /** Déclencher « Vérifier mon inscription consulaire ». */
  "request_attestation",
] as const
export type MemberCapability = (typeof MEMBER_CAPABILITIES)[number]

const CAPABILITIES_BY_STATUS: Readonly<Record<MembershipStatus, readonly MemberCapability[]>> = Object.freeze({
  en_attente: ["read_network", "request_attestation"],
  declaree: [
    "read_network",
    "publish",
    "communicate",
    "create_event",
    "appear_in_directory",
    "view_directory",
    "request_attestation",
  ],
  verifiee: [
    "read_network",
    "publish",
    "communicate",
    "create_event",
    "create_page",
    "appear_in_directory",
    "view_directory",
    "sponsor",
  ],
  // La lecture d'un membre suspendu dépend de la sanction : voir `capabilitiesOf`.
  suspendue: [],
  partie: [],
})

export function capabilitiesOf(
  status: MembershipStatus,
  context: { readonly suspensionReadAccess?: SuspensionReadAccess } = {},
): ReadonlySet<MemberCapability> {
  if (status === "suspendue") {
    return new Set(context.suspensionReadAccess === "read_only" ? ["read_network"] : [])
  }
  return new Set(CAPABILITIES_BY_STATUS[status])
}

export function hasCapability(
  status: MembershipStatus,
  capability: MemberCapability,
  context: { readonly suspensionReadAccess?: SuspensionReadAccess } = {},
): boolean {
  return capabilitiesOf(status, context).has(capability)
}

/**
 * Seau de limitation de débit des écritures (PD6) : renforcé pour un membre
 * `declaree` sans badge Vérifié, standard sinon, aucun pour qui ne peut pas
 * écrire. La valeur des seaux est un réglage du moteur.
 */
export const WRITE_RATE_TIERS = ["none", "reinforced", "standard"] as const
export type WriteRateTier = (typeof WRITE_RATE_TIERS)[number]

export function writeRateTier(status: MembershipStatus, badges: readonly TrustBadge[]): WriteRateTier {
  if (!hasCapability(status, "publish")) return "none"
  if (status === "declaree" && !badges.includes("verified")) return "reinforced"
  return "standard"
}
