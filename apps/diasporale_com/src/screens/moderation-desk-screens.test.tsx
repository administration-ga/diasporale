// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type {
  ActionResult,
  DeskAppealDecisionInput,
  DeskAppealView,
  DeskCandidateView,
  DeskCaseDetailView,
  DeskCaseView,
  DeskDecisionInput,
  DeskPage,
  DeskPendingView,
  DeskPreviewView,
  DeskQueueRequest,
  DeskRosterView,
  DeskTeamMemberInput,
  Loadable,
  MembershipView,
  ModerationDeskCapability,
  ModerationDeskView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, getDefaultNormalizer, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DESK_ERROR_VALUES } from "@/components/moderation-desk-parts"

import { ModerationDesk, parseDeskTab } from "./moderation-desk-screens"

/**
 * Le guichet de modération à l'écran, contre une capacité factice : refus
 * indistinct, onglets selon le rôle, filtres transmis, décision motivée,
 * confirmation des mesures lourdes, partie au dossier, recours et équipe.
 * Données de fixture fictives.
 */
const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  desk: null as unknown,
  success: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/moderation",
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: vi.fn() } }))
vi.mock("@/components/gate", () => ({ Gate: (props: { children: (session: { membership: unknown }) => ReactNode }) => <>{props.children({ membership: null })}</> }))
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...(await original<typeof import("@diasporale/features/data")>()),
  useModerationDesk: () => mocks.desk,
  useOpenCountries: () => ({ status: "ready", data: [{ country: "FR" }] }),
}))

const translate = getFixedT("fr")
const normalize = getDefaultNormalizer()
/** Le texte tel que l'écran le lit (espaces insécables ramenées à l'espace simple). */
const text = (key: string, values: Record<string, unknown> = {}) => normalize(String(translate(key, values)))
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** Un nom accessible qui commence par le libellé (une option en carte porte aussi son aide). */
const named = (key: string) => new RegExp("^" + escapeRegExp(String(translate(key))))

const NOW = Date.UTC(2026, 9, 18, 12)
const HOUR = 60 * 60 * 1000
const ME = "person-me"

const MEMBER: MembershipView = {
  personId: ME,
  handle: "moderatrice.fixture",
  displayName: "Modératrice fictive",
  status: "verifiee",
  badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: 1,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "verifiee", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "standard",
  directoryVisibility: "hidden",
}

const MODERATOR: ModerationDeskView = {
  role: "network_moderator",
  networkWide: true,
  canReviewAppeals: false,
  canManageTeams: false,
  teams: [{ teamId: "team-fr", name: "Équipe France (fixture)", scope: null, isMember: true }],
}
const ADMIN: ModerationDeskView = { ...MODERATOR, role: "network_admin", canReviewAppeals: true, canManageTeams: true }

const CASE: DeskCaseView = {
  reportId: "report-1", surface: "post", country: "FR", ground: "harassment", status: "open", level: "network",
  teamName: null, createdAt: NOW - HOUR, hasAuthor: true, party: null,
}
const PARTY_CASE: DeskCaseView = { ...CASE, reportId: "report-2", surface: "page", ground: "misinformation", hasAuthor: false, party: "page" }
const APPEAL: DeskAppealView = {
  appealId: "appeal-1", reportId: "report-9", surface: "comment", country: "FR", ground: "hate",
  appealReason: "Je demande un réexamen (fixture).", createdAt: NOW - 2 * HOUR, decisionReason: "Propos haineux (fixture).", decidedAt: NOW - 3 * HOUR,
  sanctions: [{ kind: "warning", until: null }], party: null,
}
const CANDIDATE: DeskCandidateView = { personId: "person-awa", handle: "awa.fixture", displayName: "Awa Fixture" }

const ready = <T,>(data: T): Loadable<T> => ({ status: "ready", data })
const windowOf = <Row,>(items: readonly Row[]): Loadable<DeskPage<Row>> => ready({ items, continueCursor: null, isDone: true })
const OK: ActionResult = { ok: true, value: null }

