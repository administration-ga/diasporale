// @vitest-environment jsdom
import type { api, Id } from "@antsia/api/engine"
import { formatDate } from "@diasporale/features"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { getFunctionName, type FunctionReturnType } from "convex/server"
import { ConvexError } from "convex/values"
import { useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { EngineDismissedSuggestions } from "./dismissed-suggestions"

type DismissedPage = FunctionReturnType<typeof api.modules.diaspora.suggestions.paginateDismissed>
type DismissedRow = DismissedPage["page"][number]
type RestoreResult = FunctionReturnType<typeof api.modules.diaspora.suggestions.restoreDismissed>
interface QueryMock {
  data: DismissedPage | undefined
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  network: { networkId: "networks_diasporale", personId: "persons_reader" },
  pages: new Map<string, QueryMock>(),
  pending: new Map<string, QueryMock>(),
  active: new Set<string>(),
  query: vi.fn(),
  mutationRefs: vi.fn(),
  restore: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))
const QUERY = "modules/diaspora/suggestions:paginateDismissed"
const MUTATION = "modules/diaspora/suggestions:restoreDismissed"
const NETWORK = "networks_diasporale"
const READER = "persons_reader"
const DATE = Date.UTC(2026, 9, 1)
const SECOND = "native/opaque+cursor==:12"
const THIRD = "native/opaque+cursor==:24"
const SHIFTED = "native/shifted+cursor==:12"
const t = getFixedT("fr")

