// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type {
  ActionResult,
  DeskAppealDecisionInput,
  DeskAppealView,
  DeskBlockedTermInput,
  DeskBlockedTermView,
  DeskCandidateView,
  DeskCaseDetailView,
  DeskClaimDecisionInput,
  DeskClaimDetailView,
  DeskClaimsRequest,
  DeskClaimView,
  DeskCaseView,
  DeskDeadlineLane,
  DeskDeadlinesRequest,
  DeskDeadlineView,
  DeskDecisionInput,
  DeskPage,
  DeskPendingView,
  DeskPolicyInput,
  DeskPreviewView,
  DeskQueueRequest,
  DeskResponsibleRoleInput,
  DeskResponsibleRoleResult,
  DeskResponsiblesView,
  DeskRosterView,
  DeskSettingsView,
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

import { DESK_ERROR_VALUES, deskDateTime } from "@/components/moderation-desk-parts"

import { ModerationDesk, parseDeskTab } from "./moderation-desk-screens"

/**
 * Le guichet de modération à l'écran, contre une capacité factice : refus
 * indistinct, onglets selon le rôle, filtres transmis, délais légaux en tête,
 * décision motivée, confirmation des mesures lourdes, partie au dossier,
 * recours et équipe. Données de fixture fictives.
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
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
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
  canManagePolicy: false,
  canReviewClaims: true,
  teams: [{ teamId: "team-fr", name: "Équipe France (fixture)", scope: null, isMember: true }],
}
const ADMIN: ModerationDeskView = { ...MODERATOR, role: "network_admin", canReviewAppeals: true, canManageTeams: true, canManagePolicy: true }

/** MD-04 : les défauts servis par le moteur (valeurs de fixture, distinctes de celles du moteur) et deux rubriques. */
const SETTINGS: DeskSettingsView = {
  defaults: { preReview: false, maxLinks: 3, maxWrites: 12, windowMs: 2 * 60 * MINUTE },
  surfaces: [
    { surface: "event", withoutPolicy: "defaults", policy: null },
    { surface: "diasporaJobOffer", withoutPolicy: "unchecked", policy: { preReview: true, maxLinks: 1, maxWrites: 5, windowMs: 10 * MINUTE, updatedAt: NOW - HOUR } },
    { surface: "commerceOffer", withoutPolicy: "held", policy: null },
  ],
}
const TERM: DeskBlockedTermView = { termId: "term-1", term: "consulat", updatedAt: NOW - HOUR }

/** AS-01 : une demande libre, une demande dont la personne signe la page, et leurs fiches. */
const CLAIM: DeskClaimView = {
  claimId: "claim-1",
  page: { id: "page-1", handle: "amicale-lyon", name: "Amicale de Lyon (fixture)", ownerKind: "association", badge: "community", country: "FR" },
  country: "FR", evidenceCount: 3, createdAt: NOW - HOUR, party: null,
}
const PARTY_CLAIM: DeskClaimView = { ...CLAIM, claimId: "claim-2", page: { ...CLAIM.page, id: "page-2", handle: "cercle-bordeaux", name: "Cercle de Bordeaux (fixture)" }, party: "page" }
const SERVER_REFUSED_CLAIM: DeskClaimView = { ...CLAIM, claimId: "claim-3", page: { ...CLAIM.page, id: "page-3", handle: "union-lille", name: "Union de Lille (fixture)" } }
const CLAIM_DETAIL: DeskClaimDetailView = {
  claimId: "claim-1",
  claimant: { personId: "person-awa", handle: "awa.fixture", displayName: "Awa Fixture" },
  note: "Mandat déclaré : présidence (fixture).",
  evidence: [{ url: null, withheld: "fileScanPending" }, { url: "https://depot.exemple.test/piece", withheld: null }, { url: null, withheld: "fileQuarantined" }],
  canDecide: null,
}

const CASE: DeskCaseView = {
  reportId: "report-1", surface: "post", country: "FR", ground: "harassment", status: "open", level: "network",
  teamName: null, createdAt: NOW - HOUR, hasAuthor: true, party: null,
}
const PARTY_CASE: DeskCaseView = { ...CASE, reportId: "report-2", surface: "page", ground: "misinformation", hasAuthor: false, party: "page" }
/** Le même dossier que `CASE`, tel que la voie des délais légaux le montre (SU01d du moteur). */
const DEADLINE: DeskDeadlineView = {
  reportId: CASE.reportId, surface: CASE.surface, ground: "harassment", status: "open", level: "team", teamId: "team-fr",
  createdAt: NOW - 30 * HOUR - 30 * MINUTE, basis: "art24", dueAt: NOW + 41 * HOUR + 30 * MINUTE, acknowledgedAt: NOW - 30 * HOUR - 30 * MINUTE,
}
const LATE: DeskDeadlineView = {
  ...DEADLINE, reportId: "report-7", surface: "comment", ground: "deepfake_of_me", status: "reviewing", level: "network", teamId: null,
  basis: "art33", dueAt: NOW - 65 * MINUTE, acknowledgedAt: null,
}
const EMPTY_LANE: DeskDeadlineLane = { items: [], truncated: false }
const APPEAL: DeskAppealView = {
  appealId: "appeal-1", reportId: "report-9", surface: "comment", country: "FR", ground: "hate",
  appealReason: "Je demande un réexamen (fixture).", createdAt: NOW - 2 * HOUR, decisionReason: "Propos haineux (fixture).", decidedAt: NOW - 3 * HOUR,
  sanctions: [{ kind: "warning", until: null }], party: null,
}
const CANDIDATE: DeskCandidateView = { personId: "person-awa", handle: "awa.fixture", displayName: "Awa Fixture" }
/** MD-01 : les responsables du réseau, dont la personne de la session et un rôle en sommeil (profil non publié). */
const RESPONSIBLES: DeskResponsiblesView = {
  members: [
    { personId: ME, role: "network_admin", handle: "moderatrice.fixture", displayName: "Serge Fixture", active: true, isMe: true },
    { personId: "person-ruth", role: "network_moderator", handle: "ruth.fixture", displayName: "Ruth Fixture", active: true, isMe: false },
    { personId: "person-paul", role: "network_moderator", handle: null, displayName: null, active: false, isMe: false },
  ],
  more: false,
}

