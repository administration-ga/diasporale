/**
 * Capacité « entraide » du port (DG-024 a, plan global §G8.2) — questions
 * d'entraide d'un pays et d'une ville saisie, réponses et « réponse retenue »
 * par l'auteur de la question ; missions bénévoles des pages d'association et
 * inscriptions consenties. PROPRIÉTAIRE : chantier « entraide ».
 *
 * Facultative : un fournisseur qui ne la sert pas la laisse absente, et l'écran
 * le dit au lieu d'inventer. Deux fournisseurs, une forme : le moteur
 * (`convex/modules/diaspora/mutualAid.ts`, adaptateur `engine-mutual-aid.ts`)
 * et la démonstration (`demo/mutual-aid.ts`, données explicitement fictives).
 * Les règles sont celles de `@diasporale/domain` (module de l'entraide) des
 * deux côtés.
 *
 * Aucune coordonnée n'entre ni ne sort : le contact privé passe par la
 * messagerie. La liste des bénévoles n'existe que pour l'équipe vivante de la
 * page ; chaque bénévole a consenti à y montrer son nom publié.
 *
 * L'état de modération (`moderation`, G9) n'est servi qu'à qui GÈRE le contenu :
 * l'auteur de la question ou de la réponse, l'équipe vivante de la page qui porte
 * la mission. Facultatif : absent pour tout autre lecteur, et chez un fournisseur
 * qui ne modère pas (la démonstration).
 */
import {
  MUTUAL_AID_REFUSALS,
  type AidMissionStatus,
  type AidQuestionListStatus,
  type AidQuestionStatus,
  type AidTheme,
  type CountryCode,
  type MutualAidRefusal,
  type TrustBadge,
} from "@diasporale/domain"

import type { ManagedModerationState } from "./managed-moderation"
import type { ActionResult } from "./port"
import type { Loadable } from "./types"

/** Codes de refus propres au chantier, traduits par errors.<code> dans son fragment. */
export const MUTUAL_AID_ERROR_CODES = [...MUTUAL_AID_REFUSALS] as const

/** Taille d'une fenêtre de liste demandée au fournisseur (le moteur plafonne à cinquante). */
export const MUTUAL_AID_PAGE_SIZE = 20

/** Les vues de l'onglet « Questions » : par état dans un pays, ou les miennes. */
export const MUTUAL_AID_QUESTION_VIEWS = ["open", "resolved", "closed", "mine"] as const
export type MutualAidQuestionView = (typeof MUTUAL_AID_QUESTION_VIEWS)[number]

/** Les vues de l'onglet « Missions bénévoles » : à venir dans un pays, mes inscriptions, celles de mes associations. */
export const MUTUAL_AID_MISSION_VIEWS = ["upcoming", "mine", "team"] as const
export type MutualAidMissionView = (typeof MUTUAL_AID_MISSION_VIEWS)[number]

/** Une personne telle que l'entraide la montre : son profil PUBLIÉ ; `displayName: null` : nom neutre. */
export interface AidPersonView {
  readonly displayName: string | null
  readonly handle: string | null
}

/** La page d'association qui porte une mission : sa carte publique, badge CALCULÉ. Aucun signataire. */
export interface AidPageView {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly badge: TrustBadge
}

/** Une question dans une liste. */
export interface AidQuestionCardView {
  readonly id: string
  readonly title: string
  /** Éventuellement vide : la question tient dans son titre. */
  readonly detail: string
  readonly theme: AidTheme
  readonly country: CountryCode
  readonly city: string | null
  readonly status: AidQuestionStatus
  /** Les réponses publiées. */
  readonly answerCount: number
  readonly hasAcceptedAnswer: boolean
  readonly author: AidPersonView
  readonly isMine: boolean
  readonly createdAt: number
  /** L'état de modération, pour son auteur seul (« Mes questions », sa fiche) ; absent ailleurs. */
  readonly moderation?: ManagedModerationState
}

/** Une réponse publiée. */
export interface AidAnswerView {
  readonly id: string
  readonly questionId: string
  readonly body: string
  /** La version lue : son auteur la cite pour la modifier ou la retirer. */
  readonly version: number
  readonly author: AidPersonView
  readonly isMine: boolean
  readonly isAccepted: boolean
  readonly createdAt: number
  readonly editedAt: number | null
  /** L'état de modération, pour son auteur seul (une réponse retirée ne se sert à personne) ; absent ailleurs. */
  readonly moderation?: ManagedModerationState
}

