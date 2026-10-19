/**
 * Adhésion aux associations DIASPORALE (DG-010, plan global §G3 et §3.2) —
 * règles PURES, sans dépendance, lues à l'identique par le moteur (tranche
 * `convex/modules/diaspora/associations.ts`) et par la démonstration :
 *
 *   demandée → acceptée | refusée | annulée, puis acceptée → partie | exclue.
 *
 * - « Suivre l'actualité » (abonnement à la page) et « devenir adhérent » sont
 *   DEUX gestes distincts : rien ici ne lit ni n'écrit un abonnement.
 * - Aucun adhérent n'est ajouté d'office ni importé : une adhésion naît
 *   TOUJOURS d'une demande de la personne ; les responsables l'acceptent ou la
 *   refusent, jamais ne l'inscrivent.
 * - Les RESPONSABLES sont les signataires vivants de la page (`admin`,
 *   `signatory`) ; les rôles d'adhérent (`member`, `animator`) ne donnent aucun
 *   droit de gestion ni de lecture de la liste.
 * - La liste des adhérents n'est pas un registre légal ; aucune règle ici ne
 *   vaut scrutin. Une cotisation éventuelle se règle avec l'association et
 *   n'ouvre aucun accès payant au réseau.
 */
import { ok, refuse, type Result } from "./result"
import { DAY_MS } from "./time"

/** États d'une adhésion. Une ligne par personne et par association : son DERNIER état. */
export const ASSOCIATION_MEMBERSHIP_STATUSES = ["requested", "accepted", "rejected", "cancelled", "left", "removed"] as const
export type AssociationMembershipStatus = (typeof ASSOCIATION_MEMBERSHIP_STATUSES)[number]

/** Rôles d'ADHÉRENT : aucun ne donne de droit sur la page ni sur la liste. */
export const ASSOCIATION_MEMBER_ROLES = ["member", "animator"] as const
export type AssociationMemberRole = (typeof ASSOCIATION_MEMBER_ROLES)[number]

/** Rôles de SIGNATAIRE de la page : ceux qui en sont responsables (relus vivants à chaque acte). */
export const ASSOCIATION_RESPONSIBLE_ROLES = ["admin", "signatory"] as const
export type AssociationResponsibleRole = (typeof ASSOCIATION_RESPONSIBLE_ROLES)[number]

/** Ce que les responsables consultent : demandes en attente, adhérents, exclusions. */
export const ASSOCIATION_LIST_STATUSES = ["requested", "accepted", "removed"] as const
export type AssociationListStatus = (typeof ASSOCIATION_LIST_STATUSES)[number]

/** Un mot facultatif joint à la demande. */
export const ASSOCIATION_REQUEST_MESSAGE_MAX = 500
/** Le motif d'une décision (refus facultatif, exclusion obligatoire). */
export const ASSOCIATION_DECISION_REASON_MAX = 500
/** Une exclusion est MOTIVÉE : un motif d'au moins dix caractères. */
export const ASSOCIATION_REMOVAL_REASON_MIN = 10
/** Après un refus, une nouvelle demande attend sept jours (les responsables ne sont pas relancés en boucle). */
export const ASSOCIATION_REJECTION_COOLDOWN_DAYS = 7
export const ASSOCIATION_REJECTION_COOLDOWN_MS = ASSOCIATION_REJECTION_COOLDOWN_DAYS * DAY_MS

/** Refus FERMÉS des règles d'adhésion, traduits par l'écran (`errors.<code>`). */
export const ASSOCIATION_MEMBERSHIP_REFUSALS = [
  "association_not_managed",
  "association_request_pending",
  "association_already_member",
  "association_rejoin_blocked",
  "association_request_too_soon",
  "association_not_pending",
  "association_not_member",
  "association_not_removed",
  "association_version_conflict",
  "association_admin_required",
  "association_self_removal",
  "association_message_too_long",
  "association_reason_required",
  "association_reason_too_long",
] as const
export type AssociationMembershipRefusal = (typeof ASSOCIATION_MEMBERSHIP_REFUSALS)[number]

// ═══════════════════════════════════════════════════════════════
// Gestes : qui fait quoi
// ═══════════════════════════════════════════════════════════════

/** Les gestes de la personne elle-même : demander, annuler sa demande, quitter. */
export const ASSOCIATION_SELF_GESTURES = ["request", "cancel", "leave"] as const
export type AssociationSelfGesture = (typeof ASSOCIATION_SELF_GESTURES)[number]

/** Les gestes des responsables : décider d'une demande, exclure, nommer, autoriser une nouvelle demande. */
export const ASSOCIATION_MANAGEMENT_GESTURES = ["accept", "reject", "remove", "set_role", "allow_readmission"] as const
export type AssociationManagementGesture = (typeof ASSOCIATION_MANAGEMENT_GESTURES)[number]

export type AssociationGesture = AssociationSelfGesture | AssociationManagementGesture
export const ASSOCIATION_GESTURES: readonly AssociationGesture[] = Object.freeze([
  ...ASSOCIATION_SELF_GESTURES,
  ...ASSOCIATION_MANAGEMENT_GESTURES,
])

