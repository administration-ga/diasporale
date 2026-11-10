// @vitest-environment jsdom
import { COMMUNITY_RULES, LEGAL_TEXTS } from "@diasporale/domain"
import { DataSourceProvider, REPORT_REASON_RULES, REPORT_REASONS } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import CommunityRulesPage from "@/app/regles-communaute/page"
import { COMMUNITY_RULE_ANCHORS, routes } from "@/lib/routes"

/**
 * Les règles de la communauté (MD-05), page PUBLIQUE rendue avec sa vraie coque, pour une
 * personne sans compte (démonstration sans session) : texte provisoire marqué comme tel,
 * passages « À fournir » qui nomment la question posée au juriste, chaque motif de
 * signalement nommé sous une règle et une seule, une ancre par règle. Données fictives.
 */
const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => navigation }))
// Les métadonnées lisent la requête : hors sujet ici, seule la page est rendue.
vi.mock("@/i18n/server", () => ({ getAppT: vi.fn() }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

/** Le texte tel que Testing Library le lit dans le DOM (espaces insécables normalisées). */
const normalized = (value: string) => value.replace(/\s+/g, " ")

/** Une personne sans compte : magasin de démonstration neuf, aucune session ouverte. */
function renderSignedOut(locale: "fr" | "en" = "fr") {
  const store = new DemoStore(null, () => Date.UTC(2026, 10, 10, 12), 0)
  return render(
    <I18nProvider locale={locale}>
      <DataSourceProvider source={createDemoDataSource(store)}>
        <CommunityRulesPage />
      </DataSourceProvider>
    </I18nProvider>,
  )
}

describe("Règles de la communauté — une page qui se lit sans compte (MD-05)", () => {
  it("se rend dans la coque publique, sans session, avec son marqueur « provisoire » visible et fixe", () => {
    const t = getFixedT("fr")
    renderSignedOut()
    expect(screen.getByRole("heading", { level: 1, name: t("legal.community.title") })).toBeInTheDocument()
    // La coque publique propose d'entrer : personne n'est connecté.
    expect(screen.getAllByRole("link", { name: t("nav.enter") }).length).toBeGreaterThan(0)
    const marker = screen.getByRole("note")
    expect(marker).toHaveTextContent(normalized(t("legal.provisional.heading")))
    expect(marker).toHaveTextContent(normalized(t("legal.provisional.body")))
    // Distinct d'un texte à fournir : jamais le marqueur « TODO JURISTE ».
    expect(marker).not.toHaveTextContent(normalized(t("legal.todoLawyer")))
    expect(within(marker).queryByRole("button")).toBeNull()
  })

  it("rend chaque règle, sous son ancre, dans l'ordre du domaine", () => {
    const t = getFixedT("fr")
    renderSignedOut()
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(
      COMMUNITY_RULES.map((rule) => t(`legal.community.${rule}.title`)),
    )
    for (const rule of COMMUNITY_RULES) {
      const section = document.getElementById(COMMUNITY_RULE_ANCHORS[rule])
      expect(section, rule).not.toBeNull()
      expect(within(section!).getByRole("heading", { level: 2 })).toHaveTextContent(t(`legal.community.${rule}.title`))
      expect(routes.communityRule(rule)).toBe(`${routes.communityRules()}#${COMMUNITY_RULE_ANCHORS[rule]}`)
    }
    expect(new Set(Object.values(COMMUNITY_RULE_ANCHORS)).size).toBe(COMMUNITY_RULES.length)
  })

  it("chaque motif de signalement est nommé sous sa règle, et sous une seule", () => {
    const t = getFixedT("fr")
    renderSignedOut()
    const lists = screen.getAllByRole("list", { name: t("communityRules.reasonsLabel") })
    const named = lists.flatMap((list) => within(list).getAllByRole("listitem").map((item) => item.textContent))
    expect([...named].sort()).toEqual(REPORT_REASONS.map((reason) => t(`report.reason.${reason}`)).sort())
    for (const reason of REPORT_REASONS) {
      const section = document.getElementById(COMMUNITY_RULE_ANCHORS[REPORT_REASON_RULES[reason]])!
      expect(within(within(section).getByRole("list")).getByText(t(`report.reason.${reason}`)), reason).toBeInTheDocument()
    }
  })

  it("n'invente aucune règle de droit : chaque passage qui attend le juriste dit « À fournir » et nomme sa question", () => {
    const t = getFixedT("fr")
    renderSignedOut()
    const awaiting = Object.entries(LEGAL_TEXTS.community.awaiting)
    expect(awaiting.length).toBeGreaterThan(0)
    for (const [rule, questions] of awaiting) {
      const pending = t(`legal.community.${rule}.pending`)
      // Espace insécable avant les deux-points, comme le veut la typographie française.
      expect(pending, rule).toMatch(/^À fournir \(question Q\d au juriste\)\s: /)
      for (const question of questions) expect(pending, rule).toContain(question)
      expect(screen.getByText(normalized(pending))).toBeInTheDocument()
    }
    // Les autres passages sont rédigés : aucun « À fournir » dans le corps d'une règle.
    for (const rule of COMMUNITY_RULES) expect(t(`legal.community.${rule}.body`), rule).not.toMatch(/À fournir/)
  })

  it("parle anglais : titre, marqueur provisoire et passages « To be provided »", () => {
    const t = getFixedT("en")
    renderSignedOut("en")
    expect(screen.getByRole("heading", { level: 1, name: "Community rules" })).toBeInTheDocument()
    expect(screen.getByRole("note")).toHaveTextContent(normalized(t("legal.provisional.heading")))
    for (const [rule, questions] of Object.entries(LEGAL_TEXTS.community.awaiting)) {
      const pending = t(`legal.community.${rule}.pending`)
      expect(pending, rule).toMatch(/^To be provided \(question Q\d to the lawyer\): /)
      for (const question of questions) expect(pending, rule).toContain(question)
    }
    for (const rule of COMMUNITY_RULES) expect(t(`legal.community.${rule}.body`), rule).not.toMatch(/To be provided/)
  })
})
