// @vitest-environment jsdom
import type { ModerationDecisionView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { CommunityRuleLink } from "./community-rule-link"
import { DecisionItem } from "./moderation-decisions"

/**
 * Le lien vers la règle que vise un motif (MD-05) : seul, puis dans la fiche d'une décision
 * (« Mes données », décisions d'une page). Données fictives.
 */
afterEach(cleanup)

const t = getFixedT("fr")
const tree = (children: ReactNode, locale: "fr" | "en" = "fr") => <I18nProvider locale={locale}>{children}</I18nProvider>

const DECISION: ModerationDecisionView = {
  reportId: "report-fixture",
  network: "diasporale",
  surface: "post",
  ground: "privacy_or_honor",
  status: "actioned",
  level: "team",
  createdAt: Date.UTC(2026, 10, 1, 12),
  decisionReason: "Coordonnées d'une autre personne publiées (fixture).",
  sanctions: [{ kind: "removal", status: "active", until: null, reason: "Coordonnées d'une autre personne publiées (fixture)." }],
  appeals: [],
  appealLevel: "network",
}

describe("CommunityRuleLink — la règle que vise un motif", () => {
  it("mène à l'ancre de la règle et la nomme", () => {
    render(tree(<CommunityRuleLink ground="harassment" />))
    const link = screen.getByRole("link", { name: t("communityRules.readRule", { rule: t("legal.community.respect.title") }) })
    expect(link).toHaveAttribute("href", routes.communityRule("respect"))
    expect(link).toHaveAttribute("href", "/regles-communaute#respect")
  })

  it("un motif d'avis mène à sa règle ; la relecture avant publication, aux mesures", () => {
    render(tree(<><CommunityRuleLink ground="fraud" /><CommunityRuleLink ground="pre_review" /></>))
    expect(screen.getByRole("link", { name: t("communityRules.readRule", { rule: t("legal.community.scams.title") }) })).toHaveAttribute("href", routes.communityRule("scams"))
    expect(screen.getByRole("link", { name: t("communityRules.readRule", { rule: t("legal.community.measures.title") }) })).toHaveAttribute("href", routes.communityRule("measures"))
  })

  it("sans motif, ou motif non précisé : la page entière, jamais une règle devinée", () => {
    render(tree(<><CommunityRuleLink /><CommunityRuleLink ground="unspecified" /></>))
    const links = screen.getAllByRole("link", { name: t("communityRules.read") })
    expect(links.map((link) => link.getAttribute("href"))).toEqual([routes.communityRules(), routes.communityRules()])
  })

  it("parle anglais", () => {
    const en = getFixedT("en")
    render(tree(<CommunityRuleLink ground="impersonation" />, "en"))
    expect(screen.getByRole("link", { name: en("communityRules.readRule", { rule: en("legal.community.impersonation.title") }) })).toHaveAttribute("href", routes.communityRule("impersonation"))
  })
})

describe("Fiche d'une décision — elle renvoie à la règle visée (MD-05)", () => {
  it("porte, sous le motif, le lien vers sa règle sur la page publique des règles", () => {
    render(tree(<ul><DecisionItem decision={DECISION} appeal={vi.fn()} /></ul>))
    // La fiche, puis la liste de ses mesures.
    const item = screen.getAllByRole("listitem")[0]!
    // Le texte tel que Testing Library le lit (espaces insécables ramenées à l'espace simple).
    expect(item).toHaveTextContent(t("settings.dataRights.decisions.ground", { ground: t("report.reason.privacy_or_honor") }).replace(/\s+/g, " "))
    expect(within(item).getByRole("link", { name: t("communityRules.readRule", { rule: t("legal.community.privacy.title") }) })).toHaveAttribute(
      "href",
      routes.communityRule("privacy"),
    )
  })
})
