// @vitest-environment jsdom
import {
  contentReportKey,
  DataSourceProvider,
  type ActionResult,
  type AidAnswerView,
  type AidListPage,
  type AidQuestionDetailView,
  type ArrivalKitCapability,
  type ArrivalKitResourceDetailView,
  type ContentReportInput,
  type ContentReportsCapability,
  type ContentReportTarget,
  type DiasporaleDataSource,
  type Loadable,
  type MentoringCapability,
  type MentoringRequestSummaryView,
  type MutualAidCapability,
  type TalentHitView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useSyncExternalStore, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ArrivalKitResourceActions } from "./arrival-kit-actions"
import { TalentHitCard } from "./job-parts"
import { MentoringRequestCard } from "./mentoring-requests"
import { AidQuestionDetail } from "./mutual-aid-question-detail"

/**
 * Le geste « Signaler » monté dans chaque chantier de la vague H (G9) : entraide
 * (question, réponse), mentorat (demande reçue, côté mentor), kit d'arrivée (abus,
 * distinct de l'information périmée), emploi (profil de talent). Jamais sur son
 * propre contenu ; signalé, le contenu se masque pour la personne. Données fictives.
 */
const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}))

const t = getFixedT("fr")
/** Le texte tel que l'écran le lit (espaces insécables ramenées à l'espace simple). */
const plain = (value: string) => value.replace(/\s+/g, " ").trim()
const NOW = Date.UTC(2026, 9, 18, 9)
const DAY = 24 * 60 * 60 * 1000

/** Une capacité factice : sa mémoire des cibles signalées relance le rendu, comme les vrais fournisseurs. */
function fakeReports() {
  const reported = new Set<string>()
  const listeners = new Set<() => void>()
  let version = 0
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  const getVersion = () => version
  const report = vi.fn(async (input: ContentReportInput): Promise<ActionResult<{ readonly created: boolean }>> => {
    reported.add(contentReportKey(input))
    version += 1
    for (const listener of listeners) listener()
    return { ok: true, value: { created: true } }
  })
  function useReported(target: ContentReportTarget): boolean {
    useSyncExternalStore(subscribe, getVersion, getVersion)
    return reported.has(contentReportKey(target))
  }
  const capability: ContentReportsCapability = { demonstration: false, report, useReported }
  return { capability, report }
}

function mount(capability: ContentReportsCapability | null, node: ReactNode) {
  const source = (capability === null ? {} : { contentReports: capability }) as unknown as DiasporaleDataSource
  return render(
    <I18nProvider locale="fr">
      <DataSourceProvider source={source}>{node}</DataSourceProvider>
    </I18nProvider>,
  )
}

