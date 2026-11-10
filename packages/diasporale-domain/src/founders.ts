/**
 * Membres fondateurs (EA-01) — amorcer la confiance par une DÉCISION tracée du
 * réseau. Décision 1 du plan 01, recommandation retenue par le propriétaire :
 * une cohorte fondatrice admise par un opérateur, motif obligatoire, cohorte
 * plafonnée, avec en option une dispense d'ancienneté pour parrainer. Pour tous
 * les autres, l'ancienneté (30 jours) et le quota du parrain ne changent pas
 * (décision 3).
 *
 * L'admission n'est pas un statut saisi : c'est un FAIT (`foundingAdmission`
 * des `MembershipGrounds`), qui vérifie par LA règle (`deriveMembershipStatus`).
 * Elle ne vise qu'une personne déjà entrée d'elle-même dans le réseau : aucune
 * adhésion n'est créée d'office. Elle se retire (motif à l'appui), et s'éteint
 * avec le départ, comme le parrainage ; le statut retombe alors selon les faits
 * restants.
 */
import type { MembershipGrounds, MembershipStatus } from "./eligibility"
import { ok, refuse, type Result } from "./result"

/**
 * Plafond de la cohorte fondatrice : admissions EN VIGUEUR dans le réseau.
 * Valeur PRUDENTE et provisoire, la seule du code : le nombre reste à confirmer
 * par le propriétaire (porte d'EA-01 : « qui, combien »).
 */
export const FOUNDING_COHORT_MAX = 30

/** Plancher du motif d'une décision d'admission ou de retrait (comme les décisions de la console). */
export const FOUNDING_REASON_MIN = 10

/** Qui a mis fin à une admission fondatrice : un opérateur (décision motivée), ou le départ de la personne. */
export const FOUNDING_WITHDRAWAL_CAUSES = ["operator", "departure"] as const
export type FoundingWithdrawalCause = (typeof FOUNDING_WITHDRAWAL_CAUSES)[number]

export const FOUNDING_ADMISSION_REFUSALS = [
  /** La personne n'est pas membre active du réseau (absente, partie, suspendue) : rien d'office. */
  "founding_target_not_member",
  "founding_already_admitted",
  "founding_cohort_full",
] as const
export type FoundingAdmissionRefusal = (typeof FOUNDING_ADMISSION_REFUSALS)[number]

export const FOUNDING_WITHDRAWAL_REFUSALS = ["founding_not_admitted"] as const
export type FoundingWithdrawalRefusal = (typeof FOUNDING_WITHDRAWAL_REFUSALS)[number]

/** Statuts EFFECTIFS d'une personne qu'un opérateur peut admettre : membre active, quelle que soit sa porte. */
const ADMISSIBLE_STATUSES: ReadonlySet<MembershipStatus> = new Set(["en_attente", "declaree", "verifiee"])

/**
 * Peut-on admettre cette personne dans la cohorte ? La cible d'abord (membre
 * active, pas déjà admise), le plafond ensuite. `targetStatus` est le statut
 * EFFECTIF (une suspension à la racine compte), `null` sans adhésion.
 */
export function checkFoundingAdmission(input: {
  readonly targetStatus: MembershipStatus | null
  readonly alreadyAdmitted: boolean
  /** Admissions en vigueur dans le réseau, comptées jusqu'au plafond au plus. */
  readonly activeCohort: number
}): Result<true, FoundingAdmissionRefusal> {
  if (input.targetStatus === null || !ADMISSIBLE_STATUSES.has(input.targetStatus)) return refuse("founding_target_not_member")
  if (input.alreadyAdmitted) return refuse("founding_already_admitted")
  if (input.activeCohort >= FOUNDING_COHORT_MAX) return refuse("founding_cohort_full")
  return ok(true)
}

/** Retirer une admission : seulement celle qui est en vigueur (le journal ne porte jamais deux retraits). */
export function checkFoundingWithdrawal(input: { readonly admitted: boolean }): Result<true, FoundingWithdrawalRefusal> {
  return input.admitted ? ok(true) : refuse("founding_not_admitted")
}

/** La dispense d'ancienneté du parrain, telle que la décision en vigueur l'accorde (rien sans décision). */
export function foundingSeniorityWaived(grounds: Pick<MembershipGrounds, "foundingAdmission">): boolean {
  return grounds.foundingAdmission?.seniorityWaiver === true
}