vi.mock("@antsia/api/network", () => ({ useNetwork: () => mocks.network }))
// La chaîne pure du moteur reste réelle ; les autres surfaces de son barrel
// (appels, albums, dialogues) ne participent pas à ce raccord applicatif.
vi.mock("@antsia/social-features/reseau-personnel", () => import("@antsia/social-features/features/reseau-personnel/cursor-pages"))
vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (ref: never, args: { networkId: string; paginationOpts: { cursor: string | null; numItems: number } }) => {
    const name = getFunctionName(ref)
    if (name !== QUERY) throw new Error(`Unexpected query: ${name}`)
    const queryKey = key(args.paginationOpts.cursor, args.networkId, mocks.network.personId)
    mocks.query(name, args)
    useEffect(() => {
      mocks.active.add(queryKey)
      return () => { mocks.active.delete(queryKey) }
    }, [queryKey])
    if (!mocks.pending.has(queryKey)) mocks.pending.set(queryKey, { ...ok(undefined), isPending: true })
    return mocks.pages.get(queryKey) ?? mocks.pending.get(queryKey)!
  },
}))
vi.mock("convex/react", () => ({
  useMutation: (ref: never) => {
    mocks.mutationRefs(getFunctionName(ref))
    return mocks.restore
  },
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

function key(cursor: string | null = null, networkId = NETWORK, personId = READER) {
  return JSON.stringify([networkId, personId, cursor])
}
function row(id: string, overrides: Partial<DismissedRow> = {}): DismissedRow {
  return {
    dismissalId: `suggestionDismissals_${id}` as Id<"suggestionDismissals">,
    targetPersonId: `persons_${id}` as Id<"persons">,
    at: DATE,
    handle: `${id}.demo`,
    displayName: `Membre ${id}`,
    headline: `Présentation ${id}`,
    avatarUrl: null,
    ...overrides,
  }
}
function page(rows: DismissedRow[], cursor: string | null = null): DismissedPage {
  return { page: rows, isDone: cursor === null, continueCursor: cursor ?? "" }
}
function ok(data: DismissedPage | undefined, overrides: Partial<QueryMock> = {}): QueryMock {
  const query: QueryMock = { data, isPending: false, isError: false, error: null, refetch: vi.fn(), ...overrides }
  if (!overrides.refetch) query.refetch.mockResolvedValue(query)
  return query
}
function setPage(cursor: string | null, data: DismissedPage | undefined, overrides: Partial<QueryMock> = {}, networkId = NETWORK, personId = READER) {
  const query = ok(data, overrides)
  mocks.pages.set(key(cursor, networkId, personId), query)
  return query
}
function tree(locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}><EngineDismissedSuggestions /></I18nProvider>
}
function restoreButton(name: string, locale: "fr" | "en" = "fr") {
  return screen.getByRole("button", { name: getFixedT(locale)("relations.dismissed.restoreLabel", { name }) })
}
function more() {
  return screen.getByRole("button", { name: t("relations.dismissed.loadMore") })
}
function deferred<Value = RestoreResult>() {
  let resolve!: (result: Value) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<Value>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

beforeEach(() => {
  mocks.network = { networkId: NETWORK, personId: READER }
  mocks.pages.clear()
  mocks.pending.clear()
  mocks.active.clear()
  mocks.query.mockClear()
  mocks.mutationRefs.mockClear()
  mocks.restore.mockReset().mockResolvedValue({ restored: true })
  mocks.success.mockClear()
  mocks.error.mockClear()
  setPage(null, page([]))
})
afterEach(cleanup)

describe("Suggestions masquées — projection actuelle du moteur", () => {
  it.each(["fr", "en"] as const)("présente les choix et les seuls gestes autorisés en %s", (locale) => {
    const translated = getFixedT(locale)
    const member = row("awa", { avatarUrl: "/avatar-autorise.webp" })
    setPage(null, page([member]))
    const { container } = render(tree(locale))

    expect(screen.getByRole("heading", { name: translated("relations.dismissed.title") })).toBeInTheDocument()
    expect(screen.getByText(translated("relations.dismissed.body"))).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Membre awa/ })).toHaveAttribute("href", routes.profile(member.handle!))
    expect(screen.getByText(member.headline!)).toBeInTheDocument()
    expect(container.querySelector("img")).toHaveAttribute("src", member.avatarUrl)
    const time = container.querySelector("time")!
    expect(time).toHaveAttribute("datetime", new Date(DATE).toISOString())
    expect(time).toHaveTextContent(translated("relations.dismissed.hiddenAt", { date: formatDate(DATE, locale) }))
    expect(restoreButton(member.displayName!, locale)).toHaveAccessibleDescription(time.textContent!)
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.restore).not.toHaveBeenCalled()
    expect(new Set(mocks.query.mock.calls.map(([name]) => name))).toEqual(new Set([QUERY]))
    expect(new Set(mocks.mutationRefs.mock.calls.map(([name]) => name))).toEqual(new Set([MUTATION]))
    expect(mocks.query).toHaveBeenLastCalledWith(QUERY, { networkId: NETWORK, paginationOpts: { cursor: null, numItems: 12 } })
  })

  it.each([
    { handle: null, displayName: null },
    { handle: null, displayName: "Nom isolé secret" },
    { handle: "handle.secret", displayName: null },
    { handle: " ", displayName: "Nom isolé secret" },
    { handle: "handle.secret", displayName: " " },
  ])("reste neutre lorsque l'identité est incomplète : %j", (identity) => {
    setPage(null, page([row("cible_privee", { ...identity, headline: "Présentation secrète", avatarUrl: "/avatar-secret.webp" })]))
    const { container } = render(tree())

    expect(screen.getByText(t("relations.dismissed.neutral"))).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(container.querySelector("img, [data-slot=avatar]")).toBeNull()
    expect(container.innerHTML).not.toContain("cible_privee")
    expect(container.innerHTML).not.toContain("secret")
    expect(restoreButton(t("relations.dismissed.neutral"))).toBeEnabled()
  })

  it("remplace aussitôt une ancienne identité par la projection neutre du même choix", () => {
    const member = row("awa", { avatarUrl: "/ancien-avatar.webp" })
    setPage(null, page([member]))
    const view = render(tree())
    expect(screen.getByRole("link", { name: /Membre awa/ })).toBeInTheDocument()
    setPage(null, page([{ ...member, handle: null, displayName: null, headline: null, avatarUrl: null }]))
    view.rerender(tree())

    expect(screen.getByText(t("relations.dismissed.neutral"))).toBeInTheDocument()
    expect(screen.queryByText("Membre awa")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(view.container.querySelector("img, [data-slot=avatar]")).toBeNull()
    expect(view.container.innerHTML).not.toContain("awa.demo")
    expect(restoreButton(t("relations.dismissed.neutral"))).toBeEnabled()
  })

  it("déduplique le même choix en donnant priorité à l'amont, sans fusionner deux versions d'une cible", () => {
    const first = row("version1", { targetPersonId: "persons_same" as Id<"persons"> })
    const second = row("version2", { targetPersonId: first.targetPersonId })
    setPage(null, page([first], SECOND))
    setPage(SECOND, page([{ ...first, displayName: "Ancienne copie aval" }, second]))
    render(tree())
    fireEvent.click(more())

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByText(first.displayName!)).toBeInTheDocument()
    expect(screen.getByText(second.displayName!)).toBeInTheDocument()
    expect(screen.queryByText("Ancienne copie aval")).not.toBeInTheDocument()
  })
})