/** Ouvrir la feuille d'une nature, choisir un motif, confirmer. */
async function reportThrough(user: ReturnType<typeof userEvent.setup>, kind: ContentReportTarget["kind"], reason: "harassment" | "misinformation" | "other") {
  await user.click(screen.getByRole("button", { name: t(`contentReports.action.${kind}`) }))
  const dialog = await screen.findByRole("dialog", { name: t(`contentReports.title.${kind}`) })
  await user.click(within(dialog).getByRole("radio", { name: t(`report.reason.${reason}`) }))
  await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
  return dialog
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

// ── Entraide ─────────────────────────────────────────────────────────

const AUTHOR = { displayName: "Awa OGOOUÉ", handle: "awa.fictive" }
const HELPER = { displayName: "Steeve NGOUNIÉ", handle: "steeve.fictif" }
const QUESTION_VIEW: AidQuestionDetailView = {
  id: "question-1", title: "Faire traduire un acte de naissance (fictif)", detail: "", theme: "procedures", country: "FR", city: "Lyon",
  status: "open", answerCount: 1, hasAcceptedAnswer: false, author: AUTHOR, isMine: false, createdAt: NOW,
  version: 1, updatedAt: NOW, editedAt: null, acceptedAnswer: null, canAnswer: false, canEdit: false,
}
const ANSWER_VIEW: AidAnswerView = {
  id: "answer-1", questionId: "question-1", body: "Une réponse fictive de recette.", version: 1, author: HELPER,
  isMine: false, isAccepted: false, createdAt: NOW, editedAt: null,
}

function mutualAid(answer: AidAnswerView): MutualAidCapability {
  // Même référence d'une lecture à l'autre : le vrai pager est conservé.
  const page: Loadable<AidListPage<AidAnswerView>> = { status: "ready", data: { items: [answer], continueCursor: null, isDone: true } }
  return { useAnswers: () => page } as unknown as MutualAidCapability
}

describe("entraide — la question et ses réponses", () => {
  it("la question et la réponse d'autrui se signalent ; la réponse signalée se masque, la question reste", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mount(capability, <AidQuestionDetail capability={mutualAid(ANSWER_VIEW)} question={QUESTION_VIEW} />)
    expect(screen.getByRole("button", { name: t("contentReports.action.diasporaAidQuestion") })).toBeInTheDocument()
    expect(await screen.findByText(ANSWER_VIEW.body)).toBeInTheDocument()

    await reportThrough(user, "diasporaAidAnswer", "harassment")
    expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "diasporaAidAnswer", id: "answer-1", reason: "harassment" })
    expect(screen.queryByText(ANSWER_VIEW.body)).not.toBeInTheDocument()
    expect(screen.getByRole("note")).toHaveTextContent(plain(t("contentReports.masked.title")))
    expect(screen.getByRole("heading", { level: 1, name: QUESTION_VIEW.title })).toBeInTheDocument()
  })

  it("jamais sur son propre contenu : sa question, sa réponse", async () => {
    const { capability } = fakeReports()
    mount(capability, <AidQuestionDetail capability={mutualAid({ ...ANSWER_VIEW, isMine: true })} question={{ ...QUESTION_VIEW, isMine: true }} />)
    expect(await screen.findByText(ANSWER_VIEW.body)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("contentReports.action.diasporaAidQuestion") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("contentReports.action.diasporaAidAnswer") })).not.toBeInTheDocument()
  })
})

// ── Mentorat ─────────────────────────────────────────────────────────

const REQUEST: MentoringRequestSummaryView = {
  requestId: "request-1", status: "sent", viewerRole: "mentor", mentorId: "mentor-1",
  counterpart: { displayName: "Prisca ABANGA", handle: "prisca.fictive" }, domain: "studies", goal: "Préparer une inscription en master (fictif)",
  wishedSlots: [], timeZone: "Europe/Paris", slot: null, deadlineAt: null, createdAt: NOW, updatedAt: NOW,
}
const MENTORING = {} as unknown as MentoringCapability

describe("mentorat — la demande reçue", () => {
  it("le mentor signale une demande reçue ; elle se masque pour lui", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mount(capability, <MentoringRequestCard capability={MENTORING} summary={REQUEST} viewerTimeZone="Europe/Paris" />)
    await reportThrough(user, "diasporaMentoringRequest", "other")
    expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "diasporaMentoringRequest", id: "request-1", reason: "other" })
    expect(screen.queryByText(REQUEST.goal)).not.toBeInTheDocument()
    expect(screen.getByRole("note")).toHaveTextContent(plain(t("contentReports.masked.title")))
  })

  it("la personne mentorée ne signale pas sa propre demande", () => {
    const { capability } = fakeReports()
    mount(capability, <MentoringRequestCard capability={MENTORING} summary={{ ...REQUEST, viewerRole: "mentee" }} viewerTimeZone="Europe/Paris" />)
    expect(screen.getByText(REQUEST.goal)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("contentReports.action.diasporaMentoringRequest") })).not.toBeInTheDocument()
  })
})

// ── Kit d'arrivée ────────────────────────────────────────────────────

