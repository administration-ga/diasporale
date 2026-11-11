// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY, type OnboardingConsentChoices } from "@diasporale/domain"
import { DataSourceProvider, type MembershipView } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SPONSOR_REQUEST_PARAM, routes } from "@/lib/routes"
import { SponsorScreen } from "@/screens/sponsor-attestation-screens"
import { filledButtons } from "@/test-utils"

import { PendingRoom } from "./pending-room"

const mocks = vi.hoisted(() => ({ params: new URLSearchParams(), success: vi.fn() }))
vi.mock("next/navigation", () => ({ useSearchParams: () => mocks.params }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: vi.fn() } }))
// L'écran « Parrainer » sans sa garde ni sa coque : la session et les données viennent de la démonstration.
vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: MembershipView }) => ReactNode }) => <>{props.children({ membership: PENDING })}</>,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: (props: { children: ReactNode }) => <>{props.children}</> }))

const t = getFixedT("fr")
const PENDING: MembershipView = {
  personId: "person-attente", handle: "nouvelle.venue", displayName: "Nouvelle VENUE", status: "en_attente", badges: [],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: false, rateTier: "none", directoryVisibility: "hidden",
}

beforeEach(() => {
  mocks.params = new URLSearchParams()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  // La feuille de partage simulée ne survit pas à son essai.
  Reflect.deleteProperty(window.navigator, "share")
})

function renderRoom(membership: MembershipView = PENDING) {
  return render(<I18nProvider locale="fr"><PendingRoom membership={membership} /></I18nProvider>)
}

describe("Salle d'attente d'un compte en attente (EA-10)", () => {
  it("le lien de demande ne porte que l'identifiant public, sur l'adresse de « Parrainer »", () => {
    renderRoom()
    const link = screen.getByRole("textbox", { name: t("pendingRoom.linkLabel") })
    const url = new URL((link as HTMLInputElement).value)

    expect(url.origin).toBe(window.location.origin)
    expect(`${url.pathname}${url.search}`).toBe(routes.sponsorFor("nouvelle.venue"))
    expect([...url.searchParams.keys()]).toEqual([SPONSOR_REQUEST_PARAM])
    expect(url.hash).toBe("")
    // Ni adresse, ni nom, ni identifiant interne : rien d'autre que l'identifiant public.
    expect(url.href).not.toContain("person-attente")
    expect(url.href).not.toContain("VENUE")
    expect(link).toHaveAccessibleDescription(t("pendingRoom.linkPrivacy", { handle: "nouvelle.venue" }))
  })

  it("dit les chemins ouverts aujourd'hui : le parrainage et la vérification consulaire, pas IDN", () => {
    renderRoom()
    expect(screen.getByText(t("pendingRoom.sponsorTitle"))).toBeInTheDocument()
    expect(screen.getByRole("link", { name: t("status.verifyConsular") })).toHaveAttribute("href", routes.attestation())
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(document.body.textContent).not.toMatch(/IDN/)
  })

  it("le code QR porte le même lien, dessiné sur l'appareil", () => {
    renderRoom()
    const link = (screen.getByRole("textbox", { name: t("pendingRoom.linkLabel") }) as HTMLInputElement).value
    const qr = screen.getByTitle(t("pendingRoom.qrTitle"))
    expect(qr.closest("svg")).not.toBeNull()
    expect(link).toContain(routes.sponsorFor("nouvelle.venue"))
  })

  it("copie le lien ; un seul bouton plein, de la famille sociale ; sans feuille de partage, pas de bouton « Partager »", async () => {
    // Le presse-papiers simulé de user-event : le texte copié se relit.
    const user = userEvent.setup()
    renderRoom()
    const copy = screen.getByRole("button", { name: t("pendingRoom.copy") })
    expect(filledButtons(document.body)).toEqual([copy])
    expect(copy).toHaveClass("bg-social-fill")
    expect(screen.queryByRole("button", { name: t("pendingRoom.share") })).not.toBeInTheDocument()

    await user.click(copy)
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(t("pendingRoom.copied")))
    expect(await navigator.clipboard.readText()).toBe(new URL(routes.sponsorFor("nouvelle.venue"), window.location.origin).href)
  })

  it("partage par la feuille du système quand le navigateur l'offre ; la refermer n'est pas un échec", async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>().mockRejectedValueOnce(new DOMException("fermée", "AbortError")).mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, "share", { value: share, configurable: true, writable: true })
    const user = userEvent.setup()
    renderRoom()
    const button = await screen.findByRole("button", { name: t("pendingRoom.share") })
    expect(filledButtons(document.body)).toEqual([screen.getByRole("button", { name: t("pendingRoom.copy") })])

    await user.click(button)
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    await user.click(button)
    await waitFor(() => expect(share).toHaveBeenCalledTimes(2))
    expect(share).toHaveBeenLastCalledWith({ title: t("pendingRoom.shareTitle"), url: new URL(routes.sponsorFor("nouvelle.venue"), window.location.origin).href })
  })
})

describe("Parrainage obtenu par le lien, à deux comptes, sans saisie (EA-10)", () => {
  const NOW = Date.UTC(2026, 10, 10, 12)
  const CONSENTS: OnboardingConsentChoices = { social_profile: true, directory: false, notifications: false }

  it("le compte en attente envoie son lien ; un membre vérifié l'ouvre, coche la case et parraine", async () => {
    const store = new DemoStore(null, () => NOW, 0)
    const sent = await store.requestCode({ kind: "email", value: "nouvelle.venue@example.com" })
    if (!sent.ok || sent.value.demoCode === null) throw new Error("code de démonstration attendu")
    await store.verifyCode(sent.value.demoCode)
    const joined = await store.join({ facet: { countryOfResidence: "FR" }, handle: "nouvelle.venue", displayName: "Nouvelle Venue", consents: CONSENTS, directoryVisibility: "hidden" })
    const newcomer = store.getState().session.personId ?? ""
    expect(joined.ok && joined.value.status).toBe("en_attente")

    // 1. La salle d'attente donne le lien.
    renderRoom({ ...PENDING, personId: newcomer })
    const href = (screen.getByRole("textbox", { name: t("pendingRoom.linkLabel") }) as HTMLInputElement).value
    cleanup()

    // 2. Un membre vérifié depuis plus de 30 jours ouvre le lien : rien à saisir, une case à cocher.
    await store.switchTo("p-mireille")
    mocks.params = new URL(href).searchParams
    const user = userEvent.setup()
    render(
      <I18nProvider locale="fr">
        <DataSourceProvider source={createDemoDataSource(store)}>
          <SponsorScreen />
        </DataSourceProvider>
      </I18nProvider>,
    )
    expect(await screen.findByRole("textbox", { name: t("sponsor.handleLabel") })).toHaveValue("nouvelle.venue")
    await user.click(screen.getByRole("checkbox", { name: t("sponsorRequest.knows") }))
    await user.click(screen.getByRole("button", { name: t("sponsor.submit") }))

    await waitFor(() => expect(store.statusOf(newcomer)).toBe("declaree"))
  })
})
