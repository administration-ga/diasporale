// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { formatDate } from "@diasporale/features"
import type {
  ActionResult,
  DataExportFile,
  DataExportOptions,
  DataRightsCapability,
  DecisionsQuery,
  ErasureView,
  LastExportView,
  Loadable,
  MembershipView,
  ModerationDecisionView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useSyncExternalStore } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataRightsSettings } from "./data-rights-settings"

const mocks = vi.hoisted(() => ({ rights: null as unknown }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...(await original<typeof import("@diasporale/features/data")>()),
  useDataRights: () => mocks.rights,
}))

const translate = getFixedT("fr")
/**
 * Les textes attendus : normalisés comme Testing Library normalise le texte du DOM (insécables
 * comprises) ; les noms accessibles, eux, se comparent tels quels (`raw`).
 */
const raw = (key: string, values?: Record<string, unknown>) => String(translate(key, values))
const t = (key: string, values?: Record<string, unknown>) => String(translate(key, values)).replace(/\s+/g, " ")
const NOW = Date.UTC(2026, 9, 17, 12)
const DAY = 24 * 60 * 60 * 1000

const membership: MembershipView = {
  personId: "person_lecture",
  handle: "lecture.demo",
  displayName: "Lecteur fictif",
  status: "declaree",
  badges: [],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: null,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "standard",
  directoryVisibility: "hidden",
}

const DECISION: ModerationDecisionView = {
  reportId: "report-1",
  network: "diasporale",
  surface: "post",
  ground: "harassment",
  status: "actioned",
  level: "team",
  createdAt: NOW - 2 * DAY,
  decisionReason: "Propos insultants répétés.",
  sanctions: [{ kind: "suspension", status: "active", until: NOW + 5 * DAY, reason: "Propos insultants répétés." }],
  appeals: [],
  appealLevel: "network",
}

const ready = <T,>(data: T): Loadable<T> => ({ status: "ready", data })
const page = (items: readonly ModerationDecisionView[]): DecisionsQuery => ready({ items, continueCursor: null, isDone: true })

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => { resolve = settle })
  return { promise, resolve }
}

/** Une capacité factice, réactive comme les vraies (relecture après chaque `update`). */
function fakeRights(initial: { erasure?: Loadable<ErasureView>; decisions?: DecisionsQuery; last?: LastExportView | null } = {}) {
  const state = { erasure: initial.erasure ?? ready<ErasureView>({ state: "none" }), decisions: initial.decisions ?? page([]), last: initial.last ?? null }
  const listeners = new Set<() => void>()
  let version = 0
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }
  const useVersion = () => useSyncExternalStore(subscribe, () => version)
  const update = (patch: Partial<typeof state>) => {
    Object.assign(state, patch)
    version += 1
    for (const listener of listeners) listener()
  }
  const reads: string[] = []
  const rights = {
    useErasure: (personId: string) => { useVersion(); reads.push(`erasure:${personId}`); return state.erasure },
    requestErasure: vi.fn<(personId: string) => Promise<ActionResult<{ dueAt: number }>>>(async () => ({ ok: true, value: { dueAt: NOW + 30 * DAY } })),
    cancelErasure: vi.fn<(personId: string) => Promise<ActionResult>>(async () => ({ ok: true, value: null })),
    prepareExport: vi.fn<(personId: string, options?: DataExportOptions) => Promise<ActionResult<DataExportFile>>>(async () => ({ ok: true, value: { json: "{\"format\":\"essai\"}", exportedAt: NOW } })),
    useLastExport: (personId: string) => { useVersion(); reads.push(`last:${personId}`); return state.last },
    useDecisions: (args: { personId: string; cursor: string | null }) => { useVersion(); reads.push(`decisions:${args.personId}:${args.cursor ?? ""}`); return state.decisions },
    fileAppeal: vi.fn<(input: { personId: string; reportId: string; reason: string }) => Promise<ActionResult<{ created: boolean }>>>(async () => ({ ok: true, value: { created: true } })),
  } satisfies DataRightsCapability
  return { rights, update, reads }
}