const ready = <T,>(data: T): Loadable<T> => ({ status: "ready", data })
const windowOf = <Row,>(items: readonly Row[]): Loadable<DeskPage<Row>> => ready({ items, continueCursor: null, isDone: true })
const OK: ActionResult = { ok: true, value: null }

/** Une capacité factice : chaque lecture rend une référence STABLE, comme les fournisseurs réels. */
function fakeDesk(options: {
  readonly view?: Loadable<ModerationDeskView | null>
  readonly demonstration?: boolean
  readonly deadlines?: Loadable<DeskDeadlineLane>
  readonly roleResult?: (input: DeskResponsibleRoleInput) => ActionResult<DeskResponsibleRoleResult>
} = {}) {
  const view = options.view ?? ready(MODERATOR)
  const deadlines = options.deadlines ?? ready(EMPTY_LANE)
  const cases = windowOf([CASE, PARTY_CASE])
  // La file ordinaire ne reprend pas les dossiers de la voie, comme les fournisseurs réels.
  const shown = new Set(deadlines.status === "ready" ? deadlines.data.items.map((row) => row.reportId) : [])
  const ordinary = windowOf([CASE, PARTY_CASE].filter((row) => !shown.has(row.reportId)))
  const deadlineReads: DeskDeadlinesRequest[] = []
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
  const responsibles: Loadable<DeskResponsiblesView> = ready(RESPONSIBLES)
  const setResponsibleRole = vi.fn(async (input: DeskResponsibleRoleInput): Promise<ActionResult<DeskResponsibleRoleResult>> =>
    options.roleResult?.(input) ?? { ok: true, value: { role: input.role, changed: true } })
  const settings: Loadable<DeskSettingsView> = ready(SETTINGS)
  const terms = windowOf([TERM])
  const settingsReads: string[] = []
  const setPolicy = vi.fn(async (_input: DeskPolicyInput): Promise<ActionResult> => OK)
  const setBlockedTerm = vi.fn(async (_input: DeskBlockedTermInput): Promise<ActionResult> => OK)
  const claims = windowOf([CLAIM, PARTY_CLAIM, SERVER_REFUSED_CLAIM])
  const claimReads: DeskClaimsRequest[] = []
  const claimDetails = new Map<string, Loadable<DeskClaimDetailView>>([
    [CLAIM.claimId, ready(CLAIM_DETAIL)],
    [PARTY_CLAIM.claimId, ready({ ...CLAIM_DETAIL, claimId: PARTY_CLAIM.claimId })],
    // Le serveur (PG-01 du moteur) dit que la personne ne peut pas trancher, sans conflit connu de la file.
    [SERVER_REFUSED_CLAIM.claimId, ready({ ...CLAIM_DETAIL, claimId: SERVER_REFUSED_CLAIM.claimId, canDecide: false })],
  ])
  const missingClaim: Loadable<DeskClaimDetailView> = { status: "error", code: "not_found" }
  const decideClaim = vi.fn(async (input: DeskClaimDecisionInput): Promise<ActionResult<{ readonly status: "approved" | "rejected" }>> => ({ ok: true, value: { status: input.decision } }))
  const desk: ModerationDeskCapability = {
    demonstration: options.demonstration ?? false,
    useDesk: () => view,
    useQueue: (request) => {
      queueReads.push(request)
      return request.lane === "ordinary" ? ordinary : cases
    },
    useDeadlines: (request) => {
      deadlineReads.push(request)
      return deadlines
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
    useResponsibles: () => responsibles,
    setResponsibleRole,
    useSettings: (personId) => {
      settingsReads.push(personId)
      return settings
    },
    useBlockedTerms: () => terms,
    setPolicy,
    setBlockedTerm,
    useClaims: (request) => {
      claimReads.push(request)
      return claims
    },
    useClaim: ({ claimId }) => claimDetails.get(claimId) ?? missingClaim,
    decideClaim,
  }
  return { desk, queueReads, deadlineReads, decide, decideAppeal, setTeamMember, findMember, setResponsibleRole, settingsReads, setPolicy, setBlockedTerm, claimReads, decideClaim }
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
    expect(parseDeskTab("pages")).toBe("pages")
    expect(parseDeskTab("reglages")).toBe("reglages")
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
    expect(within(nav).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/moderation?onglet=file", "/moderation?onglet=pages", "/moderation?onglet=equipe"])
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

describe("Guichet — délais légaux en tête (SU01d du moteur)", () => {
  afterEach(() => {
    vi.useRealTimers()
  })
  const laneRegion = () => screen.getByRole("region", { name: text("moderationDesk.deadlines.title") })
  const duration = (hours: number, minutes: number) => text("moderationDesk.deadlines.hoursMinutes", { hours, minutes })

  it("met la voie avant la file : fondement, chronomètre, échéance et accusé ; la file ordinaire ne la reprend pas", async () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] })
    const fake = fakeDesk({ deadlines: ready({ items: [DEADLINE], truncated: false }) })
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    const lane = laneRegion()
    const queue = screen.getByRole("region", { name: text("moderationDesk.queue.title") })
    expect(lane.compareDocumentPosition(queue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(lane).getByText(text("moderationDesk.deadlines.lead", { ordinance: "0011/PR/2026" }))).toBeInTheDocument()
    expect(within(lane).getByRole("heading", { name: text("moderationDesk.surface.post") })).toBeInTheDocument()
    expect(within(lane).getByText(text("moderationDesk.deadlines.basis.art24", { hours: 72 }))).toBeInTheDocument()
    expect(within(lane).getByRole("timer")).toHaveTextContent(text("moderationDesk.deadlines.remaining", { duration: duration(41, 30) }))
    expect(within(lane).getByText(text("moderationDesk.deadlines.dueAt", { date: deskDateTime(DEADLINE.dueAt, "fr") }))).toBeInTheDocument()
    expect(within(lane).getByText(text("moderationDesk.deadlines.acknowledged", { date: deskDateTime(NOW - 30 * HOUR - 30 * MINUTE, "fr") }))).toBeInTheDocument()
    // Le nom de l'équipe du dossier se lit dans le guichet.
    expect(within(lane).getByText(new RegExp(escapeRegExp(text("moderationDesk.level.teamNamed", { name: "Équipe France (fixture)" }))))).toBeInTheDocument()

    // La file ordinaire est demandée à part et ne reprend pas le dossier de la voie.
    expect(fake.queueReads.at(-1)).toMatchObject({ lane: "ordinary" })
    expect(within(queue).queryByRole("heading", { name: text("moderationDesk.surface.post") })).toBeNull()
    expect(within(queue).getByRole("heading", { name: text("moderationDesk.surface.page") })).toBeInTheDocument()
    expect(within(queue).getByText(text("moderationDesk.deadlines.ordinaryNote"))).toBeInTheDocument()

    // La voie suit l'équipe choisie, jamais le pays ni la nature.
    expect(fake.deadlineReads.at(-1)).toEqual({ personId: ME, teamId: null })
    await user.selectOptions(screen.getByLabelText(text("moderationDesk.filters.zone")), "FR")
    await user.selectOptions(screen.getByLabelText(text("moderationDesk.filters.surface")), "page")
    expect(fake.deadlineReads.at(-1)).toEqual({ personId: ME, teamId: null })
    await user.selectOptions(screen.getByLabelText(text("moderationDesk.filters.team")), "team-fr")
    expect(fake.deadlineReads.at(-1)).toEqual({ personId: ME, teamId: "team-fr" })
    expect(fake.queueReads.at(-1)).toMatchObject({ teamId: "team-fr", zone: { kind: "country", country: "FR" }, surface: "page", lane: "ordinary" })
  })

  it("dit un retard, un dossier en examen et un accusé non remis ; le chronomètre avance sans relecture", () => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date", "setInterval", "clearInterval"] })
    mocks.desk = fakeDesk({ deadlines: ready({ items: [LATE, DEADLINE], truncated: true }) }).desk
    render(tree())
    const lane = laneRegion()
    const [late, onTime] = within(lane).getAllByRole("timer")
    expect(late).toHaveTextContent(text("moderationDesk.deadlines.overdue", { duration: duration(1, 5) }))
    expect(late).toHaveClass("text-destructive")
    expect(onTime).toHaveTextContent(text("moderationDesk.deadlines.remaining", { duration: duration(41, 30) }))
    expect(onTime).not.toHaveClass("text-destructive")
    expect(within(lane).getByText(text("moderationDesk.deadlines.basis.art33", { hours: 24 }))).toBeInTheDocument()
    expect(within(lane).getByText(text("moderationDesk.deadlines.notAcknowledged"))).toBeInTheDocument()
    expect(within(lane).getByText(text("moderationDesk.case.reviewing"))).toBeInTheDocument()
    expect(within(lane).getByText(text("moderationDesk.deadlines.truncated", { max: 50 }))).toBeInTheDocument()

    // Trente secondes plus tard, sans nouvelle lecture : le retard gagne une minute, le reste en perd une.
    act(() => {
      vi.advanceTimersByTime(30_000)
    })
    expect(late).toHaveTextContent(text("moderationDesk.deadlines.overdue", { duration: duration(1, 6) }))
    expect(onTime).toHaveTextContent(text("moderationDesk.deadlines.remaining", { duration: duration(41, 29) }))
  })

  it("ouvre un dossier de la voie : la feuille rappelle son délai, le message d'issue revient dans la voie", async () => {
    const fake = fakeDesk({ deadlines: ready({ items: [DEADLINE], truncated: false }) })
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    await user.click(within(laneRegion()).getByRole("button", { name: text("moderationDesk.case.open") }))
    const dialog = await screen.findByRole("dialog")
    const deadline = within(dialog).getByRole("region", { name: text("moderationDesk.deadlines.caseTitle") })
    expect(within(deadline).getByText(text("moderationDesk.deadlines.basis.art24", { hours: 72 }))).toBeInTheDocument()
    expect(within(deadline).getByRole("timer")).toBeInTheDocument()

    await user.click(within(dialog).getByRole("radio", { name: named("moderationDesk.decision.outcome.dismissed") }))
    await user.type(within(dialog).getByLabelText(text("moderationDesk.decision.reason")), "Signalement non fondé après lecture.")
    await act(async () => {
      await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.decision.submit") }))
    })
    await waitFor(() => expect(fake.decide).toHaveBeenCalledExactlyOnceWith({
      personId: ME, reportId: DEADLINE.reportId, reason: "Signalement non fondé après lecture.",
      decision: "dismissed", removal: false, personMeasure: "none", durationDays: null,
    }))
    const done = await within(laneRegion()).findByText(text("moderationDesk.decision.done.dismissed"))
    await waitFor(() => expect(done).toHaveFocus())
  })

  it("dit une voie vide, puis « aucun autre dossier » quand la voie a pris toute la file", () => {
    mocks.desk = fakeDesk().desk
    render(tree())
    expect(within(laneRegion()).getByText(text("moderationDesk.deadlines.empty"))).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: text("moderationDesk.surface.post") })).toBeInTheDocument()
    cleanup()

    const everything: DeskDeadlineView[] = [DEADLINE, { ...DEADLINE, reportId: PARTY_CASE.reportId, surface: "page", ground: "institution_impersonation", basis: "art32" }]
    mocks.desk = fakeDesk({ deadlines: ready({ items: everything, truncated: false }) }).desk
    render(tree())
    expect(screen.getByText(text("moderationDesk.deadlines.ordinaryEmptyTitle"))).toBeInTheDocument()
    expect(screen.getByText(text("moderationDesk.deadlines.ordinaryEmptyBody"))).toBeInTheDocument()
    expect(within(laneRegion()).getByText(text("moderationDesk.deadlines.basis.art32", { hours: 24 }))).toBeInTheDocument()
  })

  it("dit une voie illisible sans rien retirer de la file", () => {
    mocks.desk = fakeDesk({ deadlines: { status: "error", code: "rate_limited" } }).desk
    render(tree())
    expect(within(laneRegion()).getByRole("alert")).toHaveTextContent(text("moderationDesk.deadlines.error"))
    expect(screen.getByRole("heading", { name: text("moderationDesk.surface.post") })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: text("moderationDesk.surface.page") })).toBeInTheDocument()
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

  it("renvoie, sous le motif du dossier, à la règle de la communauté qu'il vise (MD-05)", async () => {
    mocks.desk = fakeDesk().desk
    const user = userEvent.setup()
    render(tree())
    await user.click(screen.getAllByRole("button", { name: text("moderationDesk.case.open") })[0]!)
    const dialog = await screen.findByRole("dialog")
    const rule = within(dialog).getByRole("link", { name: String(translate("communityRules.readRule", { rule: translate("legal.community.respect.title") })) })
    expect(rule).toHaveAttribute("href", "/regles-communaute#respect")
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
    // MD-01 : les responsables du réseau ne se lisent ni ne se nomment hors de l'administration.
    expect(screen.queryByRole("heading", { name: text("moderationDesk.responsibles.title") })).toBeNull()
    expect(screen.queryByLabelText(text("moderationDesk.responsibles.handle"))).toBeNull()
  })
})

