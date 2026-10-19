/**
 * Familles de clés DYNAMIQUES du chantier « talents et emploi » (DG-025), énumérées depuis les
 * constantes qui les pilotent. PROPRIÉTAIRE : ce chantier. Une clé citée en toutes lettres n'a
 * rien à faire ici ; les `errors.<code>` sont couverts par les codes fermés (`JOB_ERROR_CODES`),
 * les contrats par la famille `job.contract.*` des cartes d'emploi (`JOB_CONTRACTS`).
 */
import { JOB_APPLICATION_STATUSES, JOB_OFFER_STATUSES, JOB_PAY_PERIODS, JOB_WORK_MODES, TALENT_AVAILABILITIES, TALENT_VISIBILITIES } from "@diasporale/domain"

/** Les gestes d'état d'une offre dans l'espace recruteur (`jobs.recruiter.action|done.<geste>`). */
const STATUS_ACTIONS = ["publish", "suspend", "resume", "close"] as const

/** Les décisions de l'équipe sur une candidature (`jobs.decisionDone.<décision>`). */
const DECISIONS = ["mark_seen", "shortlist", "not_select"] as const

export const FAMILIES: readonly string[] = [
  ...JOB_WORK_MODES.map((mode) => `jobs.workMode.${mode}`),
  ...JOB_PAY_PERIODS.map((period) => `jobs.payPeriod.${period}`),
  ...JOB_OFFER_STATUSES.map((status) => `jobs.status.${status}`),
  ...JOB_APPLICATION_STATUSES.map((status) => `jobs.applicationStatus.${status}`),
  ...TALENT_AVAILABILITIES.map((availability) => `jobs.availability.${availability}`),
  ...TALENT_VISIBILITIES.flatMap((visibility) => [`jobs.visibility.${visibility}.label`, `jobs.visibility.${visibility}.hint`]),
  ...STATUS_ACTIONS.flatMap((action) => [`jobs.recruiter.action.${action}`, `jobs.recruiter.done.${action}`]),
  ...DECISIONS.map((decision) => `jobs.decisionDone.${decision}`),
]
