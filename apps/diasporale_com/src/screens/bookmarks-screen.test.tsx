// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ActionErrorCode, BookmarksPageQuery, BookmarksPageView, BookmarkView, MembershipView } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { useEffect, type DependencyList, type EffectCallback, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BookmarksScreen } from "./bookmarks-screen"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  network: { networkId: "network-diasporale", personId: "person-me" } as { networkId: string; personId: string } | null,
  kind: "engine" as "engine" | "demo",
  pages: new Map<string, BookmarksPageQuery>(), pending: new Map<string, BookmarksPageQuery>(), active: new Set<string>(),
  deferPassive: false,
  read: vi.fn(), gate: vi.fn(), toggle: vi.fn(), success: vi.fn(), error: vi.fn(),
}))
function key(cursor: string | null) {
  return JSON.stringify([mocks.kind, mocks.membership?.personId, mocks.network?.networkId, cursor])
}
function bookmark(id: string, body = id, markedAt = 2): BookmarkView {
  return { postId: id, author: { kind: "person", handle: null, displayName: null }, body, publishedAt: 1, markedAt }
}
function ok(items: BookmarkView[], cursor: string | null = null): BookmarksPageQuery {
  return { data: { items, isDone: cursor === null, continueCursor: cursor ?? "" }, error: null, isLoading: false, retry: vi.fn() }
}
function deferred() {
  let resolve!: (value: { ok: true; value: { bookmarked: boolean } }) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<{ ok: true; value: { bookmarked: boolean } }>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function deferredPage() {
  let resolve!: (value: BookmarksPageView | undefined) => void
  const promise = new Promise<BookmarksPageView | undefined>((yes) => { resolve = yes })
  return { promise, resolve }
}
vi.mock("react", async (original) => {
  const real = await original<typeof import("react")>()
  return {
    ...real,
    useEffect: (effect: EffectCallback, deps?: DependencyList) => real.useEffect(() => {
      if (!mocks.deferPassive) return effect()
    }, deps),
  }
})
vi.mock("@/components/gate", () => ({
  Gate: (props: { require: string; children: (session: { membership: MembershipView | null }) => ReactNode }) => {
    mocks.gate(props.require)
    return <>{props.children({ membership: mocks.membership })}</>
  },
}))
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock("@/components/icom", () => ({ useEngineNetwork: () => mocks.network }))
vi.mock("@diasporale/features/data", async (original) => ({
  ...await original<typeof import("@diasporale/features/data")>(),
  useDataSource: () => ({ kind: mocks.kind }),
  useActions: () => ({ toggleBookmark: mocks.toggle }),
  useBookmarksPage: ({ cursor = null }: { cursor?: string | null }) => {
    const queryKey = key(cursor)
    mocks.read(cursor)
    useEffect(() => {
      mocks.active.add(queryKey)
      return () => { mocks.active.delete(queryKey) }
    }, [queryKey])
    if (!mocks.pending.has(queryKey)) mocks.pending.set(queryKey, { data: undefined, error: null, isLoading: true, retry: vi.fn() })
    return mocks.pages.get(queryKey) ?? mocks.pending.get(queryKey)!
  },
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const MEMBER: MembershipView = {
  personId: "person-me", handle: "recette", displayName: "Recette", status: "en_attente", badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: false, rateTier: "reinforced", directoryVisibility: "hidden",
}
function tree(locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}><BookmarksScreen /></I18nProvider>
}
const MORE = "Voir plus d’enregistrements"
const REMOVE = "Retirer"
beforeEach(() => {
  mocks.membership = { ...MEMBER }
  mocks.network = { networkId: "network-diasporale", personId: MEMBER.personId }
  mocks.kind = "engine"
  mocks.deferPassive = false
  mocks.pages.clear(); mocks.pending.clear(); mocks.active.clear()
  vi.clearAllMocks()
  mocks.toggle.mockReset().mockResolvedValue({ ok: true, value: { bookmarked: false } })
})
afterEach(cleanup)

describe("/enregistrements — pages réactives", () => {
  it.each([
    { locale: "fr" as const, more: MORE },
    { locale: "en" as const, more: "Show more saved posts" },
  ])("garde le rendu des aperçus, le lien de publication et les textes en $locale", ({ locale, more }) => {
    mocks.pages.set(key(null), ok([bookmark("post-one", "Publication fictive")], "next"))
    render(tree(locale))
    expect(mocks.gate).toHaveBeenCalledWith("member")
    expect(screen.getByText("Publication fictive")).toBeTruthy()
    expect(screen.getByRole("button", { name: more })).toBeTruthy()
    expect(screen.getByRole("link").getAttribute("href")).toBe("/publication/post-one")
    expect(screen.queryByRole("img")).toBeNull()
  })
  it("accède au 51e signet tout en conservant la première page abonnée", () => {
    mocks.pages.set(key(null), ok(Array.from({ length: 50 }, (_, index) => bookmark(`post-${index}`)), "next"))
    mocks.pages.set(key("next"), ok([bookmark("post-50")]))
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    expect(screen.getAllByRole("listitem")).toHaveLength(51)
    expect(mocks.active).toEqual(new Set([key(null), key("next")]))
    expect(screen.queryByRole("button", { name: MORE })).toBeNull()
  })
  it("une publication devenue illisible disparaît de l'ancienne page sans perdre la suite", () => {
    mocks.pages.set(key(null), ok([bookmark("first")], "next"))
    mocks.pages.set(key("next"), ok([bookmark("second")]))
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    mocks.pages.set(key(null), ok([], "next"))
    view.rerender(tree())
    expect(screen.queryByText("first")).toBeNull()
    expect(screen.getByText("second")).toBeTruthy()
  })
  it("retire une projection devenue illisible avant l'exécution des effets passifs", () => {
    mocks.pages.set(key(null), ok([bookmark("private")]))
    const view = render(tree())
    mocks.deferPassive = true
    mocks.pages.set(key(null), ok([]))
    view.rerender(tree())
    expect(screen.queryByText("private")).toBeNull()
  })
  it("dédoublonne postId et conserve la projection amont", () => {
    mocks.pages.set(key(null), ok([bookmark("one", "Version récente")], "next"))
    mocks.pages.set(key("next"), ok([bookmark("one", "Version périmée"), bookmark("two")]))
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(screen.getByText("Version récente")).toBeTruthy()
    expect(screen.queryByText("Version périmée")).toBeNull()
  })
  it("abandonne les descendants quand la frontière amont se déplace", () => {
    mocks.pages.set(key(null), ok([bookmark("first")], "old"))
    mocks.pages.set(key("old"), ok([bookmark("stale")], "deep"))
    mocks.pages.set(key("deep"), ok([bookmark("deep-stale")]))
    mocks.pages.set(key("new"), ok([bookmark("fresh")]))
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    mocks.pages.set(key(null), ok([bookmark("first")], "new"))
    view.rerender(tree())
    expect(screen.queryByText("stale")).toBeNull()
    expect(screen.queryByText("deep-stale")).toBeNull()
    expect(screen.getByText("fresh")).toBeTruthy()
    expect(mocks.active).toEqual(new Set([key(null), key("new")]))
  })
  it("traverse une première page vide non terminale", () => {
    mocks.pages.set(key(null), ok([], "next"))
    mocks.pages.set(key("next"), ok([bookmark("found")]))
    render(tree())
    expect(screen.getByRole("button", { name: MORE })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    expect(screen.getByText("found")).toBeTruthy()
  })
  it("continue après une page intermédiaire vide et ne boucle pas sur un curseur répété", () => {
    mocks.pages.set(key(null), ok([bookmark("first")], "next"))
    mocks.pages.set(key("next"), ok([], "third"))
    mocks.pages.set(key("third"), ok([], "third"))
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    expect(screen.getByText("first")).toBeTruthy()
    expect(screen.queryByRole("button", { name: MORE })).toBeNull()
    expect(mocks.active.size).toBe(3)
  })
  it("annonce la page suivante et bloque le second ajout pendant son chargement", () => {
    mocks.pages.set(key(null), ok([bookmark("first")], "next"))
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    expect(screen.getByRole("button", { name: "Chargement des enregistrements…" })).toBeDisabled()
    expect(screen.getByRole("list").getAttribute("aria-busy")).toBe("true")
    expect(screen.getByText("first")).toBeTruthy()
  })
  it("une panne initiale propose une reprise sans prétendre que la liste est vide", () => {
    const retry = vi.fn()
    mocks.pages.set(key(null), { data: undefined, error: "unknown", isLoading: false, retry })
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(retry).toHaveBeenCalledOnce()
  })
  it("conserve les lignes valides sous l'erreur et reprend chaque page montée", () => {
    mocks.pages.set(key(null), ok([bookmark("first")], "next"))
    mocks.pages.set(key("next"), ok([bookmark("second")]))
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    const retry = vi.fn()
    mocks.pages.set(key("next"), { data: undefined, error: "unknown", isLoading: false, retry })
    view.rerender(tree())
    expect(screen.getByText("first")).toBeTruthy()
    expect(screen.getByText("second")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    expect(retry).toHaveBeenCalledOnce()
    expect(mocks.pages.get(key(null))!.retry).toHaveBeenCalledOnce()
    mocks.pages.set(key("next"), ok([bookmark("recovered")]))
    view.rerender(tree())
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.getByText("recovered")).toBeTruthy()
  })
  it.each(["person", "network", "mode"] as const)("réinitialise pages et curseurs après changement de %s", (changed) => {
    mocks.pages.set(key(null), ok([bookmark("old")], "next"))
    mocks.pages.set(key("next"), ok([bookmark("old-deep")]))
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    if (changed === "person") {
      mocks.membership = { ...MEMBER, personId: "new-person" }
      mocks.network = { networkId: "network-diasporale", personId: "new-person" }
    } else if (changed === "network") mocks.network = { networkId: "new-network", personId: MEMBER.personId }
    else mocks.kind = "demo"
    view.rerender(tree())
    expect(screen.queryByText("old")).toBeNull()
    expect(screen.queryByText("old-deep")).toBeNull()
    expect(mocks.active).toEqual(new Set([key(null)]))
  })
  it("ne monte aucune page privée avec le réseau de l'ancien lecteur", () => {
    mocks.membership = { ...MEMBER, personId: "new-person" }
    render(tree())
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it.each(["not_signed_in", "not_member", "suspended", "network_unavailable", "status_insufficient", "not_found"] as const)("masque toutes les pages sur refus %s même avec un cache", (error) => {
    const first = ok([bookmark("private")], "next")
    const second = ok([bookmark("private-deep")])
    mocks.pages.set(key(null), first)
    mocks.pages.set(key("next"), second)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    mocks.pages.set(key("next"), { ...second, error })
    mocks.deferPassive = true
    view.rerender(tree())
    expect(screen.queryByText("private")).toBeNull()
    expect(screen.queryByText("private-deep")).toBeNull()
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.queryByRole("button", { name: MORE })).toBeNull()
  })
  it("ne rouvre pas la chaîne avant la réponse fraîche de chacune de ses pages", async () => {
    const firstReply = deferredPage()
    const secondReply = deferredPage()
    const first = { ...ok([bookmark("cached-first")], "next"), retry: vi.fn().mockReturnValue(firstReply.promise) }
    const second = { ...ok([bookmark("cached-second")]), retry: vi.fn().mockReturnValue(secondReply.promise) }
    mocks.pages.set(key(null), first)
    mocks.pages.set(key("next"), second)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    mocks.pages.set(key("next"), { ...second, error: "not_found" })
    view.rerender(tree())
    expect(first.retry).toHaveBeenCalledOnce()
    expect(second.retry).toHaveBeenCalledOnce()
    mocks.pages.set(key("next"), { ...second, error: null, isLoading: true })
    view.rerender(tree())
    expect(screen.queryByRole("list")).toBeNull()
    const freshFirst = ok([bookmark("fresh-first")], "next")
    mocks.pages.set(key(null), { ...freshFirst, retry: first.retry })
    view.rerender(tree())
    await act(async () => { firstReply.resolve(freshFirst.data); await firstReply.promise })
    expect(screen.queryByRole("list")).toBeNull()
    mocks.pages.set(key("next"), { ...second, error: "not_found", isLoading: true })
    view.rerender(tree())
    expect(screen.queryByRole("list")).toBeNull()
    mocks.pages.set(key("next"), { ...second, error: "unknown" })
    view.rerender(tree())
    expect(screen.queryByText("cached-second")).toBeNull()
    const freshSecond = ok([bookmark("fresh-second")])
    mocks.pages.set(key("next"), { ...freshSecond, retry: second.retry })
    view.rerender(tree())
    expect(screen.queryByRole("list")).toBeNull()
    await act(async () => { secondReply.resolve(freshSecond.data); await secondReply.promise })
    expect(screen.getByText("fresh-first")).toBeTruthy()
    expect(screen.getByText("fresh-second")).toBeTruthy()
    expect(screen.queryByText("cached-first")).toBeNull()
    expect(screen.queryByText("cached-second")).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  })
  it("protège aussi le cache d'une page ajoutée après une reprise entièrement réussie", async () => {
    const firstReply = deferredPage()
    const nextReply = deferredPage()
    const first = { ...ok([bookmark("cached-first")], "next"), retry: vi.fn().mockReturnValue(firstReply.promise) }
    const next = { ...ok([bookmark("cached-next")]), retry: vi.fn().mockReturnValue(nextReply.promise) }
    mocks.pages.set(key(null), first)
    mocks.pages.set(key("next"), next)
    const view = render(tree())
    mocks.pages.set(key(null), { ...first, error: "not_found" })
    view.rerender(tree())
    const freshFirst = ok([bookmark("fresh-first")], "next")
    mocks.pages.set(key(null), { ...freshFirst, retry: first.retry })
    view.rerender(tree())
    await act(async () => { firstReply.resolve(freshFirst.data); await firstReply.promise })
    expect(screen.getByText("fresh-first")).toBeTruthy()
    expect(screen.queryByRole("alert")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    expect(next.retry).toHaveBeenCalledOnce()
    expect(screen.queryByText("cached-next")).toBeNull()
    expect(screen.queryByRole("list")).toBeNull()
    const freshNext = ok([bookmark("fresh-next")])
    mocks.pages.set(key("next"), { ...freshNext, retry: next.retry })
    view.rerender(tree())
    expect(screen.queryByText("fresh-next")).toBeNull()
    await act(async () => { nextReply.resolve(freshNext.data); await nextReply.promise })
    expect(screen.getByText("fresh-first")).toBeTruthy()
    expect(screen.getByText("fresh-next")).toBeTruthy()
    expect(screen.queryByText("cached-next")).toBeNull()
  })
  it("ne réautorise ni une ancienne frontière ni le cache de sa remplaçante", async () => {
    const firstReply = deferredPage()
    const oldReply = deferredPage()
    const newReply = deferredPage()
    const first = { ...ok([bookmark("cached-first")], "old"), retry: vi.fn().mockReturnValue(firstReply.promise) }
    const old = { ...ok([bookmark("cached-old")]), retry: vi.fn().mockReturnValue(oldReply.promise) }
    const next = { ...ok([bookmark("cached-new")]), retry: vi.fn().mockReturnValue(newReply.promise) }
    mocks.pages.set(key(null), first)
    mocks.pages.set(key("old"), old)
    mocks.pages.set(key("new"), next)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: MORE }))
    mocks.pages.set(key("old"), { ...old, error: "status_insufficient" })
    view.rerender(tree())
    const freshFirst = ok([bookmark("fresh-first")], "new")
    mocks.pages.set(key(null), { ...freshFirst, retry: first.retry })
    view.rerender(tree())
    await act(async () => { firstReply.resolve(freshFirst.data); await firstReply.promise })
    expect(next.retry).toHaveBeenCalledOnce()
    expect(screen.queryByRole("list")).toBeNull()
    await act(async () => { oldReply.resolve(ok([bookmark("stale-reply")]).data); await oldReply.promise })
    expect(screen.queryByRole("list")).toBeNull()
    const freshNext = ok([bookmark("fresh-new")])
    mocks.pages.set(key("new"), { ...freshNext, retry: next.retry })
    view.rerender(tree())
    await act(async () => { newReply.resolve(freshNext.data); await newReply.promise })
    expect(screen.getByText("fresh-first")).toBeTruthy()
    expect(screen.getByText("fresh-new")).toBeTruthy()
    expect(screen.queryByText("cached-new")).toBeNull()
    expect(screen.queryByText("stale-reply")).toBeNull()
  })
  it("ignore une réponse de reprise remplacée par une nouvelle tentative", async () => {
    const oldReply = deferredPage()
    const newReply = deferredPage()
    const page = { ...ok([bookmark("private")]), retry: vi.fn().mockReturnValueOnce(oldReply.promise).mockReturnValue(newReply.promise) }
    mocks.pages.set(key(null), page)
    const view = render(tree())
    mocks.pages.set(key(null), { ...page, error: "not_found" })
    view.rerender(tree())
    fireEvent.click(screen.getByRole("button", { name: "Réessayer" }))
    await act(async () => { oldReply.resolve(ok([bookmark("obsolete")]).data); await oldReply.promise })
    expect(screen.queryByRole("list")).toBeNull()
    const fresh = ok([bookmark("fresh")])
    mocks.pages.set(key(null), { ...fresh, retry: page.retry })
    view.rerender(tree())
    await act(async () => { newReply.resolve(fresh.data); await newReply.promise })
    expect(screen.getByText("fresh")).toBeTruthy()
    expect(screen.queryByText("obsolete")).toBeNull()
  })
})

describe("/enregistrements — retrait protégé", () => {
  it("verrouille immédiatement les doubles clics sans retrait avant le succès", async () => {
    const pending = deferred()
    mocks.toggle.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok([bookmark("one")]))
    render(tree())
    const button = screen.getByRole("button", { name: REMOVE })
    act(() => { button.click(); button.click() })
    expect(mocks.toggle).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(screen.getByText("one")).toBeTruthy()
    await act(async () => { pending.resolve({ ok: true, value: { bookmarked: false } }); await pending.promise })
    expect(screen.queryByText("one")).toBeNull()
    expect(mocks.success).toHaveBeenCalledOnce()
  })
  it("ne verrouille pas l'autre ligne pendant le retrait", async () => {
    const pending = deferred()
    mocks.toggle.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok([bookmark("one"), bookmark("two")]))
    render(tree())
    const rows = screen.getAllByRole("listitem")
    fireEvent.click(within(rows[0]!).getByRole("button"))
    expect(within(rows[1]!).getByRole("button")).not.toBeDisabled()
    await act(async () => { pending.resolve({ ok: true, value: { bookmarked: false } }); await pending.promise })
  })
  it.each(["refusal", "exception"] as const)("garde la ligne et réactive la commande après %s", async (failure) => {
    if (failure === "refusal") mocks.toggle.mockResolvedValue({ ok: false, code: "rate_limited" as ActionErrorCode })
    else mocks.toggle.mockRejectedValue(new Error("private trace"))
    mocks.pages.set(key(null), ok([bookmark("one")]))
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: REMOVE })) })
    expect(screen.getByText("one")).toBeTruthy()
    expect(screen.getByRole("button", { name: REMOVE })).not.toBeDisabled()
    expect(mocks.error).toHaveBeenCalledOnce()
    expect(mocks.error.mock.calls[0]![0]).not.toContain("private trace")
  })
  it.each(["not_found", "status_insufficient", "suspended"] as const)("un retrait refusé %s ferme les projections sans annoncer le signet retiré", async (code) => {
    mocks.toggle.mockResolvedValue({ ok: false, code })
    const page = ok([bookmark("private")])
    mocks.pages.set(key(null), page)
    const view = render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: REMOVE })) })
    expect(screen.queryByText("private")).toBeNull()
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(page.retry).toHaveBeenCalledOnce()
    expect(mocks.toggle).toHaveBeenCalledOnce()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).toHaveBeenCalledOnce()
    mocks.pages.set(key(null), { ...page, isLoading: true })
    view.rerender(tree())
    expect(screen.queryByText("private")).toBeNull()
  })
  it("revalide les pages après un retrait interdit et respecte la nouvelle projection sans succès de retrait", async () => {
    mocks.toggle.mockResolvedValue({ ok: false, code: "not_found" })
    const response = deferredPage()
    const first = { ...ok([bookmark("private")]), retry: vi.fn().mockReturnValue(response.promise) }
    mocks.pages.set(key(null), first)
    const view = render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: REMOVE })) })
    expect(screen.queryByText("private")).toBeNull()
    const fresh = ok([])
    mocks.pages.set(key(null), { ...fresh, retry: first.retry })
    view.rerender(tree())
    await act(async () => { response.resolve(fresh.data); await response.promise })
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByRole("list")).toBeNull()
    expect(mocks.toggle).toHaveBeenCalledOnce()
    expect(mocks.success).not.toHaveBeenCalled()
  })
  it("ne prétend pas avoir retiré un signet si le serveur répond bookmarked=true", async () => {
    mocks.toggle.mockResolvedValue({ ok: true, value: { bookmarked: true } })
    mocks.pages.set(key(null), ok([bookmark("one")]))
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: REMOVE })) })
    expect(screen.getByText("one")).toBeTruthy()
    expect(mocks.success).not.toHaveBeenCalled()
  })
  it("une version réenregistrée reste libre et ignore l'avis de l'ancien retrait", async () => {
    const pending = deferred()
    mocks.toggle.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok([bookmark("one", "one", 2)]))
    const view = render(tree())
    const oldButton = screen.getByRole("button", { name: REMOVE })
    fireEvent.click(oldButton)
    expect(oldButton).toBeDisabled()
    mocks.pages.set(key(null), ok([bookmark("one", "one", 3)]))
    view.rerender(tree())
    const newButton = screen.getByRole("button", { name: REMOVE })
    expect(newButton).not.toBe(oldButton)
    expect(newButton).not.toBeDisabled()
    await act(async () => { pending.resolve({ ok: true, value: { bookmarked: false } }); await pending.promise })
    expect(screen.getByText("one")).toBeTruthy()
    expect(newButton).not.toBeDisabled()
    expect(mocks.toggle).toHaveBeenCalledTimes(1)
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
  it.each(["success", "error"] as const)("ignore la résolution %s d'un retrait de l'ancien lecteur", async (resolution) => {
    const pending = deferred()
    mocks.toggle.mockReturnValue(pending.promise)
    mocks.pages.set(key(null), ok([bookmark("one")]))
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: REMOVE }))
    mocks.membership = { ...MEMBER, personId: "new-person" }
    mocks.network = { networkId: "network-diasporale", personId: "new-person" }
    mocks.pages.set(key(null), ok([bookmark("one")]))
    view.rerender(tree())
    await act(async () => {
      if (resolution === "success") pending.resolve({ ok: true, value: { bookmarked: false } })
      else pending.reject(new Error("old private trace"))
      try { await pending.promise } catch { /* Refus traité par la ligne démontée. */ }
    })
    expect(screen.getByText("one")).toBeTruthy()
    expect(mocks.success).not.toHaveBeenCalled()
    expect(mocks.error).not.toHaveBeenCalled()
  })
})