const tree = (member: MembershipView = membership) => <I18nProvider locale="fr"><DataRightsSettings membership={member} /></I18nProvider>
const section = () => screen.getByRole("region", { name: raw("settings.data") })

let clicked: { download: string; href: string }[] = []
const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:local-1")
const revokeObjectURL = vi.fn<(url: string) => void>()

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] })
  mocks.rights = null
  clicked = []
  createObjectURL.mockClear()
  revokeObjectURL.mockClear()
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL, configurable: true, writable: true })
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL, configurable: true, writable: true })
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push({ download: this.download, href: this.href })
  })
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("Mes données — section et accès", () => {
  it("garde l'ancre « mes-donnees » et se dit indisponible sans capacité", () => {
    render(tree())
    expect(section()).toHaveAttribute("id", "mes-donnees")
    expect(screen.getByRole("heading", { level: 2, name: raw("settings.data") })).toBeInTheDocument()
    expect(screen.getByText(t("settings.dataRights.unavailable"))).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("ouvre les trois volets à un membre suspendu, sans lien vers une surface sociale", () => {
    const { rights, reads } = fakeRights({ decisions: page([DECISION]) })
    mocks.rights = rights
    render(tree({ ...membership, status: "suspendue", canPublish: false, root: { ...membership.root, status: "suspendue" } }))
    expect(screen.getByRole("button", { name: raw("settings.export") })).toBeEnabled()
    expect(screen.getByRole("button", { name: raw("settings.delete") })).toBeEnabled()
    expect(screen.getByRole("button", { name: raw("settings.dataRights.decisions.appeal") })).toBeEnabled()
    expect(within(section()).queryAllByRole("link")).toEqual([])
    expect(new Set(reads)).toEqual(new Set(["last:person_lecture", "erasure:person_lecture", "decisions:person_lecture:"]))
  })
})

describe("Mes données — export", () => {
  it("montre la progression puis enregistre le fichier par une adresse locale aussitôt révoquée", async () => {
    const { rights, update } = fakeRights()
    mocks.rights = rights
    const pending = deferred<ActionResult<DataExportFile>>()
    rights.prepareExport.mockImplementationOnce(async (_personId, options) => {
      options?.onProgress?.({ done: 1, total: 3 })
      return pending.promise
    })
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: raw("settings.export") }))
    expect(rights.prepareExport).toHaveBeenCalledWith("person_lecture", expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(await screen.findByText(t("settings.dataRights.export.progress", { done: 1, total: 3 }))).toBeInTheDocument()
    expect(screen.getByLabelText(t("settings.dataRights.export.progressLabel"))).toHaveAttribute("value", "1")
    expect(screen.getByRole("button", { name: raw("settings.export") })).toBeDisabled()
    await act(async () => { pending.resolve({ ok: true, value: { json: "{\"format\":\"essai\"}", exportedAt: NOW } }) })
    expect(screen.getByRole("status")).toHaveTextContent(t("settings.exported"))
    expect(clicked).toEqual([{ download: "diasporale-lecture.demo-2026-10-17.json", href: "blob:local-1" }])
    const blob = createObjectURL.mock.calls[0]![0]
    expect(blob.type).toBe("application/json")
    expect(await blob.text()).toBe("{\"format\":\"essai\"}")
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:local-1"))
    act(() => update({ last: { exportedAt: NOW } }))
    expect(screen.getByText(t("settings.dataRights.export.last", { date: formatDate(NOW, "fr", { dateStyle: "long", timeStyle: "short" }) }))).toBeInTheDocument()
  })

  it("s'interrompt au geste de la personne, sans fichier", async () => {
    const { rights } = fakeRights()
    mocks.rights = rights
    rights.prepareExport.mockImplementationOnce((_personId, options) => new Promise((resolve) => {
      options?.signal?.addEventListener("abort", () => resolve({ ok: false, code: "export_cancelled" }))
    }))
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: raw("settings.export") }))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.export.stop") })) })
    expect(screen.getByRole("status")).toHaveTextContent(t("errors.export_cancelled"))
    expect(clicked).toEqual([])
    expect(screen.getByRole("button", { name: raw("settings.export") })).toBeEnabled()
  })

  it("dit un refus fermé et n'enregistre aucun fichier partiel", async () => {
    const { rights } = fakeRights()
    mocks.rights = rights
    rights.prepareExport.mockResolvedValueOnce({ ok: false, code: "export_expired" })
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: raw("settings.export") })) })
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.export_expired"))
    expect(createObjectURL).not.toHaveBeenCalled()
    expect(clicked).toEqual([])
  })
})