/** La fiche d'une question : sa carte, sa version, sa réponse retenue, et ce que le lecteur peut y faire. */
export interface AidQuestionDetailView extends AidQuestionCardView {
  readonly version: number
  readonly updatedAt: number
  readonly editedAt: number | null
  /** La réponse retenue par l'auteur, encore publiée ; `null` sinon. */
  readonly acceptedAnswer: AidAnswerView | null
  /** Le lecteur peut répondre (droit de publier, question ni close ni pleine). */
  readonly canAnswer: boolean
  /** L'auteur peut modifier, retenir une réponse ou clore (question ouverte ou résolue, droit de publier). */
  readonly canEdit: boolean
}

/** Pourquoi le lecteur ne peut pas (encore) s'inscrire : une règle de la mission, ou son statut dans le réseau. */
export type AidSignupRefusal = MutualAidRefusal | "status_insufficient"

/** Une mission dans une liste. */
export interface AidMissionCardView {
  readonly id: string
  readonly page: AidPageView
  readonly title: string
  readonly description: string
  readonly country: CountryCode
  readonly city: string
  /** Le lieu APPROXIMATIF (quartier, repère), jamais une adresse exacte. */
  readonly area: string | null
  readonly startsAt: number
  readonly endsAt: number | null
  /** Le fuseau dans lequel l'équipe a pensé l'horaire. */
  readonly timeZone: string
  readonly places: number
  readonly signupCount: number
  readonly status: AidMissionStatus
  /** Le lecteur y est inscrit. */
  readonly signedUp: boolean
  /** L'état de modération, pour l'équipe vivante seule (missions de ses associations, fiche gérée) ; absent ailleurs. */
  readonly moderation?: ManagedModerationState
}

/** La fiche d'une mission : sa carte, sa version, son annulation et ce que le lecteur peut y faire. */
export interface AidMissionDetailView extends AidMissionCardView {
  readonly version: number
  readonly cancelReason: string | null
  /** Ce que le lecteur peut faire maintenant : s'inscrire, ou la raison qui l'en empêche. */
  readonly signup: { readonly allowed: boolean; readonly refusal: AidSignupRefusal | null }
  /** Le lecteur est signataire vivant de la page : il gère la mission et lit ses bénévoles. */
  readonly canManage: boolean
  readonly createdAt: number
  readonly updatedAt: number
}

/** Une entraide désignée par son adresse (`/entraide/<id>`) : une question, ou une mission. */
export type AidItemView =
  | { readonly kind: "question"; readonly question: AidQuestionDetailView }
  | { readonly kind: "mission"; readonly mission: AidMissionDetailView }

/** Un bénévole inscrit, vu par l'équipe de la page : son nom publié (consenti), jamais une coordonnée. */
export interface AidVolunteerView {
  readonly id: string
  readonly person: AidPersonView
  readonly signedUpAt: number
}

/** Une page d'association au nom de laquelle le lecteur peut proposer une mission. */
export interface AidMissionPageOption {
  readonly id: string
  readonly handle: string
  readonly name: string
  readonly country: CountryCode | null
  readonly city: string | null
}

/** Une fenêtre de liste : curseur opaque du fournisseur, fin distincte d'une page vide. */
export interface AidListPage<T> {
  readonly items: readonly T[]
  /** `null` : rien après cette fenêtre. */
  readonly continueCursor: string | null
  readonly isDone: boolean
}

export interface AidQuestionsRequest {
  readonly country: CountryCode
  /** Ville saisie, facultative ; la liste se borne alors à cette ville. */
  readonly city?: string
  readonly status: AidQuestionListStatus
  readonly cursor: string | null
}

export interface AidMissionsRequest {
  readonly country: CountryCode
  readonly city?: string
  /** Les missions qui commencent après cet instant (fixé à l'ouverture de la liste : curseurs stables). */
  readonly from: number
  readonly cursor: string | null
}

/** La saisie d'une question, telle que le formulaire la rend ; le domaine la juge. */
export interface AidQuestionInputView {
  readonly title: string
  readonly detail: string
  readonly theme: AidTheme
  readonly country: CountryCode
  /** Vide : tout le pays. */
  readonly city: string
}

