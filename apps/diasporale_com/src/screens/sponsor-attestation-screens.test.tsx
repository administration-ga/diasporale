// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ActionResult, Loadable, MembershipView, SponsorDashboardView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { filledButtons } from "@/test-utils"

import { routes } from "@/lib/routes"

import { SponsorScreen, requestedSponsorHandle } from "./sponsor-attestation-screens"

const mocks = vi.hoisted(() => ({
  dashboard: { status: "loading" } as Loadable<SponsorDashboardView>,
  sponsor: vi.fn<(handle: string) => Promise<ActionResult>>(),
  revoke: vi.fn<(id: string) => Promise<ActionResult>>(),
  params: new URLSearchParams(),
}))

vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }))

vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: MembershipView }) => ReactNode }) => <>{props.children({ membership: MEMBER })}</>,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: (props: { children: ReactNode }) => <>{props.children}</> }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useSponsorDashboard: () => mocks.dashboard,
  useActions: () => ({ sponsor: mocks.sponsor, revokeSponsorship: mocks.revoke }),
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const t = getFixedT("fr")
const NOW = Date.UTC(2026, 10, 10, 9)
const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "verifiee", badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: 1, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "verifiee", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}
const DASHBOARD: SponsorDashboardView = {
  eligible: true,
  refusal: null,
  remaining: 2,
  windowDays: 30,
  seniorityReachedAt: null,
  given: [{ id: "sponsorship-1", sponsored: { handle: "eloise.ndong", displayName: "Éloïse NDONG MBA" }, createdAt: NOW, revokedAt: null }],
}

beforeEach(() => {
  mocks.dashboard = { status: "ready", data: DASHBOARD }
  mocks.params = new URLSearchParams()
  mocks.sponsor.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.revoke.mockReset().mockResolvedValue({ ok: true, value: null })
})

afterEach(cleanup)

describe("/parrainer — DS-02 : « Parrainer » en famille sociale", () => {
  it("admettre une personne dans le réseau est un geste de relation : un seul bouton plein, de la famille sociale", () => {
    render(<I18nProvider locale="fr"><SponsorScreen /></I18nProvider>)

    const submit = screen.getByRole("button", { name: t("sponsor.submit") })
    expect(submit).toHaveClass("bg-social-fill")
    // Le formulaire et le journal des parrainages donnés : « Retirer » reste un geste discret.
    expect(filledButtons(document.body)).toEqual([submit])
    expect(screen.getByRole("button", { name: t("sponsor.revoke") })).not.toHaveClass("bg-social-fill")
  })

  it("quota épuisé : le geste, fermé, garde sa famille", () => {
    mocks.dashboard = { status: "ready", data: { ...DASHBOARD, remaining: 0 } }
    render(<I18nProvider locale="fr"><SponsorScreen /></I18nProvider>)

    const submit = screen.getByRole("button", { name: t("sponsor.submit") })
    expect(submit).toBeDisabled()
    expect(submit).toHaveClass("bg-social-fill")
  })
})

/** L'adresse d'une demande de parrainage, telle que le lien la porte (EA-10). */
function openedFrom(href: string) {
  mocks.params = new URLSearchParams(href.split("?")[1] ?? "")
}

describe("/parrainer — demande de parrainage reçue par lien (EA-10)", () => {
  it("le formulaire est prérempli par l'identifiant du lien et demande « je connais cette personne », jamais cochée d'avance", async () => {
    openedFrom(routes.sponsorFor("eloise.ndong"))
    const user = userEvent.setup()
    render(<I18nProvider locale="fr"><SponsorScreen /></I18nProvider>)

    expect(screen.getByRole("textbox", { name: t("sponsor.handleLabel") })).toHaveValue("eloise.ndong")
    expect(screen.getByText(t("sponsorRequest.prefilled"))).toBeInTheDocument()
    const knows = screen.getByRole("checkbox", { name: t("sponsorRequest.knows") })
    expect(knows).not.toBeChecked()

    // Sans la case, rien ne part.
    await user.click(screen.getByRole("button", { name: t("sponsor.submit") }))
    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.sponsor_acquaintance_required").replace(/\s+/g, " "))
    expect(mocks.sponsor).not.toHaveBeenCalled()

    await user.click(knows)
    await user.click(screen.getByRole("button", { name: t("sponsor.submit") }))
    await waitFor(() => expect(mocks.sponsor).toHaveBeenCalledExactlyOnceWith("eloise.ndong"))
    // Un seul bouton plein, même avec la case.
    expect(filledButtons(document.body)).toEqual([screen.getByRole("button", { name: t("sponsor.submit") })])
  })

  it("lien ouvert par un membre non éligible : son propre refus, rien sur la personne visée", () => {
    openedFrom(routes.sponsorFor("cible.secrete"))
    mocks.dashboard = { status: "ready", data: { ...DASHBOARD, eligible: false, refusal: "sponsor_not_verified", remaining: 10, given: [] } }
    render(<I18nProvider locale="fr"><SponsorScreen /></I18nProvider>)

    expect(screen.getByText(t("errors.sponsor_not_verified"))).toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain("cible.secrete")
    expect(mocks.sponsor).not.toHaveBeenCalled()
  })

  it("un identifiant hors charte n'est pas prérempli", () => {
    expect(requestedSponsorHandle(null)).toBeNull()
    expect(requestedSponsorHandle("@Eloise.Ndong")).toBe("eloise.ndong")
    for (const raw of ["", "a", "x".repeat(200), "eloise ndong", "<script>", "eloise/../ndong"]) {
      expect(requestedSponsorHandle(raw), raw).toBeNull()
    }
    openedFrom("/parrainer?pour=%3Cscript%3E")
    render(<I18nProvider locale="fr"><SponsorScreen /></I18nProvider>)
    expect(screen.getByRole("textbox", { name: t("sponsor.handleLabel") })).toHaveValue("")
    expect(screen.queryByText(t("sponsorRequest.prefilled"))).not.toBeInTheDocument()
  })
})
