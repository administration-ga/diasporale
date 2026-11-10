// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { FeedDiscoveryProps } from "@diasporale/features"
import type { AssociationEventsCapability, CountryEventsPage, CountryEventsRequest, CountryHubView, Loadable, MembershipView } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { FeedPagesProps } from "@/components/feed-pages"
import { FeedRail, FeedScreen } from "./feed-screen"

const mocks = vi.hoisted(() => ({
  search: "",
  showEmpty: false,
  listPost: null as string | null,
  feed: vi.fn(),
  discovery: vi.fn(),
  stories: vi.fn(),
  gate: vi.fn(),
  push: vi.fn(),
  membership: null as MembershipView | null,
  hub: { status: "loading" } as Loadable<CountryHubView>,
  associationEvents: null as Pick<AssociationEventsCapability, "useCountryEvents"> | null,
}))
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.search), useRouter: () => ({ push: mocks.push }) }))
// Un lien ordinaire : l'adresse rendue est celle de la table des routes, sans navigation réelle dans jsdom.
vi.mock("next/link", () => ({
  default: ({ href, children, scroll: _scroll, onClick, ...rest }: ComponentProps<"a"> & { href: string; scroll?: boolean }) => (
    <a href={href} {...rest} onClick={(event) => { onClick?.(event); event.preventDefault() }}>{children}</a>
  ),
}))
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
vi.mock("@/components/feed-pages", () => ({
  FeedPages: (props: FeedPagesProps) => {
    mocks.feed(props)
    return (
      <div aria-label="Fil autorisé">
        {mocks.showEmpty ? props.emptyFallback : null}
        {mocks.listPost ? (
          <article aria-labelledby={`post-${mocks.listPost}-auteur`}>
            <a id={`post-${mocks.listPost}-auteur`} href="/@autrice">Autrice de recette</a>
          </article>
        ) : null}
      </div>
    )
  },
}))
vi.mock("@/components/feed-stories", () => ({ FeedStories: () => { mocks.stories(); return null } }))
vi.mock("@/components/status-banner", () => ({ StatusBanner: () => null }))
vi.mock("@diasporale/features", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@diasporale/features")>()
  return {
    ...actual,
    FeedDiscovery: (props: FeedDiscoveryProps) => {
      mocks.discovery(props)
      return <section aria-label="Découverte autorisée">{props.toolbarStart}{mocks.showEmpty ? props.emptyFallback : null}</section>
    },
    // Le rail isole sa carte du hub : les suggestions ont leurs propres scénarios.
    MemberSuggestions: () => null,
  }
})
// Seul le rail lit le hub de son pays ; le fil n'en dépend pas.
vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useCountryHub: () => mocks.hub,
  // HB-02 : la capacité des évènements du pays, absente par défaut (fournisseur qui ne la sert pas).
  useOptionalDataSource: () => (mocks.associationEvents ? { associationEvents: mocks.associationEvents } : null),
}))

