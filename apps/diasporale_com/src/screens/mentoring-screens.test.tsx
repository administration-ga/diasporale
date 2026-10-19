// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type {
  ActionResult,
  Loadable,
  MembershipView,
  MentorCardView,
  MentorDetailView,
  MentoringCapability,
  MentoringRequestDetailView,
  MentoringRequestsPageQuery,
  MentoringRequestSummaryView,
  MentorsPageQuery,
  MyMentorProfileView,
} from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { mentoringCountryOf, MentoringScreen, MentorProfileScreen, MyMentoringScreen } from "./mentoring-screens"

const mocks = vi.hoisted(() => ({
  capability: null as unknown,
  membership: null as unknown,
  params: new URLSearchParams(),
  replace: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ replace: mocks.replace, push: mocks.replace }),
  usePathname: () => "/mentorat",
}))
vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: unknown }) => ReactNode }) => <>{props.children({ membership: mocks.membership })}</>,
  GateSkeleton: () => null,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useMentoring: () => mocks.capability,
  // CC-6 : sans fournisseur de conversations, l'entrée « Écrire » ne s'affiche pas (testée à part).
  useConversations: () => null,
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NOW = Date.UTC(2026, 9, 18, 10)
const PRESENTATION = "J’aide les nouveaux venus à trouver un logement et à faire leurs démarches."

const MEMBER: MembershipView = {
  personId: "person-awa", handle: "awa", displayName: "Awa OGOOUÉ", status: "declaree", badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}

const CARD: MentorCardView = {
  mentorId: "mentor-1", personId: "person-mireille", displayName: "Mireille IVINDO", handle: "mireille", badges: ["verified"], country: "FR",
  city: "Paris", arrivedAt: null, domains: ["housing", "admin"], languages: ["fr"], acceptsRequests: true,
}
const FULL_CARD: MentorCardView = { ...CARD, mentorId: "mentor-2", personId: "person-nadia", displayName: "Nadia MPASSA", acceptsRequests: false }
const DETAIL: MentorDetailView = { ...CARD, presentation: PRESENTATION, availability: "Le soir en semaine", state: "active", isSelf: false, viewerRequest: null }
const MY_PROFILE: MyMentorProfileView = {
  mentorId: "mentor-self", state: "active", domains: ["studies"], presentation: PRESENTATION, languages: ["fr"], country: "FR", city: "Bordeaux",
  availability: "Le mercredi après-midi", maxActiveMentees: 3, activeMentees: 1, pendingRequests: 2, version: 4, optedInAt: NOW - DAY, updatedAt: NOW - DAY,
}
const SENT: MentoringRequestSummaryView = {
  requestId: "request-1", status: "sent", viewerRole: "mentee", mentorId: "mentor-1", counterpart: { displayName: "Mireille IVINDO", handle: "mireille" },
  domain: "housing", goal: "Trouver un logement étudiant", wishedSlots: [], timeZone: "Europe/Paris", slot: null, deadlineAt: NOW + 14 * DAY, createdAt: NOW, updatedAt: NOW,
}
const WISHED = { startAt: NOW + DAY, endAt: NOW + DAY + HOUR }
const RECEIVED: MentoringRequestSummaryView = {
  ...SENT, requestId: "request-2", viewerRole: "mentor", counterpart: { displayName: "Steeve NGOUNIÉ", handle: "steeve" },
  goal: "Préparer mon arrivée à Paris", wishedSlots: [WISHED],
}
const SENT_DETAIL: MentoringRequestDetailView = {
  ...SENT, message: "Je viens d’arriver et je cherche des conseils pour me loger.", slotVersion: 0, acceptedAt: null, closedBy: null, closedReason: null, closedAt: null, actions: ["cancel"],
}
const RECEIVED_DETAIL: MentoringRequestDetailView = { ...RECEIVED, message: "Je m’installe le mois prochain et je cherche des repères.", slotVersion: 0, acceptedAt: null, closedBy: null, closedReason: null, closedAt: null, actions: ["accept", "decline"] }

const LOADING = { status: "loading" } as const
const done = <T,>(value: T): Promise<ActionResult<T>> => Promise.resolve({ ok: true, value })

function page<Row>(items: readonly Row[]): Loadable<{ readonly items: readonly Row[]; readonly continueCursor: string | null; readonly isDone: boolean }> {
  return { status: "ready", data: { items, continueCursor: null, isDone: true } }
}

