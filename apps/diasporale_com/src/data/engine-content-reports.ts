"use client"

/**
 * Adaptateur moteur de la capacité « signalements » (G9) : la porte unique de
 * modération du moteur (`moderation/cases`, geste `report`), pour les neuf natures
 * de la vague H. PROPRIÉTAIRE : chantier « confiance des surfaces ».
 *
 * Écriture : la garde commune (nature du contrat, identifiant, motif fermé) est
 * jugée avant tout appel ; la personne de la session est relue ; le réseau est celui
 * de DIASPORALE (`resolveDiasporaleNetworkId`) ; les refus passent par
 * `attemptAction`, affinés pour les deux que le signalement sait dire. Le moteur
 * refuse son propre contenu d'un refus indistinct et rend le dossier existant à un
 * rejeu (`created: false`).
 *
 * Masque : le moteur ne relit plus à la personne ce qu'elle a signalé. L'adaptateur
 * garde en plus, pour CET onglet et pour la seule personne qui a signalé, les cibles
 * qu'elle vient de signaler : l'écran les masque sans attendre la relecture. Rien
 * n'est écrit dans le navigateur.
 */
import { useStableConvexAuth } from "@antsia/api/hooks"
import { engineErrorCode } from "@antsia/social-contracts/errors"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  contentReportKey,
  contentReportRefusal,
  type ActionErrorCode,
  type ContentReportsCapability,
  type ContentReportTarget,
} from "@diasporale/features/data"
import type { FunctionArgs } from "convex/server"
import { useSyncExternalStore } from "react"

import { engineActionErrorCode } from "./engine-errors"
import { attemptAction, Refusal, resolveDiasporaleNetworkId, useLoaded, type EngineSourceDeps } from "./engine-kit"

const REPORT = api.modules.moderation.cases.report
const MY_PERSON = api.modules.people.persons.getMyPerson

type EngineTarget = FunctionArgs<typeof REPORT>["target"]

/** La cible telle que le moteur la type : la table de chaque nature (contrat figé des surfaces). */
export function engineReportTarget(target: ContentReportTarget): EngineTarget {
  switch (target.kind) {
    case "diasporaAidQuestion":
      return { kind: "diasporaAidQuestion", id: target.id as Id<"aidQuestions"> }
    case "diasporaAidAnswer":
      return { kind: "diasporaAidAnswer", id: target.id as Id<"aidAnswers"> }
    case "diasporaAidMission":
      return { kind: "diasporaAidMission", id: target.id as Id<"aidMissions"> }
    case "diasporaMentorProfile":
      return { kind: "diasporaMentorProfile", id: target.id as Id<"mentorProfiles"> }
    case "diasporaMentoringRequest":
      return { kind: "diasporaMentoringRequest", id: target.id as Id<"mentoringRequests"> }
    case "diasporaKitResource":
      return { kind: "diasporaKitResource", id: target.id as Id<"kitResources"> }
    case "diasporaJobOffer":
      return { kind: "diasporaJobOffer", id: target.id as Id<"jobOffers"> }
    case "diasporaTalentProfile":
      return { kind: "diasporaTalentProfile", id: target.id as Id<"talentProfiles"> }
    case "diasporaJobApplication":
      return { kind: "diasporaJobApplication", id: target.id as Id<"jobApplications"> }
  }
}

/** Le champ fautif d'un `invalidArgument` du moteur (un nom de champ, jamais une valeur). */
function invalidField(error: unknown): string | null {
  if (engineErrorCode(error) !== "invalidArgument" || typeof error !== "object" || error === null || !("data" in error)) return null
  const data = (error as { data: unknown }).data
  if (typeof data !== "object" || data === null || !("field" in data)) return null
  const field = (data as { field: unknown }).field
  return typeof field === "string" ? field : null
}

/**
 * Les deux refus que le signalement sait dire mieux que la table commune : le geste
 * momentanément fermé (sourdine, limite des équipes) et un motif refusé. `null` : la
 * table commune du moteur le dit (session, réseau, débit, refus indistinct…).
 */
export function contentReportRefusalOf(error: unknown): ActionErrorCode | null {
  if (engineActionErrorCode(error) !== "unknown") return null
  if (engineErrorCode(error) === "policyRefused") return "content_report_unavailable"
  if (invalidField(error) === "reason") return "report_reason_required"
  return null
}

/** La clé de la mémoire de l'onglet : une personne, une cible. */
function memoryKey(personId: string, target: ContentReportTarget): string {
  return `${personId}\u0000${contentReportKey(target)}`
}

export function createEngineContentReports(deps: EngineSourceDeps): ContentReportsCapability {
  const networkOf = () => resolveDiasporaleNetworkId(deps.convex)
  // Les cibles signalées dans cet onglet, par personne : le masque immédiat, en mémoire seulement.
  const reported = new Set<string>()
  const listeners = new Set<() => void>()
  let version = 0
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const getVersion = () => version

  function remember(personId: string, target: ContentReportTarget): void {
    const key = memoryKey(personId, target)
    if (reported.has(key)) return
    reported.add(key)
    version += 1
    for (const listener of listeners) listener()
  }

  return {
    demonstration: false,

    report: (input) => attemptAction(async () => {
      const refusal = contentReportRefusal(input)
      if (refusal !== null) throw new Refusal(refusal)
      // La personne qui signale : le masque de l'onglet ne vaut que pour elle.
      const person = await deps.convex.query(MY_PERSON, {})
      if (!person) throw new Refusal("not_signed_in")
      const networkId = await networkOf()
      let created: boolean
      try {
        const result = await deps.convex.mutation(REPORT, { networkId, target: engineReportTarget(input), reason: input.reason })
        created = result.created
      } catch (error) {
        const code = contentReportRefusalOf(error)
        if (code !== null) throw new Refusal(code)
        throw error
      }
      remember(person._id, input)
      return { created }
    }),

    useReported(target) {
      const auth = useStableConvexAuth()
      const person = useLoaded(MY_PERSON, auth.isAuthenticated ? {} : "skip")
      // La mémoire relance le rendu quand elle change ; la lecture se fait à chaque rendu.
      useSyncExternalStore(subscribe, getVersion, getVersion)
      const personId = auth.isAuthenticated && person.state === "ready" && person.value !== null ? person.value._id : null
      return personId !== null && reported.has(memoryKey(personId, target))
    },
  }
}
