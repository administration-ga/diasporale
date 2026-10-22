// @vitest-environment jsdom
import {
  contentReportKey,
  DataSourceProvider,
  REPORT_REASONS,
  type ActionResult,
  type ContentReportInput,
  type ContentReportsCapability,
  type ContentReportTarget,
  type DiasporaleDataSource,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useSyncExternalStore } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { ReportContentAction, ReportedContent } from "./report-content-sheet"

/**
 * Le geste « Signaler » (G9), contre une capacité factice : capacité absente, motif
 * requis, envoi unique des arguments exacts, issue dite par sonner (envoyé, déjà
 * signalé, démonstration), refus traduit qui garde la feuille, clavier, focus rendu
 * au déclencheur ou passé à l'avis qui remplace le contenu. Données fictives.
 */
const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }))

const t = getFixedT("fr")
/** Le texte tel que l'écran le lit (espaces insécables ramenées à l'espace simple). */
const plain = (value: string) => value.replace(/\s+/g, " ").trim()

const QUESTION: ContentReportTarget = { kind: "diasporaAidQuestion", id: "question-1" }
const CONTENT = "Question fictive de recette"
const TRIGGER = t("contentReports.action.diasporaAidQuestion")

type ReportResult = ActionResult<{ readonly created: boolean }>

/** Une capacité factice : sa mémoire des cibles signalées relance le rendu, comme les vrais fournisseurs. */
function fakeReports(options: { readonly demonstration?: boolean } = {}) {
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
  const mark = (target: ContentReportTarget) => {
    reported.add(contentReportKey(target))
    version += 1
    for (const listener of listeners) listener()
  }
  const report = vi.fn(async (input: ContentReportInput): Promise<ReportResult> => {
    mark(input)
    return { ok: true, value: { created: true } }
  })
  function useReported(target: ContentReportTarget): boolean {
    useSyncExternalStore(subscribe, getVersion, getVersion)
    return reported.has(contentReportKey(target))
  }
  const capability: ContentReportsCapability = { demonstration: options.demonstration ?? false, report, useReported }
  return { capability, report, mark }
}

function mount(capability: ContentReportsCapability | null) {
  const source = (capability === null ? {} : { contentReports: capability }) as unknown as DiasporaleDataSource
  return render(
    <I18nProvider locale="fr">
      <DataSourceProvider source={source}>
        <ReportedContent target={QUESTION} back={{ href: routes.mutualAid(), label: t("mutualAid.backToList") }}>
          <p>{CONTENT}</p>
          <ReportContentAction target={QUESTION} />
        </ReportedContent>
      </DataSourceProvider>
    </I18nProvider>,
  )
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: TRIGGER }))
  return screen.findByRole("dialog", { name: t("contentReports.title.diasporaAidQuestion") })
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

