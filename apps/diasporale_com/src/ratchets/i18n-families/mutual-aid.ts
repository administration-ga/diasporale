/**
 * Familles de clés DYNAMIQUES du chantier « entraide » (DG-024 a), énumérées depuis les
 * constantes qui les pilotent. PROPRIÉTAIRE : ce chantier. Une clé citée en toutes
 * lettres n'a rien à faire ici.
 */
import { AID_MISSION_STATUSES, AID_QUESTION_STATUSES, AID_THEMES } from "@diasporale/domain"
import { MUTUAL_AID_MISSION_VIEWS, MUTUAL_AID_QUESTION_VIEWS } from "@diasporale/features/data"

/** Les issues annoncées après un geste (question, réponse, mission, inscription). */
const FEEDBACK = [
  "answered",
  "questionSaved",
  "accepted",
  "unaccepted",
  "answerWithdrawn",
  "closed",
  "withdrawn",
  "signedUp",
  "signupWithdrawn",
  "missionClosed",
  "missionSaved",
  "missionCancelled",
] as const

export const FAMILIES: readonly string[] = [
  ...AID_THEMES.map((theme) => `mutualAid.theme.${theme}`),
  ...AID_QUESTION_STATUSES.map((status) => `mutualAid.questionStatus.${status}`),
  ...AID_MISSION_STATUSES.map((status) => `mutualAid.missionStatus.${status}`),
  ...MUTUAL_AID_QUESTION_VIEWS.flatMap((view) => [
    `mutualAid.questions.view.${view}`,
    `mutualAid.questions.empty.${view}.title`,
    `mutualAid.questions.empty.${view}.body`,
  ]),
  ...MUTUAL_AID_MISSION_VIEWS.flatMap((view) => [
    `mutualAid.missions.view.${view}`,
    `mutualAid.missions.empty.${view}.title`,
    `mutualAid.missions.empty.${view}.body`,
  ]),
  ...FEEDBACK.map((kind) => `mutualAid.feedback.${kind}`),
]
