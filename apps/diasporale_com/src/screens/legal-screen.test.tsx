// @vitest-environment jsdom
import { LEGAL_TEXT_KINDS, LEGAL_TEXTS, type LegalTextKind } from "@diasporale/domain"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import CommunityRulesPage from "@/app/regles-communaute/page"
import ContactPage from "@/app/contact/page"
import PrivacyPage from "@/app/confidentialite/page"
import LegalNoticePage from "@/app/mentions-legales/page"
import TermsPage from "@/app/conditions-utilisation/page"
import { formatLegalTextDate } from "@/lib/legal-texts"
import { routes } from "@/lib/routes"

import { LegalScreen } from "./legal-screen"

// La coque publique (en-tête, pied de page) a ses propres tests : ici, le texte seul.
vi.mock("@/components/site-chrome", () => ({ PublicShell: (props: { children: ReactNode }) => <main>{props.children}</main> }))
// Les métadonnées lisent la requête : hors sujet ici, seule la page est rendue.
vi.mock("@/i18n/server", () => ({ getAppT: vi.fn() }))

afterEach(cleanup)

/** Le texte tel que Testing Library le lit dans le DOM (espaces insécables normalisées). */
const normalized = (value: string) => value.replace(/\s+/g, " ")

function renderText(kind: LegalTextKind, locale: "fr" | "en" = "fr") {
  return render(<I18nProvider locale={locale}><LegalScreen kind={kind} /></I18nProvider>)
}

describe("Textes du site — chaque page dit sa version, sa date et son marqueur (LX-05)", () => {
  it.each(LEGAL_TEXT_KINDS)("« %s » : titre, version et date du domaine, marqueur bloquant, toutes ses rubriques", (kind) => {
    const t = getFixedT("fr")
    const edition = LEGAL_TEXTS[kind]
    renderText(kind)
    expect(screen.getByRole("heading", { level: 1, name: t(`legal.${kind}.title`) })).toBeInTheDocument()
    expect(screen.getByText(normalized(t("legal.edition", { version: edition.version, date: formatLegalTextDate(edition.date, "fr") })))).toBeInTheDocument()
    // Aucun texte n'est fourni : le marqueur est visible et ne se ferme pas.
    const marker = screen.getByRole("note")
    expect(marker).toHaveTextContent(normalized(t("legal.todoLawyer")))
    expect(within(marker).queryByRole("button")).toBeNull()
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual(
      edition.sections.map((section) => t(`legal.${kind}.${section}.title`)),
    )
    for (const section of edition.sections) expect(screen.getByText(normalized(t(`legal.${kind}.${section}.body`)))).toBeInTheDocument()
  })

  it.each(["terms", "community"] as const)("« %s » n'invente aucun contenu : chaque rubrique dit ce qui reste à fournir", (kind) => {
    const t = getFixedT("fr")
    for (const section of LEGAL_TEXTS[kind].sections) expect(t(`legal.${kind}.${section}.body`)).toMatch(/^À fournir : /)
    const en = getFixedT("en")
    for (const section of LEGAL_TEXTS[kind].sections) expect(en(`legal.${kind}.${section}.body`)).toMatch(/^To be provided: /)
  })

  it("le contact dit ce qui existe aujourd'hui, renvoie à « Mes données » et garde le marqueur pour l'adresse de l'éditeur", () => {
    const t = getFixedT("fr")
    renderText("contact")
    expect(screen.getByRole("link", { name: t("footer.myData") })).toHaveAttribute("href", routes.myData())
    expect(screen.getAllByRole("link")).toHaveLength(1)
    expect(t("legal.contact.publisher.body")).toMatch(/^À fournir/)
    expect(t("legal.contact.dataProtection.body")).toMatch(/^À fournir/)
    expect(t("legal.contact.report.body")).not.toMatch(/^À fournir/)
    expect(t("legal.contact.messages.body")).not.toMatch(/^À fournir/)
    expect(screen.getByRole("note")).toBeInTheDocument()
  })

  it("parle anglais : titre, version et date dans la langue de la personne", () => {
    const t = getFixedT("en")
    const edition = LEGAL_TEXTS.terms
    renderText("terms", "en")
    expect(screen.getByRole("heading", { level: 1, name: "Terms of use" })).toBeInTheDocument()
    expect(screen.getByText(t("legal.edition", { version: edition.version, date: formatLegalTextDate(edition.date, "en") }))).toBeInTheDocument()
    expect(screen.getByRole("note")).toHaveTextContent(normalized(t("legal.todoLawyer")))
  })

  it("une date civile ne recule pas d'un jour selon le fuseau", () => {
    expect(formatLegalTextDate("2026-11-10", "fr")).toBe("10 novembre 2026")
    expect(formatLegalTextDate("2026-10-14", "en")).toBe("October 14, 2026")
  })
})

describe("Textes du site — une page par texte, branchée sur sa route", () => {
  it.each([
    ["mentions légales", LegalNoticePage, "notice"],
    ["confidentialité", PrivacyPage, "privacy"],
    ["conditions d'utilisation", TermsPage, "terms"],
    ["règles de la communauté", CommunityRulesPage, "community"],
    ["contact", ContactPage, "contact"],
  ] as const)("la page des %s rend son texte", (_label, Page, kind) => {
    const t = getFixedT("fr")
    render(<I18nProvider locale="fr"><Page /></I18nProvider>)
    expect(screen.getByRole("heading", { level: 1, name: t(`legal.${kind}.title`) })).toBeInTheDocument()
  })

  it("chaque nouveau texte a sa propre adresse dans la table des routes", () => {
    expect([routes.terms(), routes.communityRules(), routes.contact()]).toEqual(["/conditions-utilisation", "/regles-communaute", "/contact"])
  })
})