/** Une capacité factice : chaque lecture rend la MÊME référence tant que la fixture ne change pas. */
function fake(options: {
  readonly search?: MentorsPageQuery
  readonly mentor?: Loadable<MentorDetailView | null>
  readonly myProfile?: Loadable<MyMentorProfileView | null>
  readonly sent?: MentoringRequestsPageQuery
  readonly received?: MentoringRequestsPageQuery
  readonly requests?: Readonly<Record<string, Loadable<MentoringRequestDetailView | null>>>
} = {}) {
  const search = options.search ?? page<MentorCardView>([])
  const myProfile = options.myProfile ?? ({ status: "ready", data: null } as const)
  const sent = options.sent ?? page<MentoringRequestSummaryView>([])
  const received = options.received ?? page<MentoringRequestSummaryView>([])
  const capability: MentoringCapability = {
    useMyProfile: vi.fn(() => myProfile),
    useSearch: vi.fn(() => search),
    useMentor: vi.fn(() => options.mentor ?? LOADING),
    useMenteeRequests: vi.fn(() => sent),
    useMentorRequests: vi.fn(() => received),
    useRequest: vi.fn((requestId: string) => options.requests?.[requestId] ?? LOADING),
    becomeMentor: vi.fn(() => done({ mentorId: "mentor-new", version: 1 })),
    updateProfile: vi.fn(() => done({ version: 5 })),
    setState: vi.fn(() => done({ state: "paused" as const, version: 5 })),
    request: vi.fn(() => done({ requestId: "request-9", created: true })),
    cancel: vi.fn(() => done(null)),
    accept: vi.fn(() => done({ slotVersion: 1 })),
    decline: vi.fn(() => done(null)),
    proposeSlot: vi.fn(() => done({ slotVersion: 1 })),
    close: vi.fn(() => done(null)),
  }
  mocks.capability = capability
  return capability
}

function tree(node: ReactNode, locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}>{node}</I18nProvider>
}

