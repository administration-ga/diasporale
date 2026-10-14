import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { renderWithI18n } from "../test-utils"
import { CountrySwitch } from "./country-switch"
import { CountryTag, ScopeTag } from "./country-tag"
import { MembershipStatusBanner } from "./membership-status-banner"
import { ModerationBanner } from "./moderation-banner"
import { TrustBadge } from "./trust-badge"

describe("CountryTag — l'étiquette pays", () => {
  it("annonce le nom du pays, garde le code ISO décoratif, montre la ville", () => {
    const { container } = renderWithI18n(<CountryTag country="FR" city="Lyon" />)
    const tag = container.querySelector('[data-slot="country-tag"]')
    expect(tag).toHaveTextContent("France")
    expect(screen.getByText("Lyon")).toBeVisible()
    expect(screen.getByText("FR")).toHaveAttribute("aria-hidden", "true")
  })

  it("nomme le pays dans la langue de la personne", () => {
    renderWithI18n(<CountryTag country="DE" />, "en")
    expect(screen.getAllByText("Germany").length).toBeGreaterThan(0)
  })

  it("la portée diaspora se lit « Toute la diaspora »", () => {
    renderWithI18n(<ScopeTag />)
    expect(screen.getByText("Toute la diaspora")).toBeInTheDocument()
  })
})

describe("TrustBadge — les quatre badges de confiance", () => {
  it.each([
    ["official", "Officiel"],
    ["verified", "Vérifié"],
    ["public_agent", "Agent public"],
    ["community", "Communauté"],
  ] as const)("%s porte un libellé et une explication, jamais la seule couleur", (badge, label) => {
    const { container } = renderWithI18n(<TrustBadge badge={badge} />)
    const node = container.querySelector(`[data-badge="${badge}"]`)
    expect(node).toHaveTextContent(label)
    expect(node?.getAttribute("title")?.length).toBeGreaterThan(10)
    expect(node?.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })
})

describe("MembershipStatusBanner — la bannière de statut", () => {
  const actions = {
    verifyConsular: <a href="/verification">vérifier</a>,
    sponsorHelp: <a href="/parametres#parrainage">parrainage</a>,
    activateIdn: <a href="https://idn.example">idn</a>,
  }

  it("en attente : lecture seule, et les deux chemins pour publier", () => {
    renderWithI18n(<MembershipStatusBanner status="en_attente" badges={["community"]} actions={actions} />)
    expect(screen.getByText("Votre compte est en attente.")).toBeInTheDocument()
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["vérifier", "parrainage"])
  })

  it("déclarée sans badge Vérifié : le parcours d'élévation, seulement les liens fournis", () => {
    renderWithI18n(<MembershipStatusBanner status="declaree" badges={["community"]} actions={actions} />)
    expect(screen.getByText("Votre compte est déclaré.")).toBeInTheDocument()
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["idn", "vérifier"])
  })

  it("déclarée avec le badge Vérifié : ne propose plus que l'inscription consulaire", () => {
    renderWithI18n(<MembershipStatusBanner status="declaree" badges={["verified"]} actions={actions} />)
    expect(screen.getByText("Votre identité est vérifiée.")).toBeInTheDocument()
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["vérifier"])
  })

  it("suspendue : la sanction et sa date, rien d'autre", () => {
    renderWithI18n(<MembershipStatusBanner status="suspendue" badges={[]} suspendedUntil="20 octobre" actions={actions} />)
    expect(screen.getByText("Votre compte est suspendu.")).toBeInTheDocument()
    expect(screen.getByText(/Jusqu'au 20 octobre|Jusqu'au 20 octobre/)).toBeInTheDocument()
    expect(screen.queryAllByRole("link")).toEqual([])
  })

  it("partie : aucune bannière", () => {
    const { container } = renderWithI18n(<MembershipStatusBanner status="partie" badges={[]} />)
    expect(container.querySelector('[data-slot="membership-status-banner"]')).toBeNull()
  })
})

describe("ModerationBanner — montré à l'auteur", () => {
  it("en relecture : le statut et ce qu'il implique", () => {
    renderWithI18n(<ModerationBanner state="pending_review" />)
    expect(screen.getByRole("status")).toHaveTextContent("En relecture.")
    expect(screen.getByRole("status")).toHaveTextContent("Visible par vous seulement")
  })

  it("refusé : le motif", () => {
    renderWithI18n(<ModerationBanner state="rejected" reason="contenu commercial" />)
    expect(screen.getByRole("status")).toHaveTextContent("contenu commercial")
  })
})

describe("CountrySwitch — le sélecteur de pays", () => {
  function setup(value: "FR" | null = null) {
    const onChange = vi.fn()
    renderWithI18n(
      <CountrySwitch value={value} onChange={onChange} openCountries={["FR"]} title="Votre pays de résidence" description="Cherchez par nom ou par code." />,
    )
    return { onChange, user: userEvent.setup() }
  }

  it("s'ouvre sur sa recherche, filtre sans accents, et ne propose jamais le Gabon", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("combobox"))
    const search = screen.getByRole("searchbox", { name: "Rechercher un pays" })
    expect(search).toHaveFocus()
    await user.type(search, "gab")
    expect(screen.getByText("Aucun pays ne correspond à votre recherche.")).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, "etats")
    expect(screen.getByText("États-Unis")).toBeInTheDocument()
  })

  it("marque les pays ouverts et rend le code choisi", async () => {
    const { user, onChange } = setup()
    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByRole("searchbox"), "France")
    const dialog = screen.getByRole("dialog")
    const france = within(dialog).getByRole("button", { name: /France/ })
    expect(france).toHaveTextContent("Ouvert")
    await user.click(france)
    expect(onChange).toHaveBeenCalledWith("FR")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("annonce son état : ouvert, invalide", async () => {
    const onChange = vi.fn()
    renderWithI18n(<CountrySwitch value={null} onChange={onChange} openCountries={[]} title="t" description="d" invalid />)
    const trigger = screen.getByRole("combobox")
    expect(trigger).toHaveAttribute("aria-invalid", "true")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.setup().click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })
})