describe("Mes données — effacement", () => {
  it("n'envoie la demande qu'après une confirmation explicite qui dit portée, grâce et départ distinct", async () => {
    const { rights, update } = fakeRights()
    mocks.rights = rights
    render(tree())
    expect(within(section()).getByText(t("settings.dataRights.erasure.leaveInstead"))).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: raw("settings.delete") }))
    let dialog = screen.getByRole("dialog", { name: raw("settings.deleteConfirmTitle") })
    expect(within(dialog).getByText(t("settings.dataRights.erasure.scope"))).toBeInTheDocument()
    expect(within(dialog).getByText(t("settings.dataRights.erasure.grace", { days: 30, date: formatDate(NOW + 30 * DAY, "fr") }))).toBeInTheDocument()
    expect(within(dialog).getByText(t("settings.dataRights.erasure.final"))).toBeInTheDocument()
    expect(within(dialog).getByText(t("settings.dataRights.erasure.leaveInstead"))).toBeInTheDocument()
    expect(within(dialog).getByText(t("settings.deleteConfirmBody"))).toBeInTheDocument()
    const confirm = within(dialog).getByRole("button", { name: raw("settings.dataRights.erasure.confirm") })
    expect(confirm).toBeDisabled()
    fireEvent.click(confirm)
    fireEvent.click(within(dialog).getByRole("button", { name: raw("common.cancel") }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(rights.requestErasure).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: raw("settings.delete") }))
    dialog = screen.getByRole("dialog")
    expect(within(dialog).getByRole("checkbox", { name: raw("settings.deleteAcknowledge") })).not.toBeChecked()
    fireEvent.click(within(dialog).getByRole("checkbox", { name: raw("settings.deleteAcknowledge") }))
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: raw("settings.dataRights.erasure.confirm") })) })
    expect(rights.requestErasure).toHaveBeenCalledTimes(1)
    expect(rights.requestErasure).toHaveBeenCalledWith("person_lecture")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(t("settings.dataRights.erasure.requested", { date: formatDate(NOW + 30 * DAY, "fr") }))
    act(() => update({ erasure: ready({ state: "grace", requestedAt: NOW, dueAt: NOW + 30 * DAY }) }))
    expect(screen.getByText(t("settings.dataRights.erasure.daysLeft", { count: 30 }))).toBeInTheDocument()
    expect(screen.getByRole("button", { name: raw("settings.dataRights.erasure.cancel") })).toBeEnabled()
    await waitFor(() => expect(document.activeElement).toContainElement(screen.getByRole("button", { name: raw("settings.dataRights.erasure.cancel") })))
  })

  it("garde la feuille ouverte et dit le refus du moteur", async () => {
    const { rights } = fakeRights()
    mocks.rights = rights
    rights.requestErasure.mockResolvedValueOnce({ ok: false, code: "rate_limited" })
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: raw("settings.delete") }))
    const dialog = screen.getByRole("dialog")
    fireEvent.click(within(dialog).getByRole("checkbox"))
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: raw("settings.dataRights.erasure.confirm") })) })
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(t("errors.rate_limited"))
  })

  it("annule pendant la grâce, avec le compte à rebours de l'appareil", async () => {
    const { rights, update } = fakeRights({ erasure: ready({ state: "grace", requestedAt: NOW - 27 * DAY, dueAt: NOW + 3 * DAY }) })
    mocks.rights = rights
    render(tree())
    expect(screen.getByText(t("settings.dataRights.erasure.pending", { requested: formatDate(NOW - 27 * DAY, "fr"), due: formatDate(NOW + 3 * DAY, "fr") }))).toBeInTheDocument()
    expect(screen.getByText(t("settings.dataRights.erasure.daysLeft", { count: 3 }))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: raw("settings.delete") })).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.erasure.cancel") })) })
    expect(rights.cancelErasure).toHaveBeenCalledWith("person_lecture")
    expect(screen.getByRole("status")).toHaveTextContent(t("settings.dataRights.erasure.cancelled"))
    act(() => update({ erasure: ready({ state: "none" }) }))
    expect(screen.getByRole("button", { name: raw("settings.delete") })).toBeEnabled()
  })

  it("dit l'annulation impossible une fois la grâce passée", async () => {
    const { rights } = fakeRights({ erasure: ready({ state: "grace", requestedAt: NOW - 29 * DAY, dueAt: NOW + DAY / 2 }) })
    mocks.rights = rights
    rights.cancelErasure.mockResolvedValueOnce({ ok: false, code: "erasure_not_cancellable" })
    render(tree())
    expect(screen.getByText(t("settings.dataRights.erasure.daysLeft", { count: 1 }))).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.erasure.cancel") })) })
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.erasure_not_cancellable"))
  })

  it("une grâce échue à l'heure de l'appareil se lit « en cours », sans annulation", () => {
    const { rights } = fakeRights({ erasure: ready({ state: "grace", requestedAt: NOW - 31 * DAY, dueAt: NOW - DAY }) })
    mocks.rights = rights
    render(tree())
    expect(screen.getByText(t("settings.dataRights.erasure.processing"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: raw("settings.dataRights.erasure.cancel") })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: raw("settings.delete") })).not.toBeInTheDocument()
  })

  it("dit l'état illisible sans rien proposer", () => {
    const { rights } = fakeRights({ erasure: { status: "error", code: "unknown" } })
    mocks.rights = rights
    render(tree())
    expect(screen.getByText(t("settings.dataRights.erasure.loadError"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: raw("settings.delete") })).not.toBeInTheDocument()
  })

  it("ignore une réponse tardive après un changement de personne", async () => {
    const { rights } = fakeRights()
    mocks.rights = rights
    const pending = deferred<ActionResult<{ dueAt: number }>>()
    rights.requestErasure.mockReturnValueOnce(pending.promise)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: raw("settings.delete") }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("checkbox"))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: raw("settings.dataRights.erasure.confirm") }))
    view.rerender(tree({ ...membership, personId: "nouvelle-personne", handle: "nouveau.demo" }))
    await act(async () => { pending.resolve({ ok: true, value: { dueAt: NOW + 30 * DAY } }) })
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})