describe("Suggestions masquées — chaîne native réactive", () => {
  it("lit la seconde page avec son curseur opaque et garde les pages précédentes réactives", () => {
    setPage(null, page([row("premier")], SECOND))
    setPage(SECOND, page([row("second")]))
    const view = render(tree())
    expect(mocks.active).toEqual(new Set([key()]))
    fireEvent.click(more())

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(mocks.active).toEqual(new Set([key(), key(SECOND)]))
    expect(mocks.query).toHaveBeenLastCalledWith(QUERY, { networkId: NETWORK, paginationOpts: { cursor: SECOND, numItems: 12 } })
    expect(screen.queryByRole("button", { name: t("relations.dismissed.loadMore") })).not.toBeInTheDocument()
    setPage(null, page([row("premier", { displayName: "Nom mis à jour" })], SECOND))
    view.rerender(tree())
    expect(screen.getByText("Nom mis à jour")).toBeInTheDocument()
    expect(screen.queryByText("Membre premier")).not.toBeInTheDocument()
    expect(screen.getByText("Membre second")).toBeInTheDocument()
  })

  it("continue deux pages vides non terminales sans annoncer un vide global", () => {
    setPage(null, page([], SECOND))
    setPage(SECOND, page([], THIRD))
    setPage(THIRD, page([row("retrouve")]))
    render(tree())
    expect(screen.queryByText(t("relations.dismissed.empty"))).not.toBeInTheDocument()
    fireEvent.click(more())
    expect(screen.queryByText(t("relations.dismissed.empty"))).not.toBeInTheDocument()
    fireEvent.click(more())
    expect(screen.getByText("Membre retrouve")).toBeInTheDocument()
    expect(mocks.active).toEqual(new Set([key(), key(SECOND), key(THIRD)]))
  })

  it("distingue un premier chargement d'un vrai résultat vide terminal", () => {
    mocks.pages.delete(key())
    const view = render(tree())
    expect(screen.getByRole("status")).toHaveTextContent(t("relations.dismissed.loading"))
    expect(screen.queryByText(t("relations.dismissed.empty"))).not.toBeInTheDocument()
    setPage(null, page([]))
    view.rerender(tree())
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.getByText(t("relations.dismissed.empty"))).toBeInTheDocument()
  })

  it("conserve le bouton de suite et son focus pendant la lecture demandée", () => {
    setPage(null, page([row("premier")], SECOND))
    const view = render(tree())
    const button = more()
    button.focus()
    fireEvent.click(button)

    expect(button).toBeInTheDocument()
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(t("relations.dismissed.loading"))
    expect(document.activeElement).toBe(button)
    expect(screen.getByText("Membre premier")).toBeInTheDocument()
    setPage(SECOND, page([row("second")]))
    view.rerender(tree())
    expect(screen.getByText("Membre second")).toBeInTheDocument()
  })

  it("réaligne les descendants sur la nouvelle frontière et ignore l'ancien résultat terminal", () => {
    setPage(null, page([row("premier")], SECOND))
    setPage(SECOND, page([row("ancienne_suite")], THIRD))
    setPage(THIRD, page([row("ancienne_fin")]))
    setPage(SHIFTED, page([row("nouvelle_suite")], THIRD))
    const view = render(tree())
    fireEvent.click(more())
    fireEvent.click(more())
    setPage(null, page([row("nouveau_debut")], SHIFTED))
    setPage(THIRD, page([row("reponse_tardive")]))
    view.rerender(tree())

    expect(screen.getByText("Membre nouvelle_suite")).toBeInTheDocument()
    expect(screen.queryByText("Membre ancienne_suite")).not.toBeInTheDocument()
    expect(screen.queryByText("Membre reponse_tardive")).not.toBeInTheDocument()
    expect(mocks.active).toEqual(new Set([key(), key(SHIFTED)]))
    expect(more()).toBeEnabled()
    fireEvent.click(more())
    expect(screen.getByText("Membre reponse_tardive")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
  })

  it("retire les descendants quand l'amont devient terminal", () => {
    setPage(null, page([row("premier")], SECOND))
    setPage(SECOND, page([row("ancien_second")]))
    const view = render(tree())
    fireEvent.click(more())
    setPage(null, page([row("nouveau_seul")]))
    view.rerender(tree())

    expect(screen.getAllByRole("listitem")).toHaveLength(1)
    expect(screen.getByText("Membre nouveau_seul")).toBeInTheDocument()
    expect(screen.queryByText("Membre ancien_second")).not.toBeInTheDocument()
    expect(mocks.active).toEqual(new Set([key()]))
  })
})

