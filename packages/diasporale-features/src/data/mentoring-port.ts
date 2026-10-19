/**
 * Capacité « mentorat » du port (DG-024, troisième tranche, plan global DIASPORALE).
 * PROPRIÉTAIRE : ce chantier. Facultative : un fournisseur qui ne la sert pas la
 * laisse absente, et l'écran le dit au lieu d'inventer.
 *
 * Être mentor est un OPT-IN explicite et révocable ; le mentorat est BÉNÉVOLE
 * (aucun tarif, aucun paiement). Une demande porte le consentement explicite du
 * mentoré à montrer son nom et son message au mentor ; aucune coordonnée : le
 * contact passe par la messagerie une fois la demande acceptée (ouverture à
 * câbler par le moteur).
 *
 * Deux fournisseurs, une forme : le moteur (`apps/diasporale_com/src/data/
 * engine-mentoring.ts`) et la démonstration (`demo/mentoring.ts`). Les gestes
 * rendent un code FERMÉ ; une demande d'autrui est introuvable.
 *
 * Confiance (G9) : les seules vues de GESTION portent l'état de modération
 * (`moderation`, facultatif) — mon profil de mentor, mes demandes de mentoré.
 * Jamais la fiche d'un mentor, jamais une demande lue par son mentor.
 */
import {
  MENTORING_REFUSALS,
  type CountryCode,
  type MentoringCloser,
  type MentoringDomain,
  type MentoringRequestAction,
  type MentoringRequestStatus,
  type MentoringRole,
  type MentoringSlot,
  type MentorProfileState,
  type TrustBadge,
} from "@diasporale/domain"

import type { ManagedModerationState } from "./managed-moderation"
import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/** Codes de refus propres au chantier, traduits par errors.<code> dans son fragment : ceux du domaine. */
export const MENTORING_ERROR_CODES = MENTORING_REFUSALS

/** Mentors par page de recherche. */
export const MENTORS_PAGE_SIZE = 12

/** Demandes par page de liste. */
export const MENTORING_REQUESTS_PAGE_SIZE = 20

/** Un mentor dans la recherche : ce que CE lecteur peut voir, aucune coordonnée, aucun compte de mentorés. */
export interface MentorCardView {
  readonly mentorId: string
  readonly personId: string
  /** Le nom et l'identifiant publiés par la personne. */
  readonly displayName: string
  readonly handle: string
  readonly badges: readonly TrustBadge[]
  readonly country: CountryCode
  /** La ville selon la visibilité de la facette du mentor ; `null` si elle n'est pas pour ce lecteur. */
  readonly city: string | null
  /** L'année d'arrivée, selon la même visibilité. */
  readonly arrivedAt: number | null
  readonly domains: readonly MentoringDomain[]
  /** Codes de langue (« fr », « en ») : le nom se calcule par `Intl.DisplayNames`. */
  readonly languages: readonly string[]
  /** Reçoit une demande nouvelle (actif, sous son plafond, boîte non saturée). */
  readonly acceptsRequests: boolean
}

/** La fiche d'un mentor, et la demande ouverte du lecteur auprès de lui. */
export interface MentorDetailView extends MentorCardView {
  readonly presentation: string
  readonly availability: string
  readonly state: MentorProfileState
  readonly isSelf: boolean
  readonly viewerRequest: { readonly requestId: string; readonly status: MentoringRequestStatus } | null
}

/** Mon profil de mentor, tel que moi seul le vois : le plafond affiché, mes demandes en attente. */
export interface MyMentorProfileView {
  readonly mentorId: string
  readonly state: MentorProfileState
  readonly domains: readonly MentoringDomain[]
  readonly presentation: string
  readonly languages: readonly string[]
  readonly country: CountryCode
  readonly city: string | null
  readonly availability: string
  readonly maxActiveMentees: number
  readonly activeMentees: number
  readonly pendingRequests: number
  readonly version: number
  readonly optedInAt: number
  readonly updatedAt: number
  /** L'état de modération de mon profil, à moi seul ; absent si le fournisseur ne le sert pas. */
  readonly moderation?: ManagedModerationState
}

/** L'autre partie d'une demande : son nom publié, jamais une coordonnée. */
export interface MentoringPartyView {
  readonly displayName: string | null
  readonly handle: string | null
}

/** Le créneau proposé par le mentor, avec son fuseau. */
export interface MentoringProposedSlotView extends MentoringSlot {
  readonly timeZone: string
  readonly proposedAt: number
}