describe("Guichet — responsables du réseau (MD-01)", () => {
  /** Le bloc « Responsables du réseau » de l'onglet « Équipe ». */
  function responsiblesBlock(): HTMLElement {
    const section = screen.getByRole("heading", { name: text("moderationDesk.responsibles.title") }).closest("section")
    if (!section) throw new Error("bloc des responsables absent")
    return section
  }
  function lineOf(block: HTMLElement, name: string): HTMLElement {
    const line = within(block).getByText(name).closest("li")
    if (!line) throw new Error(`ligne absente : ${name}`)
    return line
  }

  it("liste les responsables par leur profil publié et nomme par identifiant, rôle et motif", async () => {
    mocks.params = new URLSearchParams("onglet=equipe")
    const fake = fakeDesk({ view: ready(ADMIN) })
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    const block = responsiblesBlock()
    expect(within(lineOf(block, "Serge Fixture")).getByText(text("moderationDesk.team.me"))).toBeInTheDocument()
    expect(within(lineOf(block, "Serge Fixture")).getByText(text("moderationDesk.responsibles.role.network_admin"))).toBeInTheDocument()
    expect(within(lineOf(block, "Ruth Fixture")).getByText(text("moderationDesk.responsibles.role.network_moderator"))).toBeInTheDocument()
    // Un rôle en sommeil, au profil non publié : nom neutre, aucun changement de rôle offert, le retrait reste.
    const dormant = lineOf(block, text("moderationDesk.team.neutralName"))
    expect(within(dormant).getByText(text("moderationDesk.responsibles.inactive"))).toBeInTheDocument()
    expect(within(dormant).queryByRole("button", { name: text("moderationDesk.responsibles.change") })).toBeNull()
    expect(within(dormant).getByRole("button", { name: text("moderationDesk.responsibles.remove") })).toBeInTheDocument()

    await user.type(within(block).getByLabelText(text("moderationDesk.responsibles.handle")), "@awa.fixture")
    await user.click(within(block).getByRole("button", { name: text("moderationDesk.responsibles.search") }))
    expect(await within(block).findByText("Awa Fixture")).toBeInTheDocument()
    expect(fake.findMember).toHaveBeenCalledWith({ personId: ME, handle: "awa.fixture" })
    await user.selectOptions(within(block).getByLabelText(text("moderationDesk.responsibles.roleField")), "network_admin")
    const submit = within(block).getByRole("button", { name: text("moderationDesk.responsibles.appointConfirm") })
    await user.click(submit)
    expect(await within(block).findByText(text("errors.moderation_desk_reason_length", DESK_ERROR_VALUES))).toBeInTheDocument()
    expect(fake.setResponsibleRole).not.toHaveBeenCalled()
    await user.type(within(block).getByLabelText(text("moderationDesk.decision.reason")), "Deuxième administratrice pour les recours.")
    await act(async () => {
      await user.click(submit)
    })
    await waitFor(() => expect(fake.setResponsibleRole).toHaveBeenCalledExactlyOnceWith({
      personId: ME, memberPersonId: CANDIDATE.personId, role: "network_admin", reason: "Deuxième administratrice pour les recours.",
    }))
    // Le message d'un geste abouti, tel que l'écran le passe à sonner (espaces insécables comprises).
    expect(mocks.success).toHaveBeenCalledWith(translate("moderationDesk.responsibles.appointed", { name: "Awa Fixture", role: translate("moderationDesk.responsibles.role.network_admin") }))
    expect(within(block).getByLabelText(text("moderationDesk.responsibles.handle"))).toHaveValue("")
  })

  it("confirme un retrait motivé, traduit la règle du dernier administrateur, puis change un rôle", async () => {
    mocks.params = new URLSearchParams("onglet=equipe")
    const fake = fakeDesk({
      view: ready(ADMIN),
      roleResult: (input) => (input.memberPersonId === ME ? { ok: false, code: "moderation_desk_last_admin" } : { ok: true, value: { role: input.role, changed: true } }),
    })
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    const block = responsiblesBlock()

    await user.click(within(lineOf(block, "Serge Fixture")).getByRole("button", { name: text("moderationDesk.responsibles.remove") }))
    const removal = await screen.findByRole("dialog", { name: text("moderationDesk.responsibles.removeTitle", { name: "Serge Fixture" }) })
    expect(within(removal).getByText(text("moderationDesk.responsibles.selfWarning"))).toBeInTheDocument()
    await user.type(within(removal).getByLabelText(text("moderationDesk.decision.reason")), "Je quitte l'administration du réseau.")
    await act(async () => {
      await user.click(within(removal).getByRole("button", { name: text("moderationDesk.responsibles.removeConfirm") }))
    })
    expect(await within(removal).findByText(text("errors.moderation_desk_last_admin"))).toBeInTheDocument()
    expect(fake.setResponsibleRole).toHaveBeenLastCalledWith({ personId: ME, memberPersonId: ME, role: "member", reason: "Je quitte l'administration du réseau." })
    await user.click(within(removal).getByRole("button", { name: text("common.cancel") }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    await user.click(within(lineOf(block, "Ruth Fixture")).getByRole("button", { name: text("moderationDesk.responsibles.change") }))
    const change = await screen.findByRole("dialog", { name: text("moderationDesk.responsibles.changeTitle", { name: "Ruth Fixture" }) })
    expect(within(change).getByText(text("moderationDesk.responsibles.changeBody", {
      name: "Ruth Fixture",
      from: text("moderationDesk.responsibles.role.network_moderator"),
      to: text("moderationDesk.responsibles.role.network_admin"),
    }))).toBeInTheDocument()
    expect(within(change).queryByText(text("moderationDesk.responsibles.selfWarning"))).toBeNull()
    await user.type(within(change).getByLabelText(text("moderationDesk.decision.reason")), "Relève de l'administration pendant les congés.")
    await act(async () => {
      await user.click(within(change).getByRole("button", { name: text("moderationDesk.responsibles.changeConfirm") }))
    })
    await waitFor(() => expect(fake.setResponsibleRole).toHaveBeenLastCalledWith({
      personId: ME, memberPersonId: "person-ruth", role: "network_admin", reason: "Relève de l'administration pendant les congés.",
    }))
    expect(mocks.success).toHaveBeenCalledWith(translate("moderationDesk.responsibles.changed", { name: "Ruth Fixture", role: translate("moderationDesk.responsibles.role.network_admin") }))
  })
})

describe("Guichet — pages à vérifier (AS-01)", () => {
  /** La carte d'une demande dans la file, par le nom de sa page. */
  function cardOf(name: string): HTMLElement {
    const card = screen.getByRole("heading", { name }).closest("li")
    if (!card) throw new Error(`carte absente : ${name}`)
    return card
  }

  it("n'offre pas l'onglet à un membre d'équipe sans rôle de réseau, et ne lit rien pour lui même par l'adresse", () => {
    mocks.params = new URLSearchParams("onglet=pages")
    const fake = fakeDesk({ view: ready({ ...MODERATOR, role: "team_member", networkWide: false, canReviewClaims: false }) })
    mocks.desk = fake.desk
    render(tree())
    const nav = screen.getByRole("navigation", { name: text("moderationDesk.tabsLabel") })
    expect(within(nav).queryByRole("link", { name: text("moderationDesk.tab.claims") })).toBeNull()
    expect(screen.getByText(text("moderationDesk.claims.restricted"))).toBeInTheDocument()
    expect(fake.claimReads).toEqual([])
  })

  it("liste les demandes par pays de la page et transmet le filtre ; le conflit d'intérêts se dit sur la carte", async () => {
    mocks.params = new URLSearchParams("onglet=pages")
    const fake = fakeDesk()
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    const nav = screen.getByRole("navigation", { name: text("moderationDesk.tabsLabel") })
    expect(within(nav).getByRole("link", { name: text("moderationDesk.tab.claims") })).toHaveAttribute("aria-current", "page")
    expect(fake.claimReads.at(-1)).toMatchObject({ personId: ME, zone: { kind: "all" }, cursor: null })
    const free = cardOf(CLAIM.page.name)
    expect(within(free).getByText(text("moderationDesk.claims.evidenceCount", { count: 3 }), { exact: false })).toBeInTheDocument()
    expect(within(free).getByRole("button", { name: text("moderationDesk.claims.open") })).toBeInTheDocument()
    const party = cardOf(PARTY_CLAIM.page.name)
    expect(within(party).getByText(text("moderationDesk.claims.party.page"))).toBeInTheDocument()
    expect(within(party).getByRole("button", { name: text("moderationDesk.claims.view") })).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText(text("moderationDesk.filters.zone")), "FR")
    expect(fake.claimReads.at(-1)).toMatchObject({ zone: { kind: "country", country: "FR" } })
  })

  it("instruit une demande : pièces servies par la garde, issue et motif exigés, décision transmise", async () => {
    mocks.params = new URLSearchParams("onglet=pages")
    const fake = fakeDesk()
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    await user.click(within(cardOf(CLAIM.page.name)).getByRole("button", { name: text("moderationDesk.claims.open") }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Awa Fixture (@awa.fixture)")).toBeInTheDocument()
    expect(within(dialog).getByText(CLAIM_DETAIL.note ?? "")).toBeInTheDocument()
    expect(within(dialog).getByText(text("moderationDesk.claims.evidencePending", { index: 1 }))).toBeInTheDocument()
    expect(within(dialog).getByRole("link", { name: text("moderationDesk.claims.evidenceOpen", { index: 2 }) })).toHaveAttribute("href", "https://depot.exemple.test/piece")
    expect(within(dialog).getByText(text("moderationDesk.claims.evidenceBlocked", { index: 3 }))).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.claims.submit") }))
    expect(await within(dialog).findByText(text("errors.moderation_desk_outcome_required"))).toBeInTheDocument()
    expect(within(dialog).getByText(text("errors.moderation_desk_reason_length", DESK_ERROR_VALUES))).toBeInTheDocument()
    expect(fake.decideClaim).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole("radio", { name: named("moderationDesk.claims.decision.approved") }))
    await user.type(within(dialog).getByLabelText(text("moderationDesk.decision.reason")), "Statuts et procès-verbal conformes.")
    await act(async () => {
      await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.claims.submit") }))
    })
    await waitFor(() => expect(fake.decideClaim).toHaveBeenCalledExactlyOnceWith({ personId: ME, claimId: CLAIM.claimId, decision: "approved", reason: "Statuts et procès-verbal conformes." }))
    expect(mocks.success).toHaveBeenCalledWith(translate("moderationDesk.claims.decided.approved", { page: CLAIM.page.name }))
  })

  it("n'offre aucun formulaire à un signataire de la page, ni quand le serveur dit que la personne ne peut pas trancher", async () => {
    mocks.params = new URLSearchParams("onglet=pages")
    const fake = fakeDesk()
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    await user.click(within(cardOf(PARTY_CLAIM.page.name)).getByRole("button", { name: text("moderationDesk.claims.view") }))
    let dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(text("moderationDesk.claims.party.title"))).toBeInTheDocument()
    expect(within(dialog).queryByRole("button", { name: text("moderationDesk.claims.submit") })).toBeNull()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    await user.click(within(cardOf(SERVER_REFUSED_CLAIM.page.name)).getByRole("button", { name: text("moderationDesk.claims.open") }))
    dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(text("moderationDesk.claims.party.server"))).toBeInTheDocument()
    expect(within(dialog).queryByRole("radio")).toBeNull()
    expect(fake.decideClaim).not.toHaveBeenCalled()
  })
})