describe("Mes données — décisions et recours", () => {
  it("dit l'absence de décision", () => {
    const { rights } = fakeRights()
    mocks.rights = rights
    render(tree())
    expect(screen.getByText(t("settings.dataRights.decisions.empty"))).toBeInTheDocument()
  })

  it("montre réseau, motif, décision motivée et mesures, sans lien vers le contenu", () => {
    const { rights } = fakeRights({ decisions: page([DECISION]) })
    mocks.rights = rights
    render(tree())
    const item = within(screen.getByRole("region", { name: raw("settings.dataRights.decisions.title") })).getAllByRole("listitem")[0]!
    expect(item).toHaveTextContent(t("settings.dataRights.decisions.surface.post"))
    expect(item).toHaveTextContent(t("settings.dataRights.decisions.status.actioned"))
    expect(item).toHaveTextContent(t("settings.dataRights.decisions.network", { name: raw("brand.name") }))
    expect(item).toHaveTextContent(t("settings.dataRights.decisions.ground", { ground: t("report.reason.harassment") }))
    expect(item).toHaveTextContent(t("settings.dataRights.decisions.decisionReason", { reason: DECISION.decisionReason! }))
    expect(item).toHaveTextContent(t("settings.dataRights.decisions.sanction.suspension"))
    expect(item).toHaveTextContent(t("settings.dataRights.decisions.sanctionUntil", { date: formatDate(NOW + 5 * DAY, "fr") }))
    expect(within(item).queryAllByRole("link")).toEqual([])
  })

  it("borne le motif du recours avant tout envoi, puis l'envoie rogné", async () => {
    const { rights } = fakeRights({ decisions: page([DECISION]) })
    mocks.rights = rights
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.decisions.appeal") }))
    expect(screen.getByText(t("settings.dataRights.decisions.appealHint.network"))).toBeInTheDocument()
    const field = screen.getByRole("textbox", { name: raw("settings.dataRights.decisions.appealReason") })
    expect(document.activeElement).toBe(field)
    fireEvent.change(field, { target: { value: " ab " } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.decisions.appealSubmit") })) })
    expect(screen.getByText(t("errors.appeal_reason_length", { min: 3, max: 500 }))).toBeInTheDocument()
    expect(rights.fileAppeal).not.toHaveBeenCalled()
    fireEvent.change(field, { target: { value: "  Le contexte a été mal lu.  " } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.decisions.appealSubmit") })) })
    expect(rights.fileAppeal).toHaveBeenCalledWith({ personId: "person_lecture", reportId: "report-1", reason: "Le contexte a été mal lu." })
    expect(screen.getByRole("status")).toHaveTextContent(t("settings.dataRights.decisions.appealSent"))
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
  })

  it("dit un recours déjà enregistré et un refus du moteur", async () => {
    const { rights } = fakeRights({ decisions: page([DECISION]) })
    mocks.rights = rights
    rights.fileAppeal.mockResolvedValueOnce({ ok: true, value: { created: false } }).mockResolvedValueOnce({ ok: false, code: "rate_limited" })
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.decisions.appeal") }))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Contestation motivée." } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.decisions.appealSubmit") })) })
    expect(screen.getByRole("status")).toHaveTextContent(t("settings.dataRights.decisions.appealExists"))
    fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.decisions.appeal") }))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Contestation motivée." } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.decisions.appealSubmit") })) })
    expect(screen.getByRole("alert")).toHaveTextContent(t("errors.rate_limited"))
    expect(screen.getByRole("textbox")).toBeInTheDocument()
  })

  it("montre la réponse du réseau et ouvre le recours de plateforme", () => {
    const upheld: ModerationDecisionView = {
      ...DECISION,
      network: "antsia",
      appeals: [{ level: "network", status: "upheld", decisionReason: "Décision maintenue après relecture." }],
      appealLevel: "platform",
    }
    const { rights } = fakeRights({ decisions: page([upheld]) })
    mocks.rights = rights
    render(tree())
    expect(screen.getByText(t("settings.dataRights.decisions.network", { name: raw("settings.rootName") }), { exact: false })).toBeInTheDocument()
    expect(screen.getByText(t("settings.dataRights.decisions.appealLine", {
      level: t("settings.dataRights.decisions.appealLevel.network"),
      status: t("settings.dataRights.decisions.appealStatus.upheld"),
    }), { exact: false })).toBeInTheDocument()
    expect(screen.getByText(t("settings.dataRights.decisions.appealAnswer", { reason: "Décision maintenue après relecture." }))).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: raw("settings.dataRights.decisions.appeal") }))
    expect(screen.getByText(t("settings.dataRights.decisions.appealHint.platform"))).toBeInTheDocument()
  })

  it("ne propose aucun recours sans décision suivie d'effet", () => {
    const { rights } = fakeRights({ decisions: page([{ ...DECISION, status: "dismissed", sanctions: [], appealLevel: null }]) })
    mocks.rights = rights
    render(tree())
    expect(screen.getByText(t("settings.dataRights.decisions.status.dismissed"))).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: raw("settings.dataRights.decisions.appeal") })).not.toBeInTheDocument()
  })

  it("dit les décisions illisibles", () => {
    const { rights } = fakeRights({ decisions: { status: "error", code: "unknown" } })
    mocks.rights = rights
    render(tree())
    expect(screen.getByText(t("settings.dataRights.decisions.loadError"))).toBeInTheDocument()
  })
})