describe("signaler un contenu de la vague H — la feuille", () => {
  it("capacité absente : ni bouton ni masque, le contenu reste tel quel", () => {
    mount(null)
    expect(screen.getByText(CONTENT)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: TRIGGER })).not.toBeInTheDocument()
  })

  it("le motif est requis : rien n'est envoyé sans lui ; le focus va d'abord au premier motif", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mount(capability)
    const dialog = await openSheet(user)
    expect(within(dialog).getByText(plain(t("contentReports.description")))).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole("radio", { name: t("report.reason.harassment") })).toHaveFocus())
    for (const radio of within(dialog).getAllByRole("radio")) expect(radio).not.toBeChecked()
    // SU01d : les douze motifs du moteur, ceux de l'ordonnance n° 0011/PR/2026 compris, et la suite annoncée.
    expect(within(dialog).getAllByRole("radio")).toHaveLength(REPORT_REASONS.length)
    expect(within(dialog).getByRole("radio", { name: t("report.reason.deepfake_of_me") })).toBeInTheDocument()
    expect(within(dialog).getByText(plain(t("report.followUp")))).toBeInTheDocument()

    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))
    expect(await within(dialog).findByText(plain(t("errors.report_reason_required")))).toBeInTheDocument()
    expect(report).not.toHaveBeenCalled()
  })

  it("envoie une fois les arguments exacts ; sonner le dit ; l'avis remplace le contenu et prend le focus", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mount(capability)
    const dialog = await openSheet(user)
    await user.click(within(dialog).getByRole("radio", { name: t("report.reason.misinformation") }))
    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "diasporaAidQuestion", id: "question-1", reason: "misinformation" })
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("contentReports.sent"))
    expect(screen.queryByText(CONTENT)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: TRIGGER })).not.toBeInTheDocument()
    const notice = screen.getByRole("note")
    expect(notice).toHaveTextContent(plain(t("contentReports.masked.body")))
    expect(within(notice).getByRole("link", { name: t("mutualAid.backToList") })).toHaveAttribute("href", routes.mutualAid())
    await waitFor(() => expect(notice).toHaveFocus())
  })

  it("déjà signalé (rejeu) : sonner le dit, rien n'est recréé, le contenu reste masqué", async () => {
    const user = userEvent.setup()
    const { capability, report, mark } = fakeReports()
    report.mockImplementationOnce(async (input) => {
      mark(input)
      return { ok: true, value: { created: false } }
    })
    mount(capability)
    const dialog = await openSheet(user)
    await user.click(within(dialog).getByRole("radio", { name: t("report.reason.other") }))
    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))

    await waitFor(() => expect(mocks.info).toHaveBeenCalledExactlyOnceWith(t("contentReports.already")))
    expect(mocks.success).not.toHaveBeenCalled()
    expect(report).toHaveBeenCalledOnce()
    expect(screen.getByRole("note")).toHaveTextContent(plain(t("contentReports.masked.title")))
  })

  it("un refus est traduit dans la feuille, qui reste ouverte ; un nouvel essai reste possible", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    report.mockResolvedValueOnce({ ok: false, code: "rate_limited" })
    mount(capability)
    const dialog = await openSheet(user)
    await user.click(within(dialog).getByRole("radio", { name: t("report.reason.hate") }))
    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(plain(t("errors.rate_limited")))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()

    report.mockResolvedValueOnce({ ok: false, code: "content_report_unavailable" })
    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))
    await waitFor(() => expect(within(dialog).getByRole("alert")).toHaveTextContent(plain(t("errors.content_report_unavailable"))))

    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(report).toHaveBeenCalledTimes(3)
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("contentReports.sent"))
  })

  it("un envoi à la fois : deux validations rapprochées n'envoient qu'un signalement", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    let release: (result: ReportResult) => void = () => {}
    report.mockImplementationOnce(() => new Promise<ReportResult>((resolve) => { release = resolve }))
    mount(capability)
    const dialog = await openSheet(user)
    await user.click(within(dialog).getByRole("radio", { name: t("report.reason.violence") }))
    const form = within(dialog).getByRole("button", { name: t("contentReports.confirm") }).closest("form")
    if (form === null) throw new Error("formulaire de la feuille absent")

    await act(async () => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })
    await waitFor(() => expect(report).toHaveBeenCalledOnce())
    expect(within(dialog).getByRole("button", { name: t("common.pleaseWait") })).toBeDisabled()

    await act(async () => { release({ ok: true, value: { created: true } }) })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(report).toHaveBeenCalledOnce()
  })

  it("au clavier : Entrée ouvre, Espace choisit le motif, Échap ferme et rend le focus au déclencheur", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mount(capability)
    const trigger = screen.getByRole("button", { name: TRIGGER })
    trigger.focus()
    await user.keyboard("{Enter}")
    const dialog = await screen.findByRole("dialog", { name: t("contentReports.title.diasporaAidQuestion") })
    const first = within(dialog).getByRole("radio", { name: t("report.reason.harassment") })
    await waitFor(() => expect(first).toHaveFocus())
    await user.keyboard(" ")
    expect(first).toBeChecked()

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole("button", { name: TRIGGER })).toHaveFocus())
    expect(report).not.toHaveBeenCalled()
  })

  it("Annuler ferme sans rien envoyer et rend le focus au déclencheur", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mount(capability)
    const dialog = await openSheet(user)
    await user.click(within(dialog).getByRole("button", { name: t("common.cancel") }))
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole("button", { name: TRIGGER })).toHaveFocus())
    expect(report).not.toHaveBeenCalled()
    expect(screen.getByText(CONTENT)).toBeInTheDocument()
  })

  it("démonstration : la feuille, sonner et l'avis disent que rien n'est transmis", async () => {
    const user = userEvent.setup()
    const { capability } = fakeReports({ demonstration: true })
    mount(capability)
    const dialog = await openSheet(user)
    expect(within(dialog).getByText(plain(t("contentReports.demoNotice")))).toBeInTheDocument()
    // Aucune équipe n'examine un signalement de démonstration : la feuille ne le promet pas.
    expect(within(dialog).getByText(plain(t("contentReports.descriptionDemo")))).toBeInTheDocument()
    expect(within(dialog).queryByText(plain(t("report.followUp")))).not.toBeInTheDocument()
    expect(within(dialog).queryByText(plain(t("contentReports.description")))).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole("radio", { name: t("report.reason.sexual_content") }))
    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))

    await waitFor(() => expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("contentReports.sentDemo")))
    expect(screen.getByRole("note")).toHaveTextContent(plain(t("contentReports.masked.bodyDemo")))
  })

  it("déjà signalé à l'arrivée : l'avis à la place, sans bouton, sans prendre le focus", () => {
    const { capability, mark } = fakeReports()
    mark(QUESTION)
    mount(capability)
    const notice = screen.getByRole("note")
    expect(notice).toHaveTextContent(plain(t("contentReports.masked.title")))
    expect(notice).not.toHaveFocus()
    expect(screen.queryByText(CONTENT)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: TRIGGER })).not.toBeInTheDocument()
  })
})