/** Une capacité factice : chaque lecture rend une référence STABLE, comme les fournisseurs réels. */
function fakeDesk(options: { readonly view?: Loadable<ModerationDeskView | null>; readonly demonstration?: boolean } = {}) {
  const view = options.view ?? ready(MODERATOR)
  const cases = windowOf([CASE, PARTY_CASE])
  const pending = windowOf<DeskPendingView>([])
  const appeals = windowOf([APPEAL])
  const preview: Loadable<DeskPreviewView> = ready({ available: true, title: null, body: "Texte signalé (fixture).", media: [] })
  const details = new Map<string, Loadable<DeskCaseDetailView>>([
    [CASE.reportId, ready({ case: CASE, history: [], historyMore: false })],
    [PARTY_CASE.reportId, ready({ case: PARTY_CASE, history: [], historyMore: false })],
  ])
  const missing: Loadable<DeskCaseDetailView> = { status: "error", code: "not_found" }
  const roster: Loadable<DeskRosterView> = ready({ members: [{ personId: "person-nadia", handle: "nadia.fixture", displayName: "Nadia Fixture", inNetwork: true, isMe: false }], more: false })
  const queueReads: DeskQueueRequest[] = []
  const decide = vi.fn(async (input: DeskDecisionInput): Promise<ActionResult<{ readonly status: "dismissed" | "actioned" }>> => ({ ok: true, value: { status: input.decision } }))
  const decideAppeal = vi.fn(async (_input: DeskAppealDecisionInput): Promise<ActionResult> => OK)
  const setTeamMember = vi.fn(async (_input: DeskTeamMemberInput): Promise<ActionResult> => OK)
  const findMember = vi.fn(async (): Promise<ActionResult<DeskCandidateView | null>> => ({ ok: true, value: CANDIDATE }))
  const desk: ModerationDeskCapability = {
    demonstration: options.demonstration ?? false,
    useDesk: () => view,
    useQueue: (request) => {
      queueReads.push(request)
      return cases
    },
    useCase: ({ reportId }) => details.get(reportId) ?? missing,
    useCasePreview: () => preview,
    decide,
    usePending: () => pending,
    usePendingPreview: () => preview,
    reviewPending: vi.fn(async () => OK),
    useAppeals: () => appeals,
    decideAppeal,
    useRoster: () => roster,
    findMember,
    createTeam: vi.fn(async () => ({ ok: true as const, value: { teamId: "team-new" } })),
    setTeamMember,
  }
  return { desk, queueReads, decide, decideAppeal, setTeamMember, findMember }
}

const tree = () => <I18nProvider locale="fr"><ModerationDesk membership={MEMBER} /></I18nProvider>

beforeEach(() => {
  mocks.params = new URLSearchParams()
  mocks.desk = null
  mocks.success.mockReset()
})
afterEach(cleanup)

describe("Guichet — accès sans divulgation", () => {
  it("dit « indisponible » quand la capacité manque, pour un membre sans compétence et sur un refus d'accès", () => {
    render(tree())
    expect(screen.getByText(text("moderationDesk.unavailable.title"))).toBeInTheDocument()
    cleanup()

    const none = fakeDesk({ view: ready(null) })
    mocks.desk = none.desk
    render(tree())
    expect(screen.getByText(text("moderationDesk.unavailable.title"))).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: text("moderationDesk.tabsLabel") })).toBeNull()
    expect(none.queueReads).toEqual([])
    cleanup()

    const refused = fakeDesk({ view: { status: "error", code: "not_found" } })
    mocks.desk = refused.desk
    render(tree())
    expect(screen.getByText(text("moderationDesk.unavailable.title"))).toBeInTheDocument()
    expect(refused.queueReads).toEqual([])
  })

  it("annonce la démonstration : dossiers fictifs, décisions sans effet", () => {
    mocks.desk = fakeDesk({ demonstration: true }).desk
    render(tree())
    expect(screen.getByText(text("moderationDesk.demoNotice"))).toBeInTheDocument()
  })

  it("lit l'onglet dans l'adresse, « File » par défaut", () => {
    expect(parseDeskTab(null)).toBe("file")
    expect(parseDeskTab("recours")).toBe("recours")
    expect(parseDeskTab("equipe")).toBe("equipe")
    expect(parseDeskTab("inconnu")).toBe("file")
  })
})

