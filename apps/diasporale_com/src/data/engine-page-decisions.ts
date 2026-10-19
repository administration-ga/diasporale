"use client"

/**
 * Adaptateur moteur de la capacité « décisions de page » (P16 · G9).
 * PROPRIÉTAIRE : chantier « confiance des surfaces ».
 *
 * Fonctions du moteur EXISTANTES (`moderation/cases`, P16) :
 *   · `pageDecisions` (`networkQuery`) : les décisions qui ont RETIRÉ un contenu
 *     porté par la page, lues par un signataire VIVANT dans le réseau
 *     DIASPORALE, avec l'état des recours ; ni déclarant, ni contenu, ni
 *     modérateur ;
 *   · `fileAppeal` (`personMutation`) : la même porte que le recours personnel,
 *     ouverte au signataire vivant de la page porteuse (`ownsCase`).
 *
 * Le moteur refuse d'un `notFound` indistinct à qui ne signe pas, ou plus, pour
 * la page : l'adaptateur le dit `null`, la même réponse qu'une page introuvable.
 * Le réseau d'une décision lue ici est toujours DIASPORALE (lecture dans ce
 * réseau) ; une décision de page ne porte aucune sanction personnelle.
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import {
  appealReasonRefusal,
  decisionGround,
  DECISIONS_PAGE_SIZE,
  nextAppealLevel,
  type ModerationDecisionView,
  type PageDecisionsCapability,
  type PageDecisionsQuery,
  type PageDecisionsRequest,
} from "@diasporale/features/data"
import type { FunctionReturnType } from "convex/server"

import { dataRightsErrorCode } from "./engine-data-rights"
import { failed, LOADING, memberReadError, ready, Refusal, useEngineMember, useLoaded, type EngineSourceDeps } from "./engine-kit"

const PAGE_DECISIONS = api.modules.moderation.cases.pageDecisions
const FILE_APPEAL = api.modules.moderation.cases.fileAppeal

type PageDecisionRow = FunctionReturnType<typeof PAGE_DECISIONS>["page"][number]

/** Une décision de page, sans identifiant de cible ni d'équipe : le recours suit la règle du moteur (`nextAppealLevel`). */
export function toPageDecisionView(row: PageDecisionRow): ModerationDecisionView {
  const view = {
    reportId: row.reportId,
    network: "diasporale" as const,
    surface: row.target.kind,
    ground: decisionGround(row.reason),
    status: row.status,
    level: row.level,
    createdAt: row.createdAt,
    decisionReason: row.decisionReason,
    sanctions: [],
    appeals: row.appeals.map((appeal) => ({ level: appeal.level, status: appeal.status, decisionReason: appeal.decisionReason })),
  }
  return { ...view, appealLevel: nextAppealLevel(view) }
}

export function createEnginePageDecisions(deps: EngineSourceDeps): PageDecisionsCapability {
  return {
    useDecisions({ pageId, cursor }: PageDecisionsRequest): PageDecisionsQuery {
      const member = useEngineMember()
      const refusal = memberReadError(member)
      const networkId = member.networkId.state === "ready" ? member.networkId.value : null
      const canRead = refusal === null && member.auth.isAuthenticated && member.membership.state === "ready" && member.membership.value !== null && networkId !== null && pageId.trim().length > 0
      const page = useLoaded(PAGE_DECISIONS, canRead && networkId !== null
        ? { networkId, pageId: pageId as Id<"pages">, paginationOpts: { cursor, numItems: DECISIONS_PAGE_SIZE } }
        : "skip")
      if (refusal !== null) return failed(refusal)
      if (!canRead || page.state === "loading") return LOADING
      // Le refus indistinct du moteur : je ne signe pas, ou plus, pour cette page.
      if (page.state === "error") return page.code === "not_found" ? ready(null) : failed(page.code)
      return ready({
        items: page.value.page.map(toPageDecisionView),
        continueCursor: page.value.isDone ? null : page.value.continueCursor,
        isDone: page.value.isDone,
      })
    },

    async fileAppeal({ pageId, reportId, reason }) {
      try {
        const refusal = appealReasonRefusal(reason)
        if (refusal) throw new Refusal(refusal)
        if (pageId.trim().length === 0 || reportId.trim().length === 0) throw new Refusal("not_found")
        const result = await deps.convex.mutation(FILE_APPEAL, { reportId: reportId as Id<"reports">, reason: reason.trim() })
        return { ok: true, value: { created: result.created } }
      } catch (error) {
        return { ok: false, code: dataRightsErrorCode(error) }
      }
    },
  }
}
