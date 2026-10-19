import { describe, expect, test } from "bun:test"

import {
  ASSOCIATION_DECISION_REASON_MAX,
  ASSOCIATION_GESTURE_ACTORS,
  ASSOCIATION_GESTURES,
  ASSOCIATION_LIST_STATUSES,
  ASSOCIATION_MANAGEMENT_GESTURES,
  ASSOCIATION_MEMBER_ROLES,
  ASSOCIATION_MEMBERSHIP_REFUSALS,
  ASSOCIATION_MEMBERSHIP_STATUSES,
  ASSOCIATION_REJECTION_COOLDOWN_DAYS,
  ASSOCIATION_REJECTION_COOLDOWN_MS,
  ASSOCIATION_REMOVAL_REASON_MIN,
  ASSOCIATION_REQUEST_MESSAGE_MAX,
  ASSOCIATION_RESPONSIBLE_ROLES,
  ASSOCIATION_SELF_GESTURES,
  ASSOCIATION_TRANSITIONS,
  canPerformGesture,
  canReadMemberList,
  checkManagementGesture,
  checkMembershipRequest,
  checkSelfWithdrawal,
  isAssociationMemberRole,
  isResponsibleRole,
  isTransitionAllowed,
  nextRequestAt,
  parseDecisionReason,
  parseRequestMessage,
  requestStanding,
  statusAfter,
  type AssociationManagementInput,
  type AssociationMembershipFacts,
} from "./associations"
import { DAY_MS } from "./time"

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0)
const facts = (status: AssociationMembershipFacts["status"], extra: Partial<AssociationMembershipFacts> = {}): AssociationMembershipFacts => ({
  status,
  statusChangedAt: NOW - DAY_MS,
  readmissionAllowed: false,
  ...extra,
})

describe("listes fermées de l'adhésion", () => {
  test("les états suivent le plan global §3.2, les rôles d'adhérent restent distincts des rôles de la page", () => {
    expect(ASSOCIATION_MEMBERSHIP_STATUSES).toEqual(["requested", "accepted", "rejected", "cancelled", "left", "removed"])
    expect(ASSOCIATION_MEMBER_ROLES).toEqual(["member", "animator"])
    expect(ASSOCIATION_RESPONSIBLE_ROLES).toEqual(["admin", "signatory"])
    expect(ASSOCIATION_MEMBER_ROLES.some((role) => (ASSOCIATION_RESPONSIBLE_ROLES as readonly string[]).includes(role))).toBe(false)
    expect(ASSOCIATION_LIST_STATUSES).toEqual(["requested", "accepted", "removed"])
  })

  test("les refus sont des codes fermés, uniques, au format des refus d'application", () => {
    expect(new Set(ASSOCIATION_MEMBERSHIP_REFUSALS).size).toBe(ASSOCIATION_MEMBERSHIP_REFUSALS.length)
    for (const code of ASSOCIATION_MEMBERSHIP_REFUSALS) expect(code).toMatch(/^association_[a-z_]+$/)
  })

  test("les bornes de textes et le délai après refus", () => {
    expect(ASSOCIATION_REQUEST_MESSAGE_MAX).toBe(500)
    expect(ASSOCIATION_DECISION_REASON_MAX).toBe(500)
    expect(ASSOCIATION_REMOVAL_REASON_MIN).toBe(10)
    expect(ASSOCIATION_REJECTION_COOLDOWN_MS).toBe(ASSOCIATION_REJECTION_COOLDOWN_DAYS * DAY_MS)
  })
})

