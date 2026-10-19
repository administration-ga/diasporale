// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ActionResult, MembershipView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { SettingsScreen } from "./settings-screen"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  leave: vi.fn<() => Promise<ActionResult>>(),
  consent: vi.fn(),
  push: vi.fn(),
  publication: vi.fn(),
  dataRights: vi.fn(),
  replace: vi.fn(),
  session: { status: "loading" } as unknown,
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...(await original<typeof import("@diasporale/features/data")>()),
  useActions: () => ({ leaveDiasporale: mocks.leave, setConsent: mocks.consent }),
  useMyConsents: () => ({ status: "ready", data: [] }),
  useOpenCountries: () => ({ status: "ready", data: [] }),
  useSession: () => mocks.session,
}))
vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: MembershipView | null }) => ReactNode }) => props.children({ membership: mocks.membership }),
}))
vi.mock("@/components/app-shell", () => ({ AppShell: (props: { children: ReactNode }) => props.children }))
vi.mock("@/components/profile-images-settings", () => ({ ProfileImagesSettings: () => null }))
vi.mock("@/components/profile-publication-settings", () => ({
  ProfilePublicationSettings: (props: { membership: MembershipView }) => {
    mocks.publication(props.membership)
    return <section aria-label="Profil commun" />
  },
}))
vi.mock("@/components/sign-out-settings", () => ({ SignOutSettings: () => null }))
// Sections branchées sur leur propre capacité, éprouvées par leurs tests : ici, seulement leur montage.
vi.mock("@/components/content-preferences-settings", () => ({ ContentPreferencesSettings: () => null }))
vi.mock("@/components/data-rights-settings", () => ({
  DataRightsSettings: (props: { membership: MembershipView }) => {
    mocks.dataRights(props.membership)
    return <section id="mes-donnees" aria-label="Mes données" />
  },
}))
vi.mock("@/components/preferences", () => ({ LanguageSwitch: () => null, ThemeSwitch: () => null }))

const t = getFixedT("fr")
const membership: MembershipView = {
  personId: "person_lecture",
  handle: "lecture.demo",
  displayName: "Lecteur fictif",
  status: "en_attente",
  badges: [],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: null,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "en_attente", derivedFrom: "diasporale" },
  canPublish: false,
  rateTier: "reinforced",
  directoryVisibility: "hidden",
}
const tree = () => <I18nProvider locale="fr"><SettingsScreen /></I18nProvider>

beforeEach(() => {
  vi.clearAllMocks()
  mocks.membership = membership
  mocks.leave.mockResolvedValue({ ok: true, value: null })
})
afterEach(cleanup)

describe("Réglages — profil commun et départ distinct", () => {
  it("monte les réglages personnels même pour un membre en attente", () => {
    render(tree())
    expect(mocks.publication).toHaveBeenLastCalledWith(membership)
    expect(screen.getByRole("region", { name: "Profil commun" })).toBeInTheDocument()
  })

  it("ne quitte qu'après confirmation et ne révoque pas le consentement global", async () => {
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("settings.leave") }))
    expect(mocks.leave).not.toHaveBeenCalled()
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("button", { name: t("common.cancel") }))
    expect(mocks.leave).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: t("settings.leave") }))
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("settings.leave") })) })
    expect(mocks.leave).toHaveBeenCalledTimes(1)
    expect(mocks.consent).not.toHaveBeenCalled()
    expect(mocks.push).toHaveBeenCalledWith("/bienvenue")
  })

  it("n'annonce pas un départ si le moteur le refuse", async () => {
    mocks.leave.mockResolvedValue({ ok: false, code: "rate_limited" })
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("settings.leave") }))
    await act(async () => { fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("settings.leave") })) })
    expect(mocks.error).toHaveBeenCalledWith(t("errors.rate_limited"))
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
  })

  it.each([true, false])("ignore une réponse de départ tardive après changement de personne (succès %s)", async (success) => {
    let settle!: (result: ActionResult) => void
    mocks.leave.mockReturnValueOnce(new Promise((resolve) => { settle = resolve }))
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("settings.leave") }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: t("settings.leave") }))
    expect(mocks.leave).toHaveBeenCalledOnce()
    mocks.membership = { ...membership, personId: "nouvelle-personne", handle: "nouveau.demo" }
    view.rerender(tree())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await act(async () => { settle(success ? { ok: true, value: null } : { ok: false, code: "rate_limited" }) })
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
    expect(mocks.publication).toHaveBeenLastCalledWith(mocks.membership)
  })
})

describe("Réglages — « Mes données » (DG-026)", () => {
  const suspended: MembershipView = { ...membership, status: "suspendue", canPublish: false, root: { ...membership.root, status: "suspendue" } }

  it("monte la section des droits pour la personne affichée, à la place de l'ancien export immédiat", () => {
    render(tree())
    expect(mocks.dataRights).toHaveBeenLastCalledWith(membership)
    expect(screen.getByRole("region", { name: "Mes données" })).toHaveAttribute("id", "mes-donnees")
    expect(screen.queryByRole("button", { name: t("settings.export") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("settings.delete") })).not.toBeInTheDocument()
  })

  it("la garde de Réglages admet un membre suspendu, sans le renvoyer ailleurs, et la section reste montée", async () => {
    const { Gate } = await vi.importActual<typeof import("@/components/gate")>("@/components/gate")
    mocks.session = { status: "ready", data: { status: "signed_in", account: {}, membership: suspended } }
    render(<Gate require="member">{(session) => <p data-testid="admis">{session.membership?.personId}</p>}</Gate>)
    expect(screen.getByTestId("admis")).toHaveTextContent(suspended.personId)
    expect(mocks.replace).not.toHaveBeenCalled()
    cleanup()
    mocks.membership = suspended
    render(tree())
    expect(mocks.dataRights).toHaveBeenLastCalledWith(suspended)
  })
})
