// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ActionResult, Loadable, MembershipView, SponsorDashboardView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { filledButtons } from "@/test-utils"

import { SponsorScreen } from "./sponsor-attestation-screens"

const mocks = vi.hoisted(() => ({
  dashboard: { status: "loading" } as Loadable<SponsorDashboardView>,
  sponsor: vi.fn<(handle: string) => Promise<ActionResult>>(),
  revoke: vi.fn<(id: string) => Promise<ActionResult>>(),
}))

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