describe("Suggestions masquées — erreurs et reprise", () => {
  it("donne priorité à l'erreur de la première page et ne montre aucune erreur brute", async () => {
    const failed = setPage(null, undefined, { isError: true, error: new Error("PRIVATE_QUERY_DETAIL") })
    render(tree())

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(t("relations.dismissed.errorTitle"))
    expect(alert).toHaveTextContent(t("relations.dismissed.errorBody"))
    expect(screen.queryByText(t("relations.dismissed.empty"))).not.toBeInTheDocument()
    expect(screen.queryByText("PRIVATE_QUERY_DETAIL")).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(within(alert).getByRole("button", { name: t("relations.dismissed.retry") })) })
    expect(failed.refetch).toHaveBeenCalledOnce()
  })

  it("garde les pages déjà reçues pendant une panne transitoire et réessaie leurs abonnements", async () => {
    const first = setPage(null, page([row("premier")], SECOND))
    setPage(SECOND, page([row("second_cache")], THIRD))
    const view = render(tree())
    fireEvent.click(more())
    const failed = setPage(SECOND, undefined, { isError: true, error: new Error("PRIVATE_BACKEND_DETAIL") })
    view.rerender(tree())

    expect(screen.getByRole("alert")).toHaveTextContent(t("relations.dismissed.errorBody"))
    expect(screen.getByText("Membre premier")).toBeInTheDocument()
    expect(screen.getByText("Membre second_cache")).toBeInTheDocument()
    expect(screen.queryByText("PRIVATE_BACKEND_DETAIL")).not.toBeInTheDocument()
    expect(screen.queryByText(t("relations.dismissed.empty"))).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("relations.dismissed.retry") })) })
    expect(first.refetch).toHaveBeenCalledOnce()
    expect(failed.refetch).toHaveBeenCalledOnce()
    setPage(SECOND, page([row("second_retabli")]))
    view.rerender(tree())

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByText("Membre second_retabli")).toBeInTheDocument()
    expect(screen.queryByText("Membre second_cache")).not.toBeInTheDocument()
    expect(mocks.active).toEqual(new Set([key(), key(SECOND)]))
  })

  it.each([
    { code: "unauthenticated" },
    { code: "profileRequired" },
    { code: "notFound" },
    { code: "statusInsufficient" },
    { code: "membershipSuspended" },
    { code: "notFound", appRule: "network_unavailable" },
  ])("ferme les identités reçues lorsque l'autorisation est perdue : %j", async (data) => {
    const cached = page([row("identite_avant_refus", { avatarUrl: "/avatar-avant-refus.webp" })])
    setPage(null, cached)
    const view = render(tree())
    expect(screen.getByRole("link")).toBeInTheDocument()
    setPage(null, cached, { isError: true, error: new ConvexError({ ...data, message: "PRIVATE_AUTH_DETAIL" }) })
    view.rerender(tree())

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(view.container.querySelector("img, [data-slot=avatar]")).toBeNull()
    expect(view.container.innerHTML).not.toContain("identite_avant_refus")
    expect(view.container.innerHTML).not.toContain("PRIVATE_AUTH_DETAIL")
    expect(screen.queryByText(t("relations.dismissed.empty"))).not.toBeInTheDocument()
    setPage(null, undefined, { isPending: true })
    view.rerender(tree())
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.queryByText(t("relations.dismissed.empty"))).not.toBeInTheDocument()
    setPage(null, page([row("revalide")]))
    view.rerender(tree())
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("relations.dismissed.retry") })) })
    expect(screen.getByText("Membre revalide")).toBeInTheDocument()
    expect(screen.queryByText("Membre identite_avant_refus")).not.toBeInTheDocument()
  })

  it("un refus sur la seconde page ferme aussi l'identité encore en cache dans la première", () => {
    setPage(null, page([row("amont_cache")], SECOND))
    setPage(SECOND, page([row("aval_cache")]))
    const view = render(tree())
    fireEvent.click(more())
    setPage(SECOND, undefined, { isError: true, error: new ConvexError({ code: "statusInsufficient" }) })
    view.rerender(tree())

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByText("Membre amont_cache")).not.toBeInTheDocument()
    expect(screen.queryByText("Membre aval_cache")).not.toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})