export interface MentoringRequestSummaryView {
  readonly requestId: string
  /** L'état EFFECTIF lu par le fournisseur (expiration constatée). */
  readonly status: MentoringRequestStatus
  readonly viewerRole: MentoringRole
  readonly mentorId: string
  /** Le mentor pour le mentoré ; le mentoré pour le mentor. */
  readonly counterpart: MentoringPartyView
  readonly domain: MentoringDomain
  readonly goal: string
  readonly wishedSlots: readonly MentoringSlot[]
  /** Le fuseau du mentoré. */
  readonly timeZone: string
  readonly slot: MentoringProposedSlotView | null
  /** L'échéance qui court ; `null` une fois la demande acceptée ou close. */
  readonly deadlineAt: number | null
  readonly createdAt: number
  readonly updatedAt: number
  /** L'état de modération de la demande, au seul mentoré qui la porte ; absent pour le mentor. */
  readonly moderation?: ManagedModerationState
}

export interface MentoringRequestDetailView extends MentoringRequestSummaryView {
  readonly message: string
  readonly slotVersion: number
  readonly acceptedAt: number | null
  readonly closedBy: MentoringCloser | null
  readonly closedReason: string | null
  readonly closedAt: number | null
  /** Les gestes réellement ouverts à ce lecteur (calculés par le fournisseur). */
  readonly actions: readonly MentoringRequestAction[]
}

export interface MentoringPage<Row> {
  readonly items: readonly Row[]
  readonly continueCursor: string | null
  readonly isDone: boolean
}

export type MentorsPageQuery = Loadable<MentoringPage<MentorCardView>>
export type MentoringRequestsPageQuery = Loadable<MentoringPage<MentoringRequestSummaryView>>

/** Ce que le mentor saisit de son profil. */
export interface MentorProfileInputView {
  readonly domains: readonly MentoringDomain[]
  readonly presentation: string
  readonly languages: readonly string[]
  readonly country: CountryCode
  readonly city: string | null
  readonly availability: string
  readonly maxActiveMentees: number
}

export interface MentoringRequestInputView {
  readonly mentorId: string
  readonly domain: MentoringDomain
  readonly goal: string
  readonly message: string
  readonly wishedSlots: readonly MentoringSlot[]
  /** Le fuseau du navigateur du mentoré. */
  readonly timeZone: string
  /** Consentement explicite à montrer son nom et son message au mentor. */
  readonly shareWithMentor: boolean
  /** Stable pendant la vie de la feuille : un double envoi rend la même demande. */
  readonly idempotencyKey: string
}

/** Un créneau saisi par le mentor, dans le fuseau où il le pense. */
export interface MentoringSlotInput extends MentoringSlot {
  readonly timeZone: string
}

export interface MentoringCapability {
  /** Mon profil de mentor (tout état) ; `null` : je ne suis pas mentor. */
  useMyProfile(): Loadable<MyMentorProfileView | null>
  /** Les mentors actifs d'un pays, tous domaines (`domain` à `null`) ou un domaine. */
  useSearch(args: { readonly country: CountryCode; readonly domain: MentoringDomain | null; readonly cursor: string | null }): MentorsPageQuery
  /** La fiche d'un mentor ; `null` : introuvable pour moi (inconnu, en pause, retiré, bloqué). */
  useMentor(mentorId: string): Loadable<MentorDetailView | null>
  /** Mes demandes comme mentoré, des plus récemment mises à jour. */
  useMenteeRequests(args: { readonly cursor: string | null }): MentoringRequestsPageQuery
  /** Les demandes reçues comme mentor, toutes (`status` à `null`) ou par état. */
  useMentorRequests(args: { readonly status: MentoringRequestStatus | null; readonly cursor: string | null }): MentoringRequestsPageQuery
  /** Une demande à laquelle je participe ; `null` : introuvable pour moi. */
  useRequest(requestId: string): Loadable<MentoringRequestDetailView | null>
  becomeMentor(input: MentorProfileInputView & { readonly consent: boolean }): Promise<ActionResult<{ readonly mentorId: string; readonly version: number }>>
  updateProfile(input: MentorProfileInputView & { readonly expectedVersion: number }): Promise<ActionResult<{ readonly version: number }>>
  setState(input: { readonly expectedVersion: number; readonly state: MentorProfileState }): Promise<ActionResult<{ readonly state: MentorProfileState; readonly version: number }>>
  request(input: MentoringRequestInputView): Promise<ActionResult<{ readonly requestId: string; readonly created: boolean }>>
  cancel(input: { readonly requestId: string; readonly reason: string | null }): Promise<ActionResult>
  accept(input: { readonly requestId: string; readonly slot: MentoringSlotInput | null }): Promise<ActionResult<{ readonly slotVersion: number }>>
  decline(input: { readonly requestId: string; readonly reason: string | null }): Promise<ActionResult>
  proposeSlot(input: { readonly requestId: string; readonly expectedSlotVersion: number; readonly slot: MentoringSlotInput }): Promise<ActionResult<{ readonly slotVersion: number }>>
  close(input: { readonly requestId: string; readonly reason: string | null }): Promise<ActionResult>
}