const MEMBER: MembershipView = {
  personId: "person-recette", handle: "recette", displayName: "Recette", status: "en_attente", badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: false, rateTier: "reinforced", directoryVisibility: "hidden",
}
function tree(locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}><FeedScreen /></I18nProvider>
}
const lastDiscovery = () => mocks.discovery.mock.lastCall![0] as FeedDiscoveryProps
beforeEach(() => {
  mocks.search = ""
  mocks.showEmpty = false
  mocks.listPost = null
  mocks.associationEvents = null
  mocks.membership = { ...MEMBER }
  mocks.hub = { status: "loading" }
  vi.clearAllMocks()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

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

describe("/fil — bascule Liste / Découverte (DG-017)", () => {
  it.each([
    { locale: "fr" as const, group: "Affichage du fil", list: "Liste", discovery: "Découverte" },
    { locale: "en" as const, group: "Feed view", list: "List", discovery: "Discovery" },
  ])("la liste reste le mode par défaut ; la bascule garde portée, filtre et pays en $locale", ({ locale, group, list, discovery }) => {
    mocks.search = "scope=diaspora&tag=gabon&country=CA"
    render(tree(locale))
    expect(screen.getByRole("navigation", { name: group })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: list })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: list })).toHaveAttribute("href", "/fil?scope=diaspora&tag=gabon&country=CA")
    expect(screen.getByRole("link", { name: discovery })).toHaveAttribute("href", "/fil?scope=diaspora&tag=gabon&country=CA&vue=decouverte")
    expect(screen.getByRole("link", { name: discovery })).not.toHaveAttribute("aria-current")
    expect(mocks.feed).toHaveBeenCalled()
    expect(mocks.discovery).not.toHaveBeenCalled()
    expect(mocks.stories).toHaveBeenCalled()
  })

  it("`?vue=decouverte` ouvre la découverte sur la même source, et la portée comme le filtre y restent", () => {
    mocks.search = "scope=mon_pays&tag=%C3%A9t%C3%A9&country=CA&vue=decouverte"
    render(tree())
    expect(mocks.feed).not.toHaveBeenCalled()
    expect(mocks.stories).not.toHaveBeenCalled()
    expect(lastDiscovery()).toEqual(expect.objectContaining({ scope: "mon_pays", tag: "été", hubCountry: "CA", membership: MEMBER }))
    expect(screen.getByRole("link", { name: "Découverte" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Liste" })).toHaveAttribute("href", "/fil?scope=mon_pays&tag=%C3%A9t%C3%A9&country=CA")
    expect(screen.getByRole("link", { name: "Toute la diaspora" })).toHaveAttribute("href", "/fil?scope=diaspora&tag=%C3%A9t%C3%A9&country=CA&vue=decouverte")
    expect(screen.getByRole("link", { name: "Retirer le filtre" })).toHaveAttribute("href", "/fil?scope=mon_pays&country=CA&vue=decouverte")
    expect(screen.queryByText("Canada, et ce qui concerne toute la diaspora.")).toBeNull()
  })

  it("une valeur inconnue du mode garde la liste", () => {
    mocks.search = "vue=autre"
    render(tree())
    expect(mocks.feed).toHaveBeenCalled()
    expect(mocks.discovery).not.toHaveBeenCalled()
  })

  it("un fil vide montre le même état vide dans la découverte", () => {
    mocks.search = "scope=recents&vue=decouverte"
    mocks.showEmpty = true
    render(tree())
    expect(screen.getByText("Aucune publication à lire pour l'instant.")).toBeTruthy()
  })

  it("Échap revient à la liste et s'y recale sur la publication active, focus compris", () => {
    mocks.search = "scope=diaspora&country=CA&vue=decouverte"
    const view = render(tree())
    act(() => lastDiscovery().onExit("post-042"))
    expect(mocks.push).toHaveBeenCalledWith("/fil?scope=diaspora&country=CA", { scroll: false })

    const scrolled = vi.fn()
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrolled })
    mocks.search = "scope=diaspora&country=CA"
    mocks.listPost = "post-042"
    view.rerender(tree())
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Autrice de recette" }))
    expect(scrolled).toHaveBeenCalledWith({ block: "center" })
    Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
  })

  it("la bascule « Liste » ramène la liste sur l'élément actif de la découverte", () => {
    mocks.search = "scope=diaspora&vue=decouverte"
    const view = render(tree())
    act(() => lastDiscovery().onActiveChange?.("post-007"))
    fireEvent.click(screen.getByRole("link", { name: "Liste" }))
    mocks.search = "scope=diaspora"
    mocks.listPost = "post-007"
    view.rerender(tree())
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Autrice de recette" }))
  })

  it("si la publication n'est pas dans les pages de la liste, le focus revient sur la bascule", () => {
    vi.useFakeTimers()
    mocks.search = "scope=diaspora&vue=decouverte"
    const view = render(tree())
    act(() => lastDiscovery().onExit("post-lointaine"))
    mocks.search = "scope=diaspora"
    view.rerender(tree())
    act(() => { vi.advanceTimersByTime(2_100) })
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Liste" }))
  })
})