/**
 * Qui fait quoi : la personne elle-même (`self`), tout responsable vivant
 * (`responsible` : administrateur ou signataire de la page), ou un
 * administrateur de la page seulement (`admin` : les actes de gouvernance).
 */
export type AssociationGestureActor = "self" | "responsible" | "admin"
export const ASSOCIATION_GESTURE_ACTORS: Readonly<Record<AssociationGesture, AssociationGestureActor>> = Object.freeze({
  request: "self",
  cancel: "self",
  leave: "self",
  accept: "responsible",
  reject: "responsible",
  remove: "admin",
  set_role: "admin",
  allow_readmission: "admin",
})

/** Le rôle (vivant) de la page fait-il de la personne une responsable ? */
export function isResponsibleRole(role: string | null | undefined): role is AssociationResponsibleRole {
  return role === "admin" || role === "signatory"
}

export function isAssociationMemberRole(role: string | null | undefined): role is AssociationMemberRole {
  return role === "member" || role === "animator"
}

/**
 * Le rôle de la page suffit-il au geste ? Sans rôle vivant, aucun geste de
 * gestion — et le moteur répond alors le refus indistinct, comme pour une
 * association inconnue.
 */
export function canPerformGesture(gesture: AssociationManagementGesture, role: AssociationResponsibleRole | null): boolean {
  if (role === null) return false
  return ASSOCIATION_GESTURE_ACTORS[gesture] === "responsible" || role === "admin"
}

/** Seuls les responsables lisent la liste des adhérents et des demandes. */
export function canReadMemberList(role: string | null | undefined): boolean {
  return isResponsibleRole(role)
}

// ═══════════════════════════════════════════════════════════════
// Transitions (plan global §3.2)
// ═══════════════════════════════════════════════════════════════

/** `none` : aucune ligne encore (jamais demandé). */
export type AssociationStateBefore = AssociationMembershipStatus | "none"

/**
 * La table des transitions : d'où chaque geste peut partir, et où il mène.
 * `set_role` et `allow_readmission` ne changent pas l'état.
 */
export const ASSOCIATION_TRANSITIONS: Readonly<Record<AssociationGesture, { readonly from: readonly AssociationStateBefore[]; readonly to: AssociationMembershipStatus | null }>> = Object.freeze({
  request: { from: ["none", "rejected", "cancelled", "left", "removed"], to: "requested" },
  cancel: { from: ["requested"], to: "cancelled" },
  leave: { from: ["accepted"], to: "left" },
  accept: { from: ["requested"], to: "accepted" },
  reject: { from: ["requested"], to: "rejected" },
  remove: { from: ["accepted"], to: "removed" },
  set_role: { from: ["accepted"], to: null },
  allow_readmission: { from: ["removed"], to: null },
})

/** Le refus d'un geste qui ne part pas d'un état admis (hors demande, jugée par `checkMembershipRequest`). */
const WRONG_STATE: Readonly<Record<Exclude<AssociationGesture, "request">, AssociationMembershipRefusal>> = Object.freeze({
  cancel: "association_not_pending",
  leave: "association_not_member",
  accept: "association_not_pending",
  reject: "association_not_pending",
  remove: "association_not_member",
  set_role: "association_not_member",
  allow_readmission: "association_not_removed",
})

/** Le geste peut-il partir de cet état ? */
export function isTransitionAllowed(gesture: AssociationGesture, current: AssociationMembershipStatus | null): boolean {
  return ASSOCIATION_TRANSITIONS[gesture].from.includes(current ?? "none")
}

/** L'état après le geste (l'état courant pour un geste qui ne le change pas). */
export function statusAfter(gesture: AssociationGesture, current: AssociationMembershipStatus): AssociationMembershipStatus {
  return ASSOCIATION_TRANSITIONS[gesture].to ?? current
}

// ═══════════════════════════════════════════════════════════════
// Demander : la règle de la (nouvelle) demande
// ═══════════════════════════════════════════════════════════════

/** Ce qu'une ligne d'adhésion dit d'elle-même pour les règles. */
export interface AssociationMembershipFacts {
  readonly status: AssociationMembershipStatus
  /** Depuis quand la ligne est dans cet état (ms UTC). */
  readonly statusChangedAt: number
  /** Après une exclusion : les responsables ont autorisé une nouvelle demande. */
  readonly readmissionAllowed: boolean
}

/**
 * Quand une nouvelle demande redevient possible, d'après l'état précédent :
 * sept jours après un refus ; tout de suite après une annulation ou un départ ;
 * jamais d'elle-même après une exclusion (`null` : une décision des
 * responsables est nécessaire) ; sans objet pour une demande en cours ou une
 * adhésion acceptée (`null`).
 */
export function nextRequestAt(previous: AssociationMembershipFacts | null): number | null {
  if (previous === null) return 0
  switch (previous.status) {
    case "rejected":
      return previous.statusChangedAt + ASSOCIATION_REJECTION_COOLDOWN_MS
    case "cancelled":
    case "left":
      return 0
    case "removed":
      return previous.readmissionAllowed ? 0 : null
    case "requested":
    case "accepted":
      return null
  }
}