describe("qui fait quoi", () => {
  test("chaque geste a son acteur : la personne, tout responsable, ou un administrateur", () => {
    expect([...ASSOCIATION_GESTURES].sort()).toEqual([...ASSOCIATION_SELF_GESTURES, ...ASSOCIATION_MANAGEMENT_GESTURES].sort())
    for (const gesture of ASSOCIATION_SELF_GESTURES) expect(ASSOCIATION_GESTURE_ACTORS[gesture]).toBe("self")
    expect(ASSOCIATION_GESTURE_ACTORS.accept).toBe("responsible")
    expect(ASSOCIATION_GESTURE_ACTORS.reject).toBe("responsible")
    expect(ASSOCIATION_GESTURE_ACTORS.remove).toBe("admin")
    expect(ASSOCIATION_GESTURE_ACTORS.set_role).toBe("admin")
    expect(ASSOCIATION_GESTURE_ACTORS.allow_readmission).toBe("admin")
  })

  test("un signataire décide des demandes ; exclure, nommer et réadmettre reviennent à un administrateur", () => {
    expect(canPerformGesture("accept", "signatory")).toBe(true)
    expect(canPerformGesture("reject", "signatory")).toBe(true)
    for (const gesture of ["remove", "set_role", "allow_readmission"] as const) {
      expect(canPerformGesture(gesture, "signatory")).toBe(false)
      expect(canPerformGesture(gesture, "admin")).toBe(true)
    }
    for (const gesture of ASSOCIATION_MANAGEMENT_GESTURES) expect(canPerformGesture(gesture, null)).toBe(false)
  })

  test("seuls les rôles vivants de la page sont des responsables ; un animateur ne lit pas la liste", () => {
    expect(isResponsibleRole("admin")).toBe(true)
    expect(isResponsibleRole("signatory")).toBe(true)
    for (const role of ["animator", "member", "", null, undefined]) expect(isResponsibleRole(role)).toBe(false)
    expect(canReadMemberList("admin")).toBe(true)
    expect(canReadMemberList("signatory")).toBe(true)
    expect(canReadMemberList("animator")).toBe(false)
    expect(canReadMemberList(null)).toBe(false)
    expect(isAssociationMemberRole("member")).toBe(true)
    expect(isAssociationMemberRole("animator")).toBe(true)
    for (const role of ["admin", "signatory", "", null, undefined]) expect(isAssociationMemberRole(role)).toBe(false)
  })
})

describe("transitions", () => {
  test("demandée → acceptée | refusée | annulée, puis acceptée → partie | exclue", () => {
    expect(statusAfter("accept", "requested")).toBe("accepted")
    expect(statusAfter("reject", "requested")).toBe("rejected")
    expect(statusAfter("cancel", "requested")).toBe("cancelled")
    expect(statusAfter("leave", "accepted")).toBe("left")
    expect(statusAfter("remove", "accepted")).toBe("removed")
    expect(statusAfter("request", "left")).toBe("requested")
  })

  test("nommer un animateur ou autoriser une nouvelle demande ne change pas l'état", () => {
    expect(statusAfter("set_role", "accepted")).toBe("accepted")
    expect(statusAfter("allow_readmission", "removed")).toBe("removed")
  })

  test("aucun geste ne part d'un état non prévu ; aucune acceptation sans demande", () => {
    expect(isTransitionAllowed("accept", null)).toBe(false)
    expect(isTransitionAllowed("accept", "left")).toBe(false)
    expect(isTransitionAllowed("request", null)).toBe(true)
    for (const status of ASSOCIATION_MEMBERSHIP_STATUSES) {
      expect(isTransitionAllowed("accept", status)).toBe(status === "requested")
      expect(isTransitionAllowed("remove", status)).toBe(status === "accepted")
      expect(isTransitionAllowed("allow_readmission", status)).toBe(status === "removed")
      expect(isTransitionAllowed("request", status)).toBe(ASSOCIATION_TRANSITIONS.request.from.includes(status))
    }
    // Aucun geste de gestion ne fait naître une adhésion : seul « request » part de « none ».
    expect(ASSOCIATION_GESTURES.filter((gesture) => ASSOCIATION_TRANSITIONS[gesture].from.includes("none"))).toEqual(["request"])
  })
})