describe("/fil — le rail du hub ne dit aucun nombre d'évènements non mesuré (EV-02)", () => {
  const HUB: CountryHubView = {
    country: "FR",
    open: true,
    counters: {
      dormant: false,
      members: { kind: "below_threshold", threshold: 20 },
      associations: { kind: "value", value: 3 },
      companies: { kind: "value", value: 1 },
      upcomingEvents: { kind: "value", value: 0 },
    },
    countersSource: "materialized",
    countersComputedAt: Date.UTC(2026, 10, 9, 2, 30),
    officialPages: [],
    associations: [],
    companies: [],
    events: [],
    eventsSource: "unmeasured",
  }
  const rail = () => render(<I18nProvider locale="fr"><FeedRail membership={MEMBER} /></I18nProvider>)

  it("moteur : le compteur d'associations reste ; ni nombre ni « aucun évènement », un renvoi vers l'agenda", () => {
    mocks.hub = { status: "ready", data: HUB }
    rail()
    expect(screen.getByText("Associations")).toBeTruthy()
    expect(screen.queryByText("Évènements à venir")).toBeNull()
    expect(screen.queryByText("Aucun évènement prévu pour l'instant.")).toBeNull()
    expect(screen.getByText("Les évènements se publient sur la page de chaque association. Ceux auxquels vous êtes inscrit sont dans votre agenda.")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Mon agenda" })).toHaveAttribute("href", "/agenda")
  })

  it("avant la lecture du hub, rien n'est affirmé", () => {
    rail()
    expect(screen.queryByText("Aucun évènement prévu pour l'instant.")).toBeNull()
    expect(screen.queryByText("Évènements à venir")).toBeNull()
  })

  it("démonstration : les évènements comptés gardent leur compteur", () => {
    mocks.hub = { status: "ready", data: { ...HUB, countersSource: "demo", eventsSource: "demo" } }
    rail()
    expect(screen.getByText("Évènements à venir")).toBeTruthy()
    expect(screen.getByText("Aucun évènement prévu pour l'instant.")).toBeTruthy()
  })
})

describe("/fil — le rail lit les prochains évènements du pays par la capacité des évènements (HB-02)", () => {
  const HUB: CountryHubView = {
    country: "FR",
    open: true,
    counters: {
      dormant: false,
      members: { kind: "below_threshold", threshold: 20 },
      associations: { kind: "value", value: 3 },
      companies: { kind: "value", value: 1 },
      upcomingEvents: { kind: "value", value: 0 },
    },
    countersSource: "materialized",
    countersComputedAt: Date.UTC(2026, 10, 9, 2, 30),
    officialPages: [],
    associations: [],
    companies: [],
    events: [],
    eventsSource: "unmeasured",
  }
  const START = Date.UTC(2030, 5, 12, 17)
  const event = (id: string, title: string) => ({
    eventId: id, pageId: "page-lyon", title, location: "Lyon", startAt: START, endAt: START + 3_600_000, timeZone: "Europe/Paris",
    organizer: { name: "Association de Lyon", handle: "association-lyon" },
  })
  function serve(result: Loadable<CountryEventsPage>) {
    const requests: CountryEventsRequest[] = []
    mocks.associationEvents = { useCountryEvents: (request) => { requests.push(request); return result } }
    return requests
  }
  const rail = () => render(<I18nProvider locale="fr"><FeedRail membership={MEMBER} /></I18nProvider>)

  it("montre au plus trois évènements du pays de résidence, chacun vers sa fiche, puis le hub", () => {
    const requests = serve({ status: "ready", data: { items: [event("evt-1", "Pique-nique de rentrée"), event("evt-2", "Assemblée générale")], continueCursor: null, isDone: true, partial: false } })
    mocks.hub = { status: "ready", data: HUB }
    rail()
    expect(requests[0]).toMatchObject({ country: "FR", cursor: null, limit: 3 })
    expect(screen.getByRole("link", { name: "Pique-nique de rentrée" })).toHaveAttribute("href", "/pages/association-lyon/evenements/evt-1")
    expect(screen.getByRole("link", { name: "Assemblée générale" })).toHaveAttribute("href", "/pages/association-lyon/evenements/evt-2")
    expect(screen.getByRole("link", { name: "Voir les évènements du pays" })).toHaveAttribute("href", "/pays/fr")
    // Non mesuré, aucun nombre ; plus de renvoi « se publient sur la page de chaque association ».
    expect(screen.queryByText("Évènements à venir")).toBeNull()
    expect(screen.queryByText(/Les évènements se publient sur la page de chaque association/)).toBeNull()
  })

  it("compteur mesuré par le passage nocturne : il s'affiche dans la carte du hub", () => {
    serve({ status: "ready", data: { items: [], continueCursor: null, isDone: true, partial: false } })
    mocks.hub = { status: "ready", data: { ...HUB, eventsSource: "materialized", counters: { ...HUB.counters, upcomingEvents: { kind: "value", value: 2 } } } }
    rail()
    expect(screen.getByText("Évènements à venir")).toBeTruthy()
  })

  it("aucun évènement à venir : le rail le dit et renvoie à l'agenda", () => {
    serve({ status: "ready", data: { items: [], continueCursor: null, isDone: true, partial: false } })
    mocks.hub = { status: "ready", data: HUB }
    rail()
    expect(screen.getByText("Aucun évènement à venir ouvert au réseau dans votre pays.")).toBeTruthy()
    expect(screen.getByRole("link", { name: "Mon agenda" })).toHaveAttribute("href", "/agenda")
  })

  it("une lecture refusée ne se dit pas « aucun évènement », et rien n'est affirmé pendant le chargement", () => {
    serve({ status: "error", code: "network_unavailable" })
    mocks.hub = { status: "ready", data: HUB }
    rail()
    expect(screen.getByText("Les évènements de votre pays ne se lisent pas pour l'instant.")).toBeTruthy()
    expect(screen.queryByText("Aucun évènement à venir ouvert au réseau dans votre pays.")).toBeNull()
    cleanup()
    serve({ status: "loading" })
    rail()
    expect(screen.queryByText("Aucun évènement à venir ouvert au réseau dans votre pays.")).toBeNull()
    expect(screen.queryByText("Les évènements de votre pays ne se lisent pas pour l'instant.")).toBeNull()
  })
})