describe("Guichet — réglages de modération (MD-04)", () => {
  it("n'offre pas l'onglet « Réglages » à un modérateur, et ne lit rien pour lui même par l'adresse", () => {
    mocks.params = new URLSearchParams("onglet=reglages")
    const fake = fakeDesk()
    mocks.desk = fake.desk
    render(tree())
    const nav = screen.getByRole("navigation", { name: text("moderationDesk.tabsLabel") })
    expect(within(nav).queryByRole("link", { name: text("moderationDesk.tab.settings") })).toBeNull()
    expect(screen.getByText(text("moderationDesk.settings.restricted"))).toBeInTheDocument()
    expect(fake.settingsReads).toEqual([])
    expect(screen.queryByRole("heading", { name: text("moderationDesk.settings.terms.title") })).toBeNull()
  })

  it("dit ce qui vaut sans réglage en lisant les défauts servis, et les contenus relus d'office", () => {
    mocks.params = new URLSearchParams("onglet=reglages")
    const fake = fakeDesk({ view: ready(ADMIN) })
    mocks.desk = fake.desk
    render(tree())
    const nav = screen.getByRole("navigation", { name: text("moderationDesk.tabsLabel") })
    expect(within(nav).getByRole("link", { name: text("moderationDesk.tab.settings") })).toHaveAttribute("aria-current", "page")
    expect(fake.settingsReads).toContain(ME)
    // Les nombres viennent des défauts servis (fixture : 3 liens, 12 écritures en 2 heures), jamais du texte.
    expect(screen.getByText(text("moderationDesk.settings.defaults.links", { count: 3 }))).toBeInTheDocument()
    expect(screen.getByText(text("moderationDesk.settings.defaults.writes", { count: 12, window: translate("moderationDesk.settings.window.hours", { count: 2 }) }))).toBeInTheDocument()
    for (const content of ["associationEvents", "reviews", "reviewReplies", "eventGallery"]) {
      expect(screen.getByText(text(`moderationDesk.settings.held.${content}`))).toBeInTheDocument()
    }
    // Les rubriques de DIASPORALE seules : « Évènement » sans réglage dit sa relecture d'office ; l'offre de boutique n'est pas montrée.
    const event = screen.getByRole("heading", { name: text("moderationDesk.surface.event") }).closest("li")
    if (!event) throw new Error("ligne « Évènement » absente")
    expect(within(event).getByText(text("moderationDesk.settings.without.defaults"))).toBeInTheDocument()
    expect(within(event).getByText(text("moderationDesk.settings.heldNote.associationEvents"))).toBeInTheDocument()
    const jobs = screen.getByRole("heading", { name: text("moderationDesk.surface.diasporaJobOffer") }).closest("li")
    if (!jobs) throw new Error("ligne « Offre d'emploi de la diaspora » absente")
    expect(within(jobs).getByText(text("moderationDesk.settings.policy.links", { count: 1 }))).toBeInTheDocument()
    expect(within(jobs).getByText(text("moderationDesk.settings.policy.writes", { count: 5, window: translate("moderationDesk.settings.window.minutes", { count: 10 }) }))).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: text("moderationDesk.surface.commerceOffer") })).toBeNull()
    expect(screen.getByText(TERM.term)).toBeInTheDocument()
  })

  it("pose un réglage motivé : motif exigé, valeurs et motif transmis au moteur qui le journalise", async () => {
    mocks.params = new URLSearchParams("onglet=reglages")
    const fake = fakeDesk({ view: ready(ADMIN) })
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    const event = screen.getByRole("heading", { name: text("moderationDesk.surface.event") }).closest("li")
    if (!event) throw new Error("ligne « Évènement » absente")
    await user.click(within(event).getByRole("button", { name: text("moderationDesk.settings.policy.set") }))
    // Le titre porte des espaces insécables : la feuille se trouve par son rôle, son titre se lit dedans.
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(text("moderationDesk.settings.sheet.title", { surface: translate("moderationDesk.surface.event") }))).toBeInTheDocument()
    // Le formulaire part des défauts servis ; il dit qu'il lève la relecture d'office des évènements d'association.
    expect(within(dialog).getByLabelText(text("moderationDesk.settings.sheet.maxLinks"))).toHaveValue(3)
    expect(within(dialog).getByLabelText(text("moderationDesk.settings.sheet.window"))).toHaveValue(120)
    expect(within(dialog).getByText(text("moderationDesk.settings.sheet.liftsHeld.associationEvents"))).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.settings.sheet.submit") }))
    expect(await within(dialog).findByText(text("errors.moderation_desk_reason_length", DESK_ERROR_VALUES))).toBeInTheDocument()
    expect(fake.setPolicy).not.toHaveBeenCalled()
    await user.click(within(dialog).getByLabelText(text("moderationDesk.settings.sheet.preReview")))
    const links = within(dialog).getByLabelText(text("moderationDesk.settings.sheet.maxLinks"))
    await user.clear(links)
    await user.type(links, "1")
    await user.type(within(dialog).getByLabelText(text("moderationDesk.decision.reason")), "Relecture des évènements au lancement du pilote.")
    await act(async () => {
      await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.settings.sheet.submit") }))
    })
    await waitFor(() => expect(fake.setPolicy).toHaveBeenCalledExactlyOnceWith({
      personId: ME, surface: "event", preReview: true, maxLinks: 1, maxWrites: 12, windowMs: 2 * 60 * MINUTE, reason: "Relecture des évènements au lancement du pilote.",
    }))
    expect(mocks.success).toHaveBeenCalledWith(translate("moderationDesk.settings.sheet.saved", { surface: translate("moderationDesk.surface.event") }))
  })

  it("refuse une valeur hors des bornes du moteur avant tout envoi", async () => {
    mocks.params = new URLSearchParams("onglet=reglages")
    const fake = fakeDesk({ view: ready(ADMIN) })
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    const jobs = screen.getByRole("heading", { name: text("moderationDesk.surface.diasporaJobOffer") }).closest("li")
    if (!jobs) throw new Error("ligne absente")
    await user.click(within(jobs).getByRole("button", { name: text("moderationDesk.settings.policy.change") }))
    const dialog = await screen.findByRole("dialog")
    const links = within(dialog).getByLabelText(text("moderationDesk.settings.sheet.maxLinks"))
    await user.clear(links)
    await user.type(links, String(DESK_ERROR_VALUES.linksMax + 1))
    await user.type(within(dialog).getByLabelText(text("moderationDesk.decision.reason")), "Plafond de liens trop large pour le test.")
    await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.settings.sheet.submit") }))
    expect(await within(dialog).findByText(text("errors.moderation_desk_links_bounds", DESK_ERROR_VALUES))).toBeInTheDocument()
    expect(fake.setPolicy).not.toHaveBeenCalled()
  })

  it("bloque un mot par un geste motivé, puis débloque un mot de la liste", async () => {
    mocks.params = new URLSearchParams("onglet=reglages")
    const fake = fakeDesk({ view: ready(ADMIN) })
    mocks.desk = fake.desk
    const user = userEvent.setup()
    render(tree())
    const block = screen.getByRole("heading", { name: text("moderationDesk.settings.terms.title") }).closest("section")
    if (!block) throw new Error("bloc des mots bloqués absent")
    await user.type(within(block).getByLabelText(text("moderationDesk.settings.terms.term")), "Ambassade")
    await user.type(within(block).getByLabelText(text("moderationDesk.decision.reason")), "Nom réservé aux postes diplomatiques.")
    await act(async () => {
      await user.click(within(block).getByRole("button", { name: text("moderationDesk.settings.terms.add") }))
    })
    await waitFor(() => expect(fake.setBlockedTerm).toHaveBeenCalledExactlyOnceWith({ personId: ME, term: "Ambassade", active: true, reason: "Nom réservé aux postes diplomatiques." }))
    expect(mocks.success).toHaveBeenCalledWith(translate("moderationDesk.settings.terms.added", { term: "ambassade" }))

    await user.click(within(block).getByRole("button", { name: text("moderationDesk.settings.terms.remove") }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText(text("moderationDesk.settings.terms.removeTitle", { term: TERM.term }))).toBeInTheDocument()
    await user.type(within(dialog).getByLabelText(text("moderationDesk.decision.reason")), "Le mot ne vise plus aucune usurpation.")
    await act(async () => {
      await user.click(within(dialog).getByRole("button", { name: text("moderationDesk.settings.terms.removeConfirm") }))
    })
    await waitFor(() => expect(fake.setBlockedTerm).toHaveBeenLastCalledWith({ personId: ME, term: TERM.term, active: false, reason: "Le mot ne vise plus aucune usurpation." }))
  })
})

