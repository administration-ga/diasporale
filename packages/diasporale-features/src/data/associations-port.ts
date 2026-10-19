/**
 * Capacité « associations » du port (DG-010) — adhésion à une association,
 * DISTINCTE de l'abonnement à sa page : demande, décision des responsables,
 * départ, exclusion motivée, rôles. PROPRIÉTAIRE : chantier « associations ».
 *
 * Aucun membre ajouté d'office ; aucune liste d'adhérents divulguée hors des
 * responsables (signataires vivants de la page) ; une cotisation éventuelle à
 * l'association n'ouvre jamais un accès payant au réseau. Les règles sont
 * celles de `@diasporale/domain` (associations), lues par les deux
 * fournisseurs : le moteur (`engine-associations.ts`) et la démonstration.
 */
import {
  ASSOCIATION_MEMBERSHIP_REFUSALS,
  type AssociationListStatus,
  type AssociationMemberRole,
  type AssociationMembershipRefusal,
  type AssociationMembershipStatus,
  type AssociationResponsibleRole,
} from "@diasporale/domain"

import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/**
 * Codes de refus propres aux associations (fragment de locale du chantier) : les
 * refus du domaine, rendus tels quels par le moteur (`appRule`) et par la
 * démonstration, et posés aussi par les formulaires.
 */
export const ASSOCIATION_ERROR_CODES = [...ASSOCIATION_MEMBERSHIP_REFUSALS] as const

/** Taille d'une fenêtre de liste (demandes, adhérents, mes associations). */
export const ASSOCIATION_LIST_PAGE_SIZE = 20

/** Ma ligne pour une association — jamais celle d'autrui. */
export interface AssociationMembershipView {
  readonly membershipId: string
  readonly status: AssociationMembershipStatus
  readonly role: AssociationMemberRole
  /** Le mot joint à la demande, tant qu'elle est en cours. */
  readonly requestMessage: string | null
  /** Le motif d'un refus (facultatif) ou d'une exclusion (obligatoire) ; jamais qui l'a décidé. */
  readonly decisionReason: string | null
  readonly requestedAt: number
  readonly statusChangedAt: number
  /** Après une exclusion : les responsables ont autorisé une nouvelle demande. */
  readonly readmissionAllowed: boolean
}

/** Pourquoi la personne ne peut pas (encore) demander : une règle de l'adhésion, ou son statut dans le réseau. */
export type AssociationRequestRefusal = AssociationMembershipRefusal | "status_insufficient"

export interface AssociationRequestStanding {
  readonly allowed: boolean
  readonly refusal: AssociationRequestRefusal | null
  /** Pour `association_request_too_soon` : l'instant où la demande redevient possible. */
  readonly availableAt: number | null
}

export interface MyAssociationMembershipView {
  readonly pageId: string
  readonly membership: AssociationMembershipView | null
  readonly request: AssociationRequestStanding
  /** Mon rôle VIVANT de signataire de la page (responsable), ou `null`. */
  readonly responsibleRole: AssociationResponsibleRole | null
}

/** Une ligne de « Mes associations ». */
export interface MyAssociationItemView {
  readonly membershipId: string
  readonly status: AssociationMembershipStatus
  readonly role: AssociationMemberRole
  readonly decisionReason: string | null
  readonly statusChangedAt: number
  readonly page: { readonly id: string; readonly handle: string; readonly name: string }
}

/** Une demande, un adhérent ou une exclusion, vus par un responsable de l'association. */
export interface AssociationMemberView {
  readonly membershipId: string
  readonly status: AssociationMembershipStatus
  readonly role: AssociationMemberRole
  /** Le profil PUBLIÉ de la personne ; `displayName: null` : nom neutre. Aucune coordonnée. */
  readonly person: { readonly displayName: string | null; readonly handle: string | null; readonly avatarUrl: string | null }
  readonly requestMessage: string | null
  readonly decisionReason: string | null
  readonly requestedAt: number
  readonly statusChangedAt: number
  readonly readmissionAllowed: boolean
  /** La version lue : tout geste de gestion la cite. */
  readonly version: number
}

/** L'association que la personne gère (responsable vivant), désignée par son adresse. */
export interface ManagedAssociationView {
  readonly pageId: string
  readonly handle: string
  readonly name: string
  readonly role: AssociationResponsibleRole
}

export interface AssociationListPage<T> {
  readonly items: readonly T[]
  /** `null` : rien après cette fenêtre. */
  readonly continueCursor: string | null
  readonly isDone: boolean
}

export interface AssociationMembersRequest {
  readonly pageId: string
  readonly status: AssociationListStatus
  readonly cursor: string | null
}

export interface AssociationsCapability {
  /** Ma situation avec une association : ma ligne, ce que je peux demander, mon rôle de responsable. */
  useMyMembership(pageId: string): Loadable<MyAssociationMembershipView>
  /** Mes adhésions et demandes, les plus récemment changées d'abord. */
  useMyAssociations(args: { readonly cursor: string | null }): Loadable<AssociationListPage<MyAssociationItemView>>
  /** L'association que je gère ; refus indistinct (`not_found`) si je n'en suis pas responsable. */
  useManagedAssociation(handle: string): Loadable<ManagedAssociationView>
  /** Les demandes, adhérents ou exclusions d'une association — ses responsables vivants seulement. */
  useMembers(args: AssociationMembersRequest): Loadable<AssociationListPage<AssociationMemberView>>
  /** Demander à adhérer, avec un mot facultatif. */
  request(input: { readonly pageId: string; readonly message: string }): Promise<ActionResult>
  cancelRequest(pageId: string): Promise<ActionResult>
  leave(pageId: string): Promise<ActionResult>
  /** Accepter ou refuser une demande, à la version lue ; un refus peut être motivé. */
  decide(input: { readonly membershipId: string; readonly decision: "accept" | "reject"; readonly expectedVersion: number; readonly reason: string }): Promise<ActionResult>
  /** Exclure un adhérent (administrateur de la page), motif obligatoire. */
  remove(input: { readonly membershipId: string; readonly expectedVersion: number; readonly reason: string }): Promise<ActionResult>
  /** Nommer un animateur, ou le repasser membre (administrateur de la page). */
  setRole(input: { readonly membershipId: string; readonly expectedVersion: number; readonly role: AssociationMemberRole }): Promise<ActionResult>
  /** Autoriser une personne exclue à redemander (administrateur de la page) ; n'inscrit personne. */
  allowReadmission(input: { readonly membershipId: string; readonly expectedVersion: number }): Promise<ActionResult>
}