/** La saisie d'une mission, telle que le formulaire la rend ; le domaine la juge. */
export interface AidMissionInputView {
  readonly title: string
  readonly description: string
  readonly country: CountryCode
  readonly city: string
  /** Vide : aucun lieu approximatif. */
  readonly area: string
  readonly startsAt: number
  readonly endsAt: number | null
  readonly timeZone: string
  readonly places: number
}

export interface MutualAidCapability {
  // Les questions.
  /** Les questions d'un pays (et d'une ville saisie) dans un état, les plus récentes d'abord. */
  useQuestions(request: AidQuestionsRequest): Loadable<AidListPage<AidQuestionCardView>>
  /** Mes questions, les plus récentes d'abord (jamais une question retirée). */
  useMyQuestions(args: { readonly cursor: string | null }): Loadable<AidListPage<AidQuestionCardView>>
  /** Une question ou une mission ; `null` : introuvable ou illisible pour ce lecteur (même réponse). */
  useItem(itemId: string): Loadable<AidItemView | null>
  /** Les réponses publiées d'une question, dans l'ordre d'arrivée. */
  useAnswers(args: { readonly questionId: string; readonly cursor: string | null }): Loadable<AidListPage<AidAnswerView>>
  askQuestion(input: AidQuestionInputView): Promise<ActionResult<{ questionId: string }>>
  /** Modifier ma question, à la version lue (`aid_version_conflict` sinon) ; son pays ne change pas. */
  updateQuestion(input: Omit<AidQuestionInputView, "country"> & { readonly questionId: string; readonly expectedVersion: number }): Promise<ActionResult>
  closeQuestion(input: { readonly questionId: string; readonly expectedVersion: number }): Promise<ActionResult>
  withdrawQuestion(input: { readonly questionId: string; readonly expectedVersion: number }): Promise<ActionResult>
  answer(input: { readonly questionId: string; readonly body: string }): Promise<ActionResult<{ answerId: string }>>
  updateAnswer(input: { readonly answerId: string; readonly expectedVersion: number; readonly body: string }): Promise<ActionResult>
  withdrawAnswer(input: { readonly answerId: string; readonly expectedVersion: number }): Promise<ActionResult>
  /** Retenir une réponse (l'auteur de la question seul), à la version lue de la question. */
  acceptAnswer(input: { readonly questionId: string; readonly answerId: string; readonly expectedVersion: number }): Promise<ActionResult>
  unacceptAnswer(input: { readonly questionId: string; readonly expectedVersion: number }): Promise<ActionResult>
  // Les missions bénévoles.
  /** Les missions OUVERTES d'un pays (et d'une ville saisie) à venir, des plus proches aux plus lointaines. */
  useMissions(request: AidMissionsRequest): Loadable<AidListPage<AidMissionCardView>>
  /** Mes inscriptions confirmées, les plus récentes d'abord. */
  useMySignups(args: { readonly cursor: string | null }): Loadable<AidListPage<AidMissionCardView>>
  /** Les pages d'association dont je suis signataire vivant. */
  useMissionPages(): Loadable<readonly AidMissionPageOption[]>
  /** Toutes les missions d'une page que je gère ; refus indistinct (`not_found`) hors de son équipe. */
  usePageMissions(args: { readonly pageId: string; readonly cursor: string | null }): Loadable<AidListPage<AidMissionCardView>>
  /** Les bénévoles d'une mission — l'équipe vivante de la page seulement. */
  useVolunteers(args: { readonly missionId: string; readonly cursor: string | null }): Loadable<AidListPage<AidVolunteerView>>
  createMission(input: AidMissionInputView & { readonly pageId: string }): Promise<ActionResult<{ missionId: string }>>
  /** Modifier une mission ouverte ou complète, à la version lue ; les places ne descendent jamais sous les inscrits. */
  updateMission(input: AidMissionInputView & { readonly missionId: string; readonly expectedVersion: number }): Promise<ActionResult>
  closeMission(input: { readonly missionId: string; readonly expectedVersion: number }): Promise<ActionResult>
  /** Annuler une mission (terminal), avec un motif facultatif lu par les inscrits. */
  cancelMission(input: { readonly missionId: string; readonly expectedVersion: number; readonly reason: string }): Promise<ActionResult>
  /** S'inscrire : le consentement EXPLICITE à montrer son nom publié à l'équipe de la page est exigé. */
  signUp(input: { readonly missionId: string; readonly shareNameWithTeam: boolean }): Promise<ActionResult>
  withdrawSignup(missionId: string): Promise<ActionResult>
}