describe("Guichet — la file par pays", () => {
  it("montre la capacité, les onglets du rôle et transmet les filtres de pays et de nature", async () => {
    const fake = fakeDesk()
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    expect(screen.getByText(text("moderationDesk.capacity.role.network_moderator"))).toBeInTheDocument()
    const nav = screen.getByRole("navigation", { name: text("moderationDesk.tabsLabel") })
    // Un modérateur réseau n'a pas l'onglet des recours.
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/moderation?onglet=file", "/moderation?onglet=equipe"])
    expect(screen.getByRole("heading", { name: text("moderationDesk.surface.post") })).toBeInTheDocument()
    expect(fake.queueReads.at(-1)).toMatchObject({ personId: ME, zone: { kind: "all" }, surface: null, teamId: null, cursor: null })

    await user.selectOptions(screen.getByLabelText(text("moderationDesk.filters.zone")), "FR")
    expect(fake.queueReads.at(-1)).toMatchObject({ zone: { kind: "country", country: "FR" } })
    await user.selectOptions(screen.getByLabelText(text("moderationDesk.filters.surface")), "page")
    expect(fake.queueReads.at(-1)).toMatchObject({ zone: { kind: "country", country: "FR" }, surface: "page" })
    await user.selectOptions(screen.getByLabelText(text("moderationDesk.filters.team")), "team-fr")
    expect(fake.queueReads.at(-1)).toMatchObject({ teamId: "team-fr" })
  })
})

describe("Guichet — décision motivée", () => {
  it("exige une issue et un motif, puis classe le dossier et rend le focus au message d'issue", async () => {
    const fake = fakeDesk()
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    await user.click(screen.getAllByRole("button", { name: text("moderationDesk.case.open") })[0]!)
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Texte signalé (fixture).")).toBeInTheDocument()
    expect(within(dialog).getByText(text("moderationDesk.history.empty"))).toBeInTheDocument()

    const submit = within(dialog).getByRole("button", { name: text("moderationDesk.decision.submit") })
    await user.click(submit)
    expect(await within(dialog).findByText(text("errors.moderation_desk_outcome_required"))).toBeInTheDocument()

    await user.click(within(dialog).getByRole("radio", { name: named("moderationDesk.decision.outcome.dismissed") }))
    const reason = within(dialog).getByLabelText(text("moderationDesk.decision.reason"))
    await user.type(reason, "Court")
    await user.click(submit)
    expect(await within(dialog).findByText(text("errors.moderation_desk_reason_length", DESK_ERROR_VALUES))).toBeInTheDocument()
    expect(fake.decide).not.toHaveBeenCalled()

    await user.clear(reason)
    await user.type(reason, "Signalement non fondé après lecture.")
    await act(async () => {
      await user.click(submit)
    })
    await waitFor(() => expect(fake.decide).toHaveBeenCalledExactlyOnceWith({
      personId: ME, reportId: CASE.reportId, reason: "Signalement non fondé après lecture.",
      decision: "dismissed", removal: false, personMeasure: "none", durationDays: null,
    }))
    const done = await screen.findByText(text("moderationDesk.decision.done.dismissed"))
    await waitFor(() => expect(done).toHaveFocus())
  })

  it("confirme une suspension avant de l'envoyer, avec sa durée", async () => {
    const fake = fakeDesk()
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    await user.click(screen.getAllByRole("button", { name: text("moderationDesk.case.open") })[0]!)
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("radio", { name: named("moderationDesk.decision.outcome.actioned") }))
    await user.selectOptions(within(dialog).getByLabelText(text("moderationDesk.decision.personMeasure")), "suspension")
    await user.selectOptions(within(dialog).getByLabelText(text("moderationDesk.decision.duration")), "7")
    await user.type(within(dialog).getByLabelText(text("moderationDesk.decision.reason")), "Menaces répétées envers un membre.")
    await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.decision.submit") }))

    expect(await within(dialog).findByRole("heading", { name: text("moderationDesk.confirm.title") })).toHaveFocus()
    expect(within(dialog).getByText(text("moderationDesk.confirm.everywhere"))).toBeInTheDocument()
    expect(fake.decide).not.toHaveBeenCalled()
    await act(async () => {
      await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.confirm.decide") }))
    })
    await waitFor(() => expect(fake.decide).toHaveBeenCalledExactlyOnceWith({
      personId: ME, reportId: CASE.reportId, reason: "Menaces répétées envers un membre.",
      decision: "actioned", removal: false, personMeasure: "suspension", durationDays: 7,
    }))
  })

  it("n'offre aucun formulaire à une personne partie au dossier", async () => {
    const fake = fakeDesk()
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    await user.click(screen.getByRole("button", { name: text("moderationDesk.case.view") }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(text("moderationDesk.party.page"))).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: text("moderationDesk.decision.submit") })).toBeNull()
  })
})