describe("Guichet — rôle posé puis retiré, effet au rendu suivant (LX-03)", () => {
  it("un administrateur nommé voit les recours et les responsables ; rétrogradé il les perd, retiré le guichet se dit indisponible", () => {
    mocks.params = new URLSearchParams("onglet=equipe")
    const fake = fakeDesk()
    let current: Loadable<ModerationDeskView | null> = ready(ADMIN)
    mocks.desk = { ...fake.desk, useDesk: () => current } satisfies ModerationDeskCapability
    const { rerender } = render(tree())
    const links = () => within(screen.getByRole("navigation", { name: text("moderationDesk.tabsLabel") })).getAllByRole("link").map((link) => link.getAttribute("href"))
    expect(links()).toEqual(["/moderation?onglet=file", "/moderation?onglet=pages", "/moderation?onglet=recours", "/moderation?onglet=equipe", "/moderation?onglet=reglages"])
    expect(screen.getByRole("heading", { name: text("moderationDesk.responsibles.title") })).toBeInTheDocument()

    // Rétrogradé à la modération du réseau : plus de recours, plus de nomination ; la file reste.
    current = ready(MODERATOR)
    rerender(tree())
    expect(links()).toEqual(["/moderation?onglet=file", "/moderation?onglet=pages", "/moderation?onglet=equipe"])
    expect(screen.queryByRole("heading", { name: text("moderationDesk.responsibles.title") })).toBeNull()

    // Retiré, sans équipe : le refus indistinct du guichet, rien n'est révélé.
    current = ready(null)
    rerender(tree())
    expect(screen.getByText(text("moderationDesk.unavailable.title"))).toBeInTheDocument()
    expect(screen.queryByRole("navigation", { name: text("moderationDesk.tabsLabel") })).toBeNull()
  })
})