describe("demander à adhérer", () => {
  test("une première demande, une nouvelle après annulation ou départ : tout de suite", () => {
    expect(checkMembershipRequest({ previous: null, managed: true }, NOW)).toEqual({ ok: true, value: true })
    expect(checkMembershipRequest({ previous: facts("cancelled"), managed: true }, NOW).ok).toBe(true)
    expect(checkMembershipRequest({ previous: facts("left"), managed: true }, NOW).ok).toBe(true)
    expect(nextRequestAt(null)).toBe(0)
    expect(nextRequestAt(facts("cancelled"))).toBe(0)
    expect(nextRequestAt(facts("left"))).toBe(0)
  })

  test("pas de double demande, pas de demande d'un adhérent", () => {
    expect(checkMembershipRequest({ previous: facts("requested"), managed: true }, NOW)).toEqual({ ok: false, code: "association_request_pending" })
    expect(checkMembershipRequest({ previous: facts("accepted"), managed: true }, NOW)).toEqual({ ok: false, code: "association_already_member" })
    expect(nextRequestAt(facts("requested"))).toBeNull()
    expect(nextRequestAt(facts("accepted"))).toBeNull()
  })

  test("après une exclusion, jamais sans décision des responsables", () => {
    expect(checkMembershipRequest({ previous: facts("removed"), managed: true }, NOW)).toEqual({ ok: false, code: "association_rejoin_blocked" })
    expect(checkMembershipRequest({ previous: facts("removed", { statusChangedAt: NOW - 3650 * DAY_MS }), managed: true }, NOW).ok).toBe(false)
    expect(nextRequestAt(facts("removed"))).toBeNull()
    const allowed = facts("removed", { readmissionAllowed: true })
    expect(nextRequestAt(allowed)).toBe(0)
    expect(checkMembershipRequest({ previous: allowed, managed: true }, NOW).ok).toBe(true)
  })

  test("après un refus : sept jours d'attente, pas une milliseconde de moins", () => {
    const rejected = facts("rejected", { statusChangedAt: NOW })
    expect(nextRequestAt(rejected)).toBe(NOW + ASSOCIATION_REJECTION_COOLDOWN_MS)
    expect(checkMembershipRequest({ previous: rejected, managed: true }, NOW + ASSOCIATION_REJECTION_COOLDOWN_MS - 1)).toEqual({ ok: false, code: "association_request_too_soon" })
    expect(checkMembershipRequest({ previous: rejected, managed: true }, NOW + ASSOCIATION_REJECTION_COOLDOWN_MS).ok).toBe(true)
  })

  test("une association sans responsable vivant ne reçoit aucune demande ; l'état précédent parle d'abord", () => {
    expect(checkMembershipRequest({ previous: null, managed: false }, NOW)).toEqual({ ok: false, code: "association_not_managed" })
    expect(checkMembershipRequest({ previous: facts("accepted"), managed: false }, NOW)).toEqual({ ok: false, code: "association_already_member" })
    expect(checkMembershipRequest({ previous: facts("removed"), managed: false }, NOW)).toEqual({ ok: false, code: "association_rejoin_blocked" })
  })

  test("la situation affichée avant tout geste : permis, refus, ou date de la prochaine demande", () => {
    expect(requestStanding({ previous: null, managed: true }, NOW)).toEqual({ allowed: true, refusal: null, availableAt: null })
    expect(requestStanding({ previous: facts("removed"), managed: true }, NOW)).toEqual({ allowed: false, refusal: "association_rejoin_blocked", availableAt: null })
    const rejected = facts("rejected", { statusChangedAt: NOW })
    expect(requestStanding({ previous: rejected, managed: true }, NOW)).toEqual({
      allowed: false,
      refusal: "association_request_too_soon",
      availableAt: NOW + ASSOCIATION_REJECTION_COOLDOWN_MS,
    })
  })
})

describe("annuler sa demande, quitter l'association", () => {
  test("annuler une demande en cours ; quitter une adhésion acceptée", () => {
    expect(checkSelfWithdrawal("cancel", "requested")).toEqual({ ok: true, value: "cancelled" })
    expect(checkSelfWithdrawal("leave", "accepted")).toEqual({ ok: true, value: "left" })
  })

  test("rien à annuler ni à quitter : un refus clair, sans effet", () => {
    expect(checkSelfWithdrawal("cancel", null)).toEqual({ ok: false, code: "association_not_pending" })
    expect(checkSelfWithdrawal("cancel", "accepted")).toEqual({ ok: false, code: "association_not_pending" })
    expect(checkSelfWithdrawal("leave", null)).toEqual({ ok: false, code: "association_not_member" })
    expect(checkSelfWithdrawal("leave", "requested")).toEqual({ ok: false, code: "association_not_member" })
    expect(checkSelfWithdrawal("leave", "removed")).toEqual({ ok: false, code: "association_not_member" })
  })
})