const RESOURCE: ArrivalKitResourceDetailView = {
  id: "kit-1", version: 2, revision: 1, title: "Ressource fictive", summary: "Un résumé fictif de la ressource.", category: "procedures",
  country: "FR", city: null, status: "published", reviewCause: null, lastVerifiedAt: NOW - DAY, reviewDueAt: NOW + 300 * DAY,
  revisedAt: NOW - DAY, reviewedAt: NOW, carrier: { kind: "person", person: { displayName: "Mireille IVINDO", handle: "mireille.fictive" } },
  official: false, body: "Un contenu fictif.", source: { name: "Portail fictif", url: null }, createdAt: NOW - DAY,
  submittedAt: NOW - DAY, reviewer: null, statusReason: null, outdatedFlags: null,
  viewer: { canManage: false, canReview: false, canFlag: true, hasFlagged: false },
}
const KIT = {} as unknown as ArrivalKitCapability

describe("kit d'arrivée — un abus, distinct de l'information périmée", () => {
  it("la ressource publiée d'autrui se signale par sa propre feuille, qui le dit", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mount(capability, <ArrivalKitResourceActions kit={KIT} resource={RESOURCE} onGone={() => undefined} />)
    expect(screen.getByRole("button", { name: t("arrivalKit.actions.flag") })).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: t("contentReports.action.diasporaKitResource") }))
    const dialog = await screen.findByRole("dialog", { name: t("contentReports.title.diasporaKitResource") })
    expect(within(dialog).getByText(plain(t("contentReports.kitHint")))).toBeInTheDocument()
    await user.click(within(dialog).getByRole("radio", { name: t("report.reason.misinformation") }))
    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))
    await waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "diasporaKitResource", id: "kit-1", reason: "misinformation" }))
  })

  it("jamais sur sa ressource, ni sur une ressource qui n'est pas publiée ; capacité absente, aucun geste", () => {
    const { capability } = fakeReports()
    const view = mount(capability, <ArrivalKitResourceActions kit={KIT} resource={{ ...RESOURCE, viewer: { ...RESOURCE.viewer, canManage: true } }} onGone={() => undefined} />)
    expect(screen.queryByRole("button", { name: t("contentReports.action.diasporaKitResource") })).not.toBeInTheDocument()
    view.unmount()

    const submitted = mount(capability, <ArrivalKitResourceActions kit={KIT} resource={{ ...RESOURCE, status: "submitted" }} onGone={() => undefined} />)
    expect(screen.queryByRole("button", { name: t("contentReports.action.diasporaKitResource") })).not.toBeInTheDocument()
    submitted.unmount()

    mount(null, <ArrivalKitResourceActions kit={KIT} resource={RESOURCE} onGone={() => undefined} />)
    expect(screen.getByRole("button", { name: t("arrivalKit.actions.flag") })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("contentReports.action.diasporaKitResource") })).not.toBeInTheDocument()
  })
})

// ── Emploi ───────────────────────────────────────────────────────────

const HIT: TalentHitView = { id: "talent-2", shortName: "Prisca A.", title: "Juriste (fictif)", skills: ["Droit des contrats"], availability: "immediate", languages: ["fr"], country: "FR", updatedAt: NOW }

describe("emploi — un profil de talent trouvé", () => {
  it("se signale ; signalé, la carte se masque pour la personne", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mount(capability, <TalentHitCard talent={HIT} />)
    expect(screen.getByText(HIT.title)).toBeInTheDocument()
    await reportThrough(user, "diasporaTalentProfile", "other")
    expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "diasporaTalentProfile", id: "talent-2", reason: "other" })
    expect(screen.queryByText(HIT.title)).not.toBeInTheDocument()
    expect(screen.getByRole("note")).toHaveTextContent(plain(t("contentReports.masked.title")))
  })

  it("hors de l'application (aucun fournisseur), la carte reste la même, sans geste", () => {
    render(<I18nProvider locale="fr"><TalentHitCard talent={HIT} /></I18nProvider>)
    expect(screen.getByText(HIT.title)).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })
})