describe("Suggestions masquées — restauration du seul choix courant", () => {
  it.each([true, false])("retire la seule version concernée après une réponse restored=%s, sans geste de graphe", async (restored) => {
    const first = row("premier")
    const second = row("autre")
    mocks.restore.mockResolvedValue({ restored })
    setPage(null, page([first, second]))
    render(tree())
    await act(async () => { fireEvent.click(restoreButton(first.displayName!)) })

    expect(mocks.restore).toHaveBeenCalledExactlyOnceWith({ networkId: NETWORK, dismissalId: first.dismissalId })
    expect(screen.queryByText(first.displayName!)).not.toBeInTheDocument()
    expect(screen.getByText(second.displayName!)).toBeInTheDocument()
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("relations.dismissed.restored"))
    expect(mocks.error).not.toHaveBeenCalled()
    expect(new Set(mocks.mutationRefs.mock.calls.map(([name]) => name))).toEqual(new Set([MUTATION]))
    expect(new Set(mocks.query.mock.calls.map(([name]) => name))).toEqual(new Set([QUERY]))
  })

  it("verrouille immédiatement une ligne avant un double clic et garde les autres utilisables", async () => {
    const pending = deferred()
    mocks.restore.mockReturnValue(pending.promise)
    const first = row("premier")
    setPage(null, page([first, row("autre")]))
    render(tree())
    const button = restoreButton(first.displayName!)
    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })

    expect(mocks.restore).toHaveBeenCalledOnce()
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent(t("relations.dismissed.restoring"))
    expect(screen.getByText(first.displayName!)).toBeInTheDocument()
    expect(restoreButton("Membre autre")).toBeEnabled()
    await act(async () => { pending.resolve({ restored: true }) })
    expect(screen.queryByText(first.displayName!)).not.toBeInTheDocument()
  })

  it.each(["unknown", "known"] as const)("conserve le choix après un refus %s, masque son détail et permet de réessayer", async (kind) => {
    const error = kind === "known" ? new ConvexError({ code: "rateLimited", message: "PRIVATE_RESTORE_DETAIL" }) : new Error("PRIVATE_RESTORE_DETAIL")
    mocks.restore.mockRejectedValueOnce(error).mockResolvedValueOnce({ restored: true })
    const member = row("awa")
    setPage(null, page([member]))
    const view = render(tree())
    await act(async () => { fireEvent.click(restoreButton(member.displayName!)) })

    expect(screen.getByText(member.displayName!)).toBeInTheDocument()
    expect(restoreButton(member.displayName!)).toBeEnabled()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(t(kind === "known" ? "errors.rate_limited" : "relations.dismissed.restoreFailed"))
    expect(view.container.innerHTML).not.toContain("PRIVATE_RESTORE_DETAIL")
    await act(async () => { fireEvent.click(restoreButton(member.displayName!)) })
    expect(mocks.restore).toHaveBeenCalledTimes(2)
    expect(screen.queryByText(member.displayName!)).not.toBeInTheDocument()
  })

  it("une réponse ancienne ne retire pas un nouveau choix de la même cible", async () => {
    const pending = deferred()
    mocks.restore.mockReturnValue(pending.promise)
    const old = row("ancienne_version")
    const current = row("nouvelle_version", { targetPersonId: old.targetPersonId })
    setPage(null, page([old]))
    const view = render(tree())
    fireEvent.click(restoreButton(old.displayName!))
    setPage(null, page([current]))
    view.rerender(tree())
    expect(restoreButton(current.displayName!)).toBeEnabled()
    await act(async () => { pending.resolve({ restored: false }) })

    expect(screen.getByText(current.displayName!)).toBeInTheDocument()
    expect(mocks.restore).toHaveBeenCalledExactlyOnceWith({ networkId: NETWORK, dismissalId: old.dismissalId })
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith(t("relations.dismissed.restored"))
  })

  it.each(["person", "network"] as const)("réinitialise pages et verrous après changement de %s, et ignore une ancienne réussite", async (kind) => {
    const pending = deferred()
    mocks.restore.mockReturnValue(pending.promise)
    const original = row("ancien_lecteur")
    setPage(null, page([original], SECOND))
    setPage(SECOND, page([row("ancienne_suite")]))
    const nextNetwork = kind === "network" ? "networks_other" : NETWORK
    const nextReader = kind === "person" ? "persons_other" : READER
    setPage(null, page([row("nouveau_lecteur", { dismissalId: original.dismissalId })], THIRD), {}, nextNetwork, nextReader)
    const view = render(tree())
    fireEvent.click(more())
    fireEvent.click(restoreButton(original.displayName!))
    mocks.network = { networkId: nextNetwork, personId: nextReader }
    view.rerender(tree())

    expect(screen.queryByText(original.displayName!)).not.toBeInTheDocument()
    expect(screen.queryByText("Membre ancienne_suite")).not.toBeInTheDocument()
    expect(restoreButton("Membre nouveau_lecteur")).toBeEnabled()
    expect(mocks.active).toEqual(new Set([key(null, nextNetwork, nextReader)]))
    expect(more()).toBeEnabled()
    await act(async () => { pending.resolve({ restored: true }) })
    expect(screen.getByText("Membre nouveau_lecteur")).toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it.each(["person", "network"] as const)("ignore un ancien refus après changement de %s", async (kind) => {
    const pending = deferred()
    mocks.restore.mockReturnValue(pending.promise)
    setPage(null, page([row("ancien_lecteur")]))
    const view = render(tree())
    fireEvent.click(restoreButton("Membre ancien_lecteur"))
    mocks.network = kind === "person" ? { networkId: NETWORK, personId: "persons_other" } : { networkId: "networks_other", personId: READER }
    setPage(null, page([]), {}, mocks.network.networkId, mocks.network.personId)
    view.rerender(tree())
    await act(async () => { pending.reject(new Error("PRIVATE_OLD_READER_DETAIL")) })

    expect(screen.getByText(t("relations.dismissed.empty"))).toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it("ignore aussi une restauration en vol si la lecture perd entre-temps son autorisation", async () => {
    const pending = deferred()
    mocks.restore.mockReturnValue(pending.promise)
    const cached = page([row("awa")])
    setPage(null, cached)
    const view = render(tree())
    fireEvent.click(restoreButton("Membre awa"))
    setPage(null, cached, { isError: true, error: new ConvexError({ code: "unauthenticated" }) })
    view.rerender(tree())
    await act(async () => { pending.resolve({ restored: true }) })

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it("ferme aussi les identités après un refus d'autorisation de la mutation et les réouvre seulement après relecture", async () => {
    mocks.restore.mockRejectedValueOnce(new ConvexError({ code: "membershipSuspended", message: "PRIVATE_SUSPENSION_DETAIL" }))
    const current = setPage(null, page([row("awa")]))
    render(tree())
    await act(async () => { fireEvent.click(restoreButton("Membre awa")) })

    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.queryByText("Membre awa")).not.toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent(t("relations.dismissed.errorBody"))
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(t("errors.suspended"))
    expect(mocks.success).not.toHaveBeenCalled()
    // Une relecture explicite peut réussir sans changer l'objet structurel
    // du cache : son résultat est tout de même validé par la feuille.
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("relations.dismissed.retry") })) })
    expect(current.refetch).toHaveBeenCalledOnce()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByText("Membre awa")).toBeInTheDocument()
    expect(restoreButton("Membre awa")).toBeEnabled()
  })

  it("garde toutes les pages fermées quand la première reprise réussit avant la seconde", async () => {
    const firstRead = deferred<QueryMock>()
    const secondRead = deferred<QueryMock>()
    const first = setPage(null, page([row("premier_cache")], SECOND))
    const previousSecond = row("ancienne_identite", { avatarUrl: "/ancien-avatar.webp" })
    const second = setPage(SECOND, page([previousSecond]))
    first.refetch.mockReturnValue(firstRead.promise)
    second.refetch.mockReturnValue(secondRead.promise)
    mocks.restore.mockRejectedValueOnce(new ConvexError({ code: "membershipSuspended" }))
    const view = render(tree())
    fireEvent.click(more())
    await act(async () => { fireEvent.click(restoreButton("Membre premier_cache")) })
    expect(screen.queryByRole("list")).not.toBeInTheDocument()

    // Rendre le même cache ne vaut pas relecture autorisée de ces pages.
    view.rerender(tree())
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: t("relations.dismissed.retry") }))
    expect(first.refetch).toHaveBeenCalledOnce()
    expect(second.refetch).toHaveBeenCalledOnce()
    await act(async () => { firstRead.resolve(ok(page([row("premier_revalide")], SECOND))) })

    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.queryByText("Membre ancienne_identite")).not.toBeInTheDocument()
    expect(view.container.querySelector("img")).toBeNull()
    await act(async () => {
      secondRead.resolve(ok(page([{ ...previousSecond, handle: null, displayName: null, headline: null, avatarUrl: null }])))
    })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByText("Membre premier_revalide")).toBeInTheDocument()
    expect(screen.getByText(t("relations.dismissed.neutral"))).toBeInTheDocument()
    expect(screen.queryByText("Membre ancienne_identite")).not.toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(view.container.querySelector("img")).toBeNull()
  })

  it("ignore les réponses de reprise commencées avant le refus, puis attend les relectures de la nouvelle génération", async () => {
    const oldFirstRead = deferred<QueryMock>()
    const oldSecondRead = deferred<QueryMock>()
    const first = setPage(null, page([row("premier_cache")], SECOND))
    const second = setPage(SECOND, page([row("second_cache")]))
    const view = render(tree())
    fireEvent.click(more())
    // Une panne transitoire permet une reprise pendant que les choix restent
    // utilisables ; ces deux lectures commencent avant le refus de mutation.
    const failedSecond = setPage(SECOND, undefined, { isError: true, error: new Error("TRANSIENT_FAILURE") })
    first.refetch.mockReturnValueOnce(oldFirstRead.promise).mockResolvedValueOnce(ok(page([row("premier_revalide")], SECOND)))
    failedSecond.refetch.mockReturnValueOnce(oldSecondRead.promise).mockResolvedValueOnce(ok(page([row("second_revalide")])))
    view.rerender(tree())
    fireEvent.click(screen.getByRole("button", { name: t("relations.dismissed.retry") }))
    expect(first.refetch).toHaveBeenCalledOnce()
    expect(failedSecond.refetch).toHaveBeenCalledOnce()
    expect(second.refetch).not.toHaveBeenCalled()
    mocks.restore.mockRejectedValueOnce(new ConvexError({ code: "statusInsufficient" }))
    await act(async () => { fireEvent.click(restoreButton("Membre premier_cache")) })

    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    await act(async () => {
      oldFirstRead.resolve(ok(page([row("ancienne_reponse_amont")], SECOND)))
      oldSecondRead.resolve(ok(page([row("ancienne_reponse_aval")])))
    })
    expect(screen.getByRole("alert")).toBeInTheDocument()
    expect(screen.queryByRole("list")).not.toBeInTheDocument()
    expect(screen.queryByText("Membre ancienne_reponse_amont")).not.toBeInTheDocument()
    expect(screen.queryByText("Membre ancienne_reponse_aval")).not.toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("relations.dismissed.retry") })) })

    expect(first.refetch).toHaveBeenCalledTimes(2)
    expect(failedSecond.refetch).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByText("Membre premier_revalide")).toBeInTheDocument()
    expect(screen.getByText("Membre second_revalide")).toBeInTheDocument()
    expect(screen.queryByText("Membre ancienne_reponse_amont")).not.toBeInTheDocument()
    expect(screen.queryByText("Membre ancienne_reponse_aval")).not.toBeInTheDocument()
    expect(mocks.success).not.toHaveBeenCalled()
  })
})
