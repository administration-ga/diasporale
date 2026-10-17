// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { MembershipView } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { FeedPagesProps } from "@/components/feed-pages"
import { FeedScreen } from "./feed-screen"

const mocks = vi.hoisted(() => ({ search: "", showEmpty: false, feed: vi.fn(), gate: vi.fn(), membership: null as MembershipView | null }))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.search) }))
vi.mock("@/components/gate", () => ({
  Gate: (props: { require: string; children: (session: { membership: MembershipView | null }) => ReactNode }) => {
    mocks.gate(props.require)
    return <>{props.children({ membership: mocks.membership })}</>
  },
}))
vi.mock("@/components/app-shell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <>{children}</>,
  useComposer: () => ({ canPublish: false, open: vi.fn() }),
}))
vi.mock("@/components/feed-pages", () => ({ FeedPages: (props: FeedPagesProps) => { mocks.feed(props); return <div aria-label="Fil autorisé">{mocks.showEmpty ? props.emptyFallback : null}</div> } }))
vi.mock("@/components/feed-stories", () => ({ FeedStories: () => null }))
vi.mock("@/components/status-banner", () => ({ StatusBanner: () => null }))

const MEMBER: MembershipView = {
  personId: "person-recette", handle: "recette", displayName: "Recette", status: "en_attente", badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: false, rateTier: "reinforced", directoryVisibility: "hidden",
}
function tree(locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}><FeedScreen /></I18nProvider>
}
beforeEach(() => {
  mocks.search = ""
  mocks.showEmpty = false
  mocks.membership = { ...MEMBER }
  vi.clearAllMocks()
})
afterEach(cleanup)

describe("/fil — filtre de mot-dièse", () => {
  it.each([
    { locale: "fr" as const, label: "Publications avec #été", clear: "Retirer le filtre", diaspora: "Toute la diaspora" },
    { locale: "en" as const, label: "Posts tagged #été", clear: "Clear filter", diaspora: "The whole diaspora" },
  ])("annonce le filtre et conserve pays et portée en $locale", ({ locale, label, clear, diaspora }) => {
    mocks.search = new URLSearchParams({ scope: "mon_pays", tag: "ÉTÉ", country: "ca" }).toString()
    render(tree(locale))
    expect(mocks.gate).toHaveBeenCalledWith("member")
    expect(mocks.feed).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "mon_pays", tag: "été", hubCountry: "CA", membership: MEMBER }))
    expect(screen.getByText(label)).toBeTruthy()
    expect(screen.getByRole("link", { name: clear })).toHaveAttribute("href", "/fil?scope=mon_pays&country=CA")
    expect(screen.getByRole("link", { name: diaspora })).toHaveAttribute("href", "/fil?scope=diaspora&tag=%C3%A9t%C3%A9&country=CA")
    expect(screen.getByRole("link", { name: "Canada" })).toHaveAttribute("aria-current", "page")
  })
  it("un jeton Unicode canonique reste entier dans la lecture et les liens de portée", () => {
    mocks.search = new URLSearchParams({ scope: "recents", tag: "İSTANBUL", country: "CA" }).toString()
    render(tree())
    expect(mocks.feed).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "recents", tag: "i̇stanbul", hubCountry: "CA" }))
    expect(screen.getByText("Publications avec #i̇stanbul")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Toute la diaspora" })).toHaveAttribute("href", "/fil?scope=diaspora&tag=i%CC%87stanbul&country=CA")
    expect(screen.getByRole("link", { name: "Retirer le filtre" })).toHaveAttribute("href", "/fil?scope=recents&country=CA")
  })
  it.each([
    { locale: "fr" as const, title: "Aucune publication avec #été", body: "Essayez une autre portée ou retirez le filtre. Seules les publications que vous pouvez lire apparaissent." },
    { locale: "en" as const, title: "No posts tagged #été", body: "Try another feed scope or clear the filter. Only posts you can read are shown." },
  ])("un filtre vide ne prétend pas que tout le hub est vide en $locale", ({ locale, title, body }) => {
    mocks.search = "scope=mon_pays&tag=%C3%A9t%C3%A9&country=CA"
    mocks.showEmpty = true
    render(tree(locale))
    expect(screen.getByText(title)).toBeTruthy()
    expect(screen.getByText(body)).toBeTruthy()
    const props = mocks.feed.mock.lastCall![0] as FeedPagesProps
    expect(props.tag).toBe("été")
    expect(props.membership.canPublish).toBe(false)
  })
  it.each(["XX", "GA", "<script>"])("ignore le pays invalide %s et conserve le filtre sans modifier la personne", (country) => {
    mocks.search = new URLSearchParams({ scope: "pour_vous", tag: "gabon", country }).toString()
    render(tree())
    const props = mocks.feed.mock.lastCall![0] as FeedPagesProps
    expect(props.scope).toBe("pour_vous")
    expect(props.tag).toBe("gabon")
    expect(props.hubCountry).toBeUndefined()
    expect(props.membership).toEqual(MEMBER)
    expect(screen.getByRole("link", { name: "France" })).toHaveAttribute("href", "/fil?scope=mon_pays&tag=gabon")
    expect(screen.getByRole("link", { name: "Retirer le filtre" })).toHaveAttribute("href", "/fil?scope=pour_vous")
  })
  it("ne crée aucun filtre pour une valeur vide et conserve les adresses usuelles", () => {
    mocks.search = new URLSearchParams({ tag: " \t " }).toString()
    render(tree())
    const props = mocks.feed.mock.lastCall![0] as FeedPagesProps
    expect(props.tag).toBeUndefined()
    expect(props.hubCountry).toBeUndefined()
    expect(props.scope).toBe("mon_pays")
    expect(screen.queryByRole("link", { name: "Retirer le filtre" })).toBeNull()
    expect(screen.getByRole("link", { name: "Toute la diaspora" })).toHaveAttribute("href", "/fil?scope=diaspora")
  })
  it("relit le filtre de l'adresse et son retrait sans changer les droits du lecteur", () => {
    mocks.search = "scope=diaspora&tag=gabon&country=CA"
    const view = render(tree())
    mocks.search = "scope=diaspora&tag=formation&country=CA"
    view.rerender(tree())
    expect(mocks.feed).toHaveBeenLastCalledWith(expect.objectContaining({ scope: "diaspora", tag: "formation", hubCountry: "CA", membership: MEMBER }))
    mocks.search = "scope=diaspora&country=CA"
    view.rerender(tree())
    const props = mocks.feed.mock.lastCall![0] as FeedPagesProps
    expect(props.tag).toBeUndefined()
    expect(props.hubCountry).toBe("CA")
    expect(props.membership.canPublish).toBe(false)
    expect(screen.queryByRole("link", { name: "Retirer le filtre" })).toBeNull()
  })
})