describe("Guichet — recours et équipe", () => {
  it("réserve les recours à l'administration et confirme l'annulation d'une décision", async () => {
    mocks.params = new URLSearchParams("onglet=recours")
    mocks.desk = fakeDesk().desk
    render(tree())
    expect(screen.getByText(text("moderationDesk.appeals.restricted"))).toBeInTheDocument()
    cleanup()

    const fake = fakeDesk({ view: ready(ADMIN) })
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    expect(screen.getByText("Je demande un réexamen (fixture).")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: text("moderationDesk.appeals.open") }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("radio", { name: named("moderationDesk.appeals.overturn") }))
    await user.type(within(dialog).getByLabelText(text("moderationDesk.decision.reason")), "Contexte ironique établi après réexamen.")
    await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.appeals.submit") }))
    expect(await within(dialog).findByText(text("moderationDesk.confirm.overturnBody"))).toBeInTheDocument()
    expect(fake.decideAppeal).not.toHaveBeenCalled()
    await act(async () => {
      await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.confirm.overturn") }))
    })
    await waitFor(() => expect(fake.decideAppeal).toHaveBeenCalledExactlyOnceWith({
      personId: ME, appealId: APPEAL.appealId, overturn: true, reason: "Contexte ironique établi après réexamen.",
    }))
  })

  it("compose l'équipe pour l'administration : membres identifiés, ajout motivé par identifiant", async () => {
    mocks.params = new URLSearchParams("onglet=equipe")
    const fake = fakeDesk({ view: ready(ADMIN) })
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    expect(screen.getByText("Nadia Fixture")).toBeInTheDocument()
    await user.type(screen.getByLabelText(text("moderationDesk.team.handle")), "@awa.fixture")
    await user.click(screen.getByRole("button", { name: text("moderationDesk.team.search") }))
    expect(await screen.findByText("Awa Fixture")).toBeInTheDocument()
    expect(fake.findMember).toHaveBeenCalledWith({ personId: ME, handle: "awa.fixture" })
    const reasons = screen.getAllByLabelText(text("moderationDesk.decision.reason"))
    await user.type(reasons[0]!, "Modératrice volontaire pour la France.")
    await act(async () => {
      await user.click(screen.getByRole("button", { name: text("moderationDesk.team.addConfirm") }))
    })
    await waitFor(() => expect(fake.setTeamMember).toHaveBeenCalledExactlyOnceWith({
      personId: ME, teamId: "team-fr", memberPersonId: CANDIDATE.personId, active: true, reason: "Modératrice volontaire pour la France.",
    }))
  })

  it("laisse la composition en lecture seule pour un modérateur", () => {
    mocks.params = new URLSearchParams("onglet=equipe")
    mocks.desk = fakeDesk().desk
    render(tree())
    expect(screen.getByText(text("moderationDesk.team.readOnly"))).toBeInTheDocument()
    expect(screen.queryByLabelText(text("moderationDesk.team.handle"))).toBeNull()
  })
})