/**
 * Peut-on demander à adhérer ? La ligne précédente d'abord (demande en cours,
 * adhésion, exclusion), puis l'équipe de l'association (une association sans
 * responsable vivant ne pourrait traiter aucune demande), puis le délai après
 * un refus. Le statut de la personne dans le réseau (capacité de publier) et
 * le débit sont jugés AVANT, par le moteur.
 */
export function checkMembershipRequest(
  input: { readonly previous: AssociationMembershipFacts | null; readonly managed: boolean },
  now: number,
): Result<true, AssociationMembershipRefusal> {
  const previous = input.previous
  if (previous?.status === "accepted") return refuse("association_already_member")
  if (previous?.status === "requested") return refuse("association_request_pending")
  const availableAt = nextRequestAt(previous)
  if (availableAt === null) return refuse("association_rejoin_blocked")
  if (!input.managed) return refuse("association_not_managed")
  if (now < availableAt) return refuse("association_request_too_soon")
  return ok(true)
}

export interface AssociationRequestStanding {
  readonly allowed: boolean
  readonly refusal: AssociationMembershipRefusal | null
  /** Pour `association_request_too_soon` seulement : l'instant où la demande redevient possible. */
  readonly availableAt: number | null
}

/** Où en est la personne AVANT tout geste : ce que l'écran affiche (moteur et démonstration lisent la même règle). */
export function requestStanding(
  input: { readonly previous: AssociationMembershipFacts | null; readonly managed: boolean },
  now: number,
): AssociationRequestStanding {
  const check = checkMembershipRequest(input, now)
  if (check.ok) return { allowed: true, refusal: null, availableAt: null }
  return {
    allowed: false,
    refusal: check.code,
    availableAt: check.code === "association_request_too_soon" ? nextRequestAt(input.previous) : null,
  }
}

/** Annuler sa demande, quitter l'association : toujours possible depuis l'état qui convient. */
export function checkSelfWithdrawal(
  gesture: Exclude<AssociationSelfGesture, "request">,
  current: AssociationMembershipStatus | null,
): Result<AssociationMembershipStatus, AssociationMembershipRefusal> {
  if (current === null || !isTransitionAllowed(gesture, current)) return refuse(WRONG_STATE[gesture])
  return ok(statusAfter(gesture, current))
}

// ═══════════════════════════════════════════════════════════════
// Gérer : les gestes des responsables
// ═══════════════════════════════════════════════════════════════

export interface AssociationManagementInput {
  readonly gesture: AssociationManagementGesture
  /** Le rôle VIVANT de l'acteur sur la page (un non-responsable est refusé avant, indistinctement). */
  readonly actorRole: AssociationResponsibleRole
  readonly current: AssociationMembershipStatus
  /** La version lue par l'écran, et celle de la ligne : un geste sur une ligne changée est refusé. */
  readonly expectedVersion: number
  readonly version: number
  /** L'acteur agit-il sur sa propre adhésion ? (Quitter n'est pas s'exclure.) */
  readonly isSelf: boolean
}

/**
 * Un geste de gestion est-il admis ? Le rôle d'abord (les actes de gouvernance
 * reviennent à un administrateur de la page), puis la version attendue (la
 * ligne n'a pas changé depuis sa lecture), puis l'état de départ, enfin la
 * règle « on ne s'exclut pas soi-même ».
 */
export function checkManagementGesture(input: AssociationManagementInput): Result<AssociationMembershipStatus, AssociationMembershipRefusal> {
  if (!canPerformGesture(input.gesture, input.actorRole)) return refuse("association_admin_required")
  if (input.expectedVersion !== input.version) return refuse("association_version_conflict")
  if (!isTransitionAllowed(input.gesture, input.current)) return refuse(WRONG_STATE[input.gesture])
  if (input.gesture === "remove" && input.isSelf) return refuse("association_self_removal")
  return ok(statusAfter(input.gesture, input.current))
}

// ═══════════════════════════════════════════════════════════════
// Textes : le mot de la demande, le motif d'une décision
// ═══════════════════════════════════════════════════════════════

/** Le mot joint à la demande : facultatif, borné ; vide → aucun mot. */
export function parseRequestMessage(raw: string | null | undefined): Result<string | null, "association_message_too_long"> {
  const text = (raw ?? "").trim()
  if (text.length === 0) return ok(null)
  if (text.length > ASSOCIATION_REQUEST_MESSAGE_MAX) return refuse("association_message_too_long")
  return ok(text)
}

/**
 * Le motif d'une décision. Exigé (au moins dix caractères) pour une exclusion ;
 * facultatif pour un refus. Toujours borné.
 */
export function parseDecisionReason(
  raw: string | null | undefined,
  options: { readonly required: boolean },
): Result<string | null, "association_reason_required" | "association_reason_too_long"> {
  const text = (raw ?? "").trim()
  if (text.length > ASSOCIATION_DECISION_REASON_MAX) return refuse("association_reason_too_long")
  if (options.required && text.length < ASSOCIATION_REMOVAL_REASON_MIN) return refuse("association_reason_required")
  return ok(text.length === 0 ? null : text)
}
