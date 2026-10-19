import type { Id } from "@convex/_generated/dataModel"
import { describe, expect, it } from "vitest"

import { toPageDecisionView } from "./engine-page-decisions"
import { toNotificationView } from "./engine-views"

/**
 * Décisions de page (P16 · G9) — projection d'une ligne de `moderation/cases.pageDecisions` :
 * réseau DIASPORALE, aucune sanction personnelle, motif fermé, niveau du recours suivant
 * selon la règle du moteur (`nextAppealLevel`).
 */
type Row = Parameters<typeof toPageDecisionView>[0]

const BASE = {
  reportId: "report-1",
  networkId: "network-diasporale",
  target: { kind: "diasporaJobOffer", id: "job-1" },
  teamId: "team-gabon",
  level: "team",
  reason: "misinformation",
  status: "actioned",
  createdAt: Date.UTC(2026, 9, 19, 9),
  decisionReason: "Offre trompeuse : employeur introuvable.",
  appeals: [],
} as const

const row = (overrides: Record<string, unknown> = {}): Row => ({ ...BASE, ...overrides }) as unknown as Row

describe("décisions de page — projection du moteur", () => {
  it("dit le réseau DIASPORALE, aucune sanction, et ouvre le recours au réseau pour une décision d'équipe", () => {
    expect(toPageDecisionView(row())).toEqual({
      reportId: "report-1",
      network: "diasporale",
      surface: "diasporaJobOffer",
      ground: "misinformation",
      status: "actioned",
      level: "team",
      createdAt: BASE.createdAt,
      decisionReason: "Offre trompeuse : employeur introuvable.",
      sanctions: [],
      appeals: [],
      appealLevel: "network",
    })
  })

  it("après un recours maintenu par le réseau, la plateforme ; un motif inconnu reste « non précisé »", () => {
    const view = toPageDecisionView(row({
      reason: "motif_inconnu",
      appeals: [{ appealId: "appeal-1", level: "network", status: "upheld", decisionReason: "Décision maintenue." }],
    }))
    expect(view.ground).toBe("unspecified")
    expect(view.appeals).toEqual([{ level: "network", status: "upheld", decisionReason: "Décision maintenue." }])
    expect(view.appealLevel).toBe("platform")
  })

  it("une décision classée sans suite ne se conteste pas ; un recours déjà posé ne se redouble pas", () => {
    expect(toPageDecisionView(row({ status: "dismissed" })).appealLevel).toBeNull()
    const pending = toPageDecisionView(row({ appeals: [{ appealId: "appeal-2", level: "network", status: "open", decisionReason: null }] }))
    expect(pending.appealLevel).toBeNull()
  })
})

/**
 * L'avis `moderation_decision` dans la cloche : la carte de la page porteuse n'est servie
 * par le moteur qu'au signataire vivant d'un dossier de page ; sans elle, « Mes données ».
 */
type Notice = Parameters<typeof toNotificationView>[0]

const decisionNotice = (page: Notice["page"]): Notice => ({
  notificationId: "notice-decision" as Id<"notifications">,
  kind: "moderation_decision", subject: { kind: "report", id: "report-1" },
  createdAt: 42, readAt: null, resolution: null, inviteState: null,
  fileScanStatus: null, actor: null, page,
}) as unknown as Notice

describe("avis de décision de modération dans la cloche DIASPORALE", () => {
  it("un dossier personnel mène à « Mes données » : aucune page, aucun acteur, aucun contenu", () => {
    expect(toNotificationView(decisionNotice(null))).toEqual({
      id: "notice-decision", kind: "moderation_decision", actor: null,
      createdAt: 42, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null,
      moderationDecision: { pageHandle: null },
    })
  })

  it("un dossier de page, lu par un signataire vivant, mène aux décisions de cette page", () => {
    const view = toNotificationView(decisionNotice({ handle: "collectif-demo", name: "Collectif démo" } as unknown as Notice["page"]))
    expect(view.kind).toBe("moderation_decision")
    expect(view.moderationDecision).toEqual({ pageHandle: "collectif-demo" })
  })
})