describe("gestes des responsables", () => {
  const base: AssociationManagementInput = { gesture: "accept", actorRole: "signatory", current: "requested", expectedVersion: 3, version: 3, isSelf: false }

  test("accepter ou refuser la demande courante, à la version lue", () => {
    expect(checkManagementGesture(base)).toEqual({ ok: true, value: "accepted" })
    expect(checkManagementGesture({ ...base, gesture: "reject" })).toEqual({ ok: true, value: "rejected" })
  })

  test("le rôle d'abord : un signataire ne peut ni exclure, ni nommer, ni réadmettre", () => {
    expect(checkManagementGesture({ ...base, gesture: "remove", current: "accepted" })).toEqual({ ok: false, code: "association_admin_required" })
    expect(checkManagementGesture({ ...base, gesture: "set_role", current: "accepted", version: 9 })).toEqual({ ok: false, code: "association_admin_required" })
  })

  test("une ligne changée depuis sa lecture est refusée, avant l'état", () => {
    expect(checkManagementGesture({ ...base, expectedVersion: 2 })).toEqual({ ok: false, code: "association_version_conflict" })
    expect(checkManagementGesture({ ...base, expectedVersion: 2, current: "accepted" })).toEqual({ ok: false, code: "association_version_conflict" })
  })

  test("chaque geste part de son état : décider d'une demande, gérer un adhérent, réadmettre une personne exclue", () => {
    expect(checkManagementGesture({ ...base, current: "accepted" })).toEqual({ ok: false, code: "association_not_pending" })
    expect(checkManagementGesture({ ...base, actorRole: "admin", gesture: "remove", current: "requested" })).toEqual({ ok: false, code: "association_not_member" })
    expect(checkManagementGesture({ ...base, actorRole: "admin", gesture: "set_role", current: "left" })).toEqual({ ok: false, code: "association_not_member" })
    expect(checkManagementGesture({ ...base, actorRole: "admin", gesture: "allow_readmission", current: "accepted" })).toEqual({ ok: false, code: "association_not_removed" })
    expect(checkManagementGesture({ ...base, actorRole: "admin", gesture: "allow_readmission", current: "removed" })).toEqual({ ok: true, value: "removed" })
    expect(checkManagementGesture({ ...base, actorRole: "admin", gesture: "set_role", current: "accepted" })).toEqual({ ok: true, value: "accepted" })
  })

  test("un administrateur exclut un adhérent, jamais lui-même (il quitte)", () => {
    const removal = { ...base, actorRole: "admin" as const, gesture: "remove" as const, current: "accepted" as const }
    expect(checkManagementGesture(removal)).toEqual({ ok: true, value: "removed" })
    expect(checkManagementGesture({ ...removal, isSelf: true })).toEqual({ ok: false, code: "association_self_removal" })
    // Se décider soi-même une demande reste un geste consenti des deux côtés.
    expect(checkManagementGesture({ ...base, isSelf: true }).ok).toBe(true)
  })
})

describe("textes bornés", () => {
  test("le mot de la demande est facultatif, rogné et borné", () => {
    expect(parseRequestMessage(undefined)).toEqual({ ok: true, value: null })
    expect(parseRequestMessage(null)).toEqual({ ok: true, value: null })
    expect(parseRequestMessage("   ")).toEqual({ ok: true, value: null })
    expect(parseRequestMessage("  Bonjour, je viens d'arriver à Lyon.  ")).toEqual({ ok: true, value: "Bonjour, je viens d'arriver à Lyon." })
    expect(parseRequestMessage("a".repeat(ASSOCIATION_REQUEST_MESSAGE_MAX)).ok).toBe(true)
    expect(parseRequestMessage("a".repeat(ASSOCIATION_REQUEST_MESSAGE_MAX + 1))).toEqual({ ok: false, code: "association_message_too_long" })
  })

  test("le motif : exigé et d'au moins dix caractères pour une exclusion, facultatif pour un refus", () => {
    expect(parseDecisionReason("", { required: true })).toEqual({ ok: false, code: "association_reason_required" })
    expect(parseDecisionReason(undefined, { required: true })).toEqual({ ok: false, code: "association_reason_required" })
    expect(parseDecisionReason("  trop bref ", { required: true })).toEqual({ ok: false, code: "association_reason_required" })
    expect(parseDecisionReason("Propos injurieux répétés", { required: true })).toEqual({ ok: true, value: "Propos injurieux répétés" })
    expect(parseDecisionReason(null, { required: false })).toEqual({ ok: true, value: null })
    expect(parseDecisionReason("  ", { required: false })).toEqual({ ok: true, value: null })
    expect(parseDecisionReason("Complet", { required: false })).toEqual({ ok: true, value: "Complet" })
    expect(parseDecisionReason("a".repeat(ASSOCIATION_DECISION_REASON_MAX + 1), { required: false })).toEqual({ ok: false, code: "association_reason_too_long" })
    expect(parseDecisionReason("a".repeat(ASSOCIATION_DECISION_REASON_MAX + 1), { required: true })).toEqual({ ok: false, code: "association_reason_too_long" })
  })
})