async function click(element: HTMLElement) {
  await act(async () => { fireEvent.click(element) })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  vi.clearAllMocks()
  mocks.capability = null
  mocks.membership = MEMBER
  mocks.params = new URLSearchParams()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("/mentorat", () => {
  it("lit le pays de l'adresse, sinon celui de ma facette", () => {
    expect(mentoringCountryOf("be", "FR")).toBe("BE")
    expect(mentoringCountryOf("ga", "FR")).toBe("FR")
    expect(mentoringCountryOf(null, "CA")).toBe("CA")
  })

  it("cherche dans le pays de l'adresse, montre les cartes, le complet et le lien vers la fiche", async () => {
    mocks.params = new URLSearchParams("pays=BE")
    const capability = fake({ search: page([CARD, FULL_CARD]) })
    render(tree(<MentoringScreen />))
    expect(screen.getByRole("heading", { level: 1, name: "Mentorat" })).toBeInTheDocument()
    expect(capability.useSearch).toHaveBeenCalledWith({ country: "BE", domain: null, cursor: null })
    expect(screen.getByRole("heading", { name: /Mentors.*Belgique/ })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Mireille IVINDO" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Voir le profil de Mireille IVINDO" })).toHaveAttribute("href", "/mentorat/mentor-1")
    expect(screen.getByText("Complet pour le moment")).toBeInTheDocument()
    expect(screen.getByText(/Le mentorat est bénévole/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Pays"), { target: { value: "FR" } })
    fireEvent.change(screen.getByLabelText("Domaine d’aide"), { target: { value: "housing" } })
    await click(screen.getByRole("button", { name: "Chercher" }))
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/mentorat?pays=FR"))
    expect(capability.useSearch).toHaveBeenLastCalledWith({ country: "BE", domain: "housing", cursor: null })
  })

  it("dit le vide, puis l'indisponibilité quand le fournisseur ne sert pas le mentorat", () => {
    fake()
    const { unmount } = render(tree(<MentoringScreen />))
    expect(screen.getByText("Aucun mentor pour le moment")).toBeInTheDocument()
    unmount()
    mocks.capability = null
    render(tree(<MentoringScreen />))
    expect(screen.getByText("Mentorat indisponible")).toBeInTheDocument()
  })

  it("devenir mentor : la case n'est jamais précochée ; sans elle rien ne part, avec elle l'opt-in part au fournisseur", async () => {
    const capability = fake()
    render(tree(<MentoringScreen />))
    await click(screen.getByRole("button", { name: "Devenir mentor" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Logement" }))
    fireEvent.change(within(dialog).getByLabelText("Présentation"), { target: { value: PRESENTATION } })
    fireEvent.change(within(dialog).getByLabelText("Disponibilité"), { target: { value: "Le soir en semaine" } })
    const consent = within(dialog).getByRole("checkbox", { name: /Je choisis d’apparaître comme mentor/ })
    expect(consent).toHaveAttribute("aria-checked", "false")
    await click(within(dialog).getByRole("button", { name: "Devenir mentor" }))
    await waitFor(() => expect(within(dialog).getByText("Cochez la case pour confirmer que vous choisissez d’être mentor.")).toBeInTheDocument())
    expect(capability.becomeMentor).not.toHaveBeenCalled()

    fireEvent.click(consent)
    await click(within(dialog).getByRole("button", { name: "Devenir mentor" }))
    await waitFor(() => expect(capability.becomeMentor).toHaveBeenCalledWith({
      domains: ["housing"], presentation: PRESENTATION, languages: ["fr"], country: "FR", city: null,
      availability: "Le soir en semaine", maxActiveMentees: 2, consent: true,
    }))
    expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining("Vous êtes mentor"))
  })

  it("refuse une coordonnée dans la présentation avant tout envoi", async () => {
    const capability = fake()
    render(tree(<MentoringScreen />))
    await click(screen.getByRole("button", { name: "Devenir mentor" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Logement" }))
    fireEvent.change(within(dialog).getByLabelText("Présentation"), { target: { value: `${PRESENTATION} Écrivez à mireille@example.com` } })
    fireEvent.change(within(dialog).getByLabelText("Disponibilité"), { target: { value: "Le soir" } })
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Je choisis d’apparaître comme mentor/ }))
    await click(within(dialog).getByRole("button", { name: "Devenir mentor" }))
    await waitFor(() => expect(within(dialog).getByText(/Retirez le numéro de téléphone ou l’adresse e-mail/)).toBeInTheDocument())
    expect(capability.becomeMentor).not.toHaveBeenCalled()
  })

  it("un mentor dont le profil vit déjà ne voit pas « Devenir mentor »", () => {
    fake({ myProfile: { status: "ready", data: MY_PROFILE } })
    render(tree(<MentoringScreen />))
    expect(screen.queryByRole("button", { name: "Devenir mentor" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Mes mentorats" })).toHaveAttribute("href", "/mes-mentorats")
  })
})

describe("/mentorat/<id>", () => {
  it("montre la fiche puis envoie une demande seulement avec le consentement explicite", async () => {
    const capability = fake({ mentor: { status: "ready", data: DETAIL } })
    render(tree(<MentorProfileScreen mentorId="mentor-1" />))
    expect(capability.useMentor).toHaveBeenCalledWith("mentor-1")
    expect(screen.getByRole("heading", { level: 1, name: "Mireille IVINDO, mentor bénévole" })).toBeInTheDocument()
    expect(screen.getByText(PRESENTATION)).toBeInTheDocument()
    expect(screen.getByText("Le soir en semaine")).toBeInTheDocument()

    await click(screen.getByRole("button", { name: "Demander un mentorat" }))
    const dialog = screen.getByRole("dialog")
    fireEvent.change(within(dialog).getByLabelText("Votre objectif"), { target: { value: "Trouver un logement étudiant" } })
    fireEvent.change(within(dialog).getByLabelText("Votre message"), { target: { value: "Je viens d’arriver à Paris et je cherche des conseils pour me loger." } })
    await click(within(dialog).getByRole("button", { name: "Envoyer la demande" }))
    await waitFor(() => expect(within(dialog).getByText("Cochez la case pour accepter que le mentor voie votre nom et votre message.")).toBeInTheDocument())
    expect(capability.request).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole("checkbox"))
    await click(within(dialog).getByRole("button", { name: "Envoyer la demande" }))
    await waitFor(() => expect(capability.request).toHaveBeenCalledWith(expect.objectContaining({
      mentorId: "mentor-1", domain: "housing", goal: "Trouver un logement étudiant", wishedSlots: [], shareWithMentor: true,
      idempotencyKey: expect.any(String), timeZone: expect.any(String),
    })))
    expect(within(dialog).getByRole("status")).toHaveTextContent("Demande envoyée")
    expect(within(dialog).getByRole("link", { name: "Suivre mes demandes" })).toHaveAttribute("href", "/mes-mentorats")
  })

  it.each([
    { label: "son propre profil", mentor: { ...DETAIL, isSelf: true }, text: "C’est votre profil de mentor, tel que les membres le voient." },
    { label: "une demande déjà ouverte", mentor: { ...DETAIL, viewerRequest: { requestId: "request-1", status: "sent" as const } }, text: "Vous avez déjà une demande ouverte auprès de ce mentor." },
    { label: "un mentor complet", mentor: { ...DETAIL, acceptsRequests: false }, text: /Ce mentor accompagne déjà le nombre de personnes/ },
  ])("ne propose pas de demande pour $label", ({ mentor, text }) => {
    fake({ mentor: { status: "ready", data: mentor } })
    render(tree(<MentorProfileScreen mentorId="mentor-1" />))
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Demander un mentorat" })).not.toBeInTheDocument()
  })

  it("dit le statut insuffisant, l'introuvable et l'erreur", () => {
    mocks.membership = { ...MEMBER, status: "en_attente", canPublish: false }
    fake({ mentor: { status: "ready", data: DETAIL } })
    const first = render(tree(<MentorProfileScreen mentorId="mentor-1" />))
    expect(screen.getByRole("button", { name: "Demander un mentorat" })).toBeDisabled()
    expect(screen.getByText("Votre adhésion doit être déclarée pour demander un mentorat.")).toBeInTheDocument()
    first.unmount()
    fake({ mentor: { status: "ready", data: null } })
    const second = render(tree(<MentorProfileScreen mentorId="inconnu" />))
    expect(screen.getByText("Mentor introuvable")).toBeInTheDocument()
    second.unmount()
    fake({ mentor: { status: "error", code: "not_found" } })
    render(tree(<MentorProfileScreen mentorId="mentor-1" />))
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })
})

describe("/mes-mentorats", () => {
  it("liste mes demandes envoyées et reçues ; la fiche dépliée ouvre le seul geste permis", async () => {
    const capability = fake({
      myProfile: { status: "ready", data: MY_PROFILE },
      sent: page([SENT]),
      received: page([RECEIVED]),
      requests: { "request-1": { status: "ready", data: SENT_DETAIL }, "request-2": { status: "ready", data: RECEIVED_DETAIL } },
    })
    render(tree(<MyMentoringScreen />))
    expect(screen.getByRole("heading", { level: 1, name: "Mes mentorats" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Mes demandes" })).toHaveAttribute("aria-selected", "true")
    const sent = screen.getByRole("region", { name: "Demandes envoyées" })
    expect(within(sent).getByText("Trouver un logement étudiant")).toBeInTheDocument()
    expect(within(sent).getByText("En attente de réponse")).toBeInTheDocument()
    expect(within(sent).getByText("Avec Mireille IVINDO · Logement")).toBeInTheDocument()
    await click(within(sent).getByRole("button", { name: "Voir le détail" }))
    expect(within(sent).getByText("Je viens d’arriver et je cherche des conseils pour me loger.")).toBeInTheDocument()
    expect(within(sent).queryByRole("button", { name: "Accepter" })).not.toBeInTheDocument()
    await click(within(sent).getByRole("button", { name: "Retirer ma demande" }))
    const dialog = screen.getByRole("dialog")
    await click(within(dialog).getByRole("button", { name: "Retirer la demande" }))
    await waitFor(() => expect(capability.cancel).toHaveBeenCalledWith({ requestId: "request-1", reason: null }))
    expect(mocks.success).toHaveBeenCalledWith("Demande retirée.")

    const received = screen.getByRole("region", { name: "Demandes reçues" })
    expect(capability.useMentorRequests).toHaveBeenCalledWith({ status: "sent", cursor: null })
    expect(within(received).getByText("De Steeve NGOUNIÉ · Logement")).toBeInTheDocument()
    await click(within(received).getByRole("button", { name: "Toutes" }))
    expect(capability.useMentorRequests).toHaveBeenLastCalledWith({ status: null, cursor: null })
    expect(within(received).getByRole("button", { name: "Toutes" })).toHaveAttribute("aria-pressed", "true")
  })

  it("accepte une demande reçue en retenant un créneau souhaité", async () => {
    const capability = fake({
      myProfile: { status: "ready", data: MY_PROFILE },
      received: page([RECEIVED]),
      requests: { "request-2": { status: "ready", data: RECEIVED_DETAIL } },
    })
    render(tree(<MyMentoringScreen />))
    const received = screen.getByRole("region", { name: "Demandes reçues" })
    await click(within(received).getByRole("button", { name: "Voir le détail" }))
    await click(within(received).getByRole("button", { name: "Accepter" }))
    const dialog = screen.getByRole("dialog")
    const choices = within(dialog).getAllByRole("radio")
    expect(choices).toHaveLength(2)
    expect(choices[0]).toHaveAttribute("aria-checked", "true")
    await click(choices[1]!)
    await click(within(dialog).getByRole("button", { name: "Accepter la demande" }))
    await waitFor(() => expect(capability.accept).toHaveBeenCalledWith({ requestId: "request-2", slot: { ...WISHED, timeZone: "Europe/Paris" } }))
    expect(mocks.success).toHaveBeenCalledWith("Demande acceptée.")
  })

  it("mon profil de mentor : le plafond affiché, les demandes en attente, la pause", async () => {
    const capability = fake({ myProfile: { status: "ready", data: MY_PROFILE } })
    render(tree(<MyMentoringScreen />))
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Mon profil de mentor" }), { button: 0, ctrlKey: false })
    expect(await screen.findByText("1 personne accompagnée sur 3")).toBeInTheDocument()
    expect(screen.getByText("2 demandes en attente de votre réponse")).toBeInTheDocument()
    expect(screen.getByText("Actif")).toBeInTheDocument()
    await click(screen.getByRole("button", { name: "Mettre en pause" }))
    await waitFor(() => expect(capability.setState).toHaveBeenCalledWith({ expectedVersion: 4, state: "paused" }))
    expect(mocks.success).toHaveBeenCalledWith("Profil de mentor en pause.")
    expect(screen.getByRole("link", { name: "Voir mon profil public" })).toHaveAttribute("href", "/mentorat/mentor-self")
  })

  it("G9 : l'état de modération se montre à qui gère — ma demande en relecture, mon profil retiré — jamais sur une demande reçue", async () => {
    fake({
      myProfile: { status: "ready", data: { ...MY_PROFILE, moderation: "removed" } },
      sent: page([{ ...SENT, moderation: "pending_review" as const }]),
      // Un fournisseur fautif qui servirait l'état au mentor : l'écran ne le montre pas pour autant.
      received: page([{ ...RECEIVED, moderation: "removed" as const }]),
    })
    render(tree(<MyMentoringScreen />))
    const sent = screen.getByRole("region", { name: "Demandes envoyées" })
    expect(within(sent).getByText("En relecture.")).toBeInTheDocument()
    expect(within(sent).getByText(/Visible par vous seulement/)).toBeInTheDocument()
    const received = screen.getByRole("region", { name: "Demandes reçues" })
    expect(within(received).getByText("De Steeve NGOUNIÉ · Logement")).toBeInTheDocument()
    expect(within(received).queryByText("Refusée.")).not.toBeInTheDocument()
    expect(within(received).queryByText(/Retirée par la modération/)).not.toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Mon profil de mentor" }), { button: 0, ctrlKey: false })
    expect(await screen.findByText("Refusée.")).toBeInTheDocument()
    expect(screen.getByText(/Votre profil de mentor a été retiré par la modération/)).toBeInTheDocument()
  })

  it("une demande retirée par la modération le dit à son mentoré ; un contenu publié n'affiche aucun avis", () => {
    fake({ sent: page([{ ...SENT, moderation: "removed" as const }, { ...SENT, requestId: "request-3", goal: "Préparer ma rentrée", moderation: "published" as const }]) })
    render(tree(<MyMentoringScreen />))
    const sent = screen.getByRole("region", { name: "Demandes envoyées" })
    expect(within(sent).getAllByText("Refusée.")).toHaveLength(1)
    expect(within(sent).getByText(/Retirée par la modération/)).toBeInTheDocument()
    expect(within(sent).queryByText("En relecture.")).not.toBeInTheDocument()
  })

  it("sans profil de mentor : pas de demandes reçues, et l'onglet du profil propose de devenir mentor ; en anglais aussi", () => {
    fake()
    const { unmount } = render(tree(<MyMentoringScreen />))
    expect(screen.queryByRole("region", { name: "Demandes reçues" })).not.toBeInTheDocument()
    expect(screen.getByText("Aucune demande envoyée")).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Mon profil de mentor" }), { button: 0, ctrlKey: false })
    expect(screen.getByRole("heading", { name: "Devenir mentor" })).toBeInTheDocument()
    unmount()
    render(tree(<MyMentoringScreen />, "en"))
    expect(screen.getByRole("heading", { level: 1, name: "My mentoring" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "My requests" })).toBeInTheDocument()
  })
})
