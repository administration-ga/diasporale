// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { RoutingProvider, type FeatureRoutes, type LinkComponent } from "@diasporale/features"
import {
  DataSourceProvider,
  type DiasporaleActions,
  type DiasporaleDataSource,
  type Loadable,
  type MembershipView,
  type ModerationDeskView,
  type PilotMetricsAccessView,
} from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps, ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { IcomNetwork } from "@/lib/icom-state"
import { ACCOUNT_DESTINATIONS, PRIMARY_DESTINATIONS, ROUTE_DESTINATIONS, type NavDestination, type RouteKey } from "@/lib/nav-destinations"
import { routes } from "@/lib/routes"

import { AppShell, useComposer } from "./app-shell"

const mocks = vi.hoisted(() => ({
  pathname: "/fil",
  icom: null as IcomNetwork | null,
  network: null as IcomNetwork | null,
  desktop: true,
  composer: vi.fn(),
  /** Les rendus du lecteur des non-lus : aucun tant qu'iCom est fermé. */
  unreadReads: 0,
  /** Le chiffre que le lecteur remonte à la coque, comme le ferait le serveur. */
  reportUnread: null as ((total: number) => void) | null,
}))

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Un lien ordinaire : suivre un lien dans un test ne déclenche aucune navigation de jsdom.
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, ...rest }: Omit<ComponentProps<"a">, "href"> & { href: string }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event)
        event.preventDefault()
      }}
    >
      {children}
    </a>
  ),
}))

// iCom et le dock du moteur : des sondes, sans Convex ni couche de communication.
vi.mock("@/components/icom", () => ({
  useIcomNetwork: () => mocks.icom,
  useEngineNetwork: () => mocks.network,
  IcomIsland: (props: { children: ReactNode }) => <>{props.children}</>,
}))
vi.mock("@antsia/social-features/messagerie", () => ({ MessagerieDock: () => <section aria-label="Carte iCom" /> }))
// Le lecteur des non-lus a ses propres tests (deux décomptes du serveur) : ici, une sonde que le test fait parler.
vi.mock("@/components/messages-unread", () => ({
  MessagesUnreadReader: (props: { onTotal: (total: number) => void }) => {
    mocks.unreadReads += 1
    mocks.reportUnread = props.onTotal
    return null
  },
}))
vi.mock("@antsia/ui/overlay", () => ({ useIsReseauMobile: () => !mocks.desktop }))

// Le composeur a ses propres tests : ici, une sonde qui dit s'il est ouvert et avec quoi.
vi.mock("@diasporale/features", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features")>()),
  PostComposerSheet: (props: { open: boolean; share?: unknown; memberCountry: string; draftKey?: string }) => {
    mocks.composer(props)
    return props.open ? <div role="dialog" aria-label={props.share === undefined ? "Composeur" : "Partage"} /> : null
  },
}))

const NOW = Date.UTC(2026, 9, 18, 12)
const t = getFixedT("fr")

const MEMBER: MembershipView = {
  personId: "persons_awa",
  handle: "awa.demo",
  displayName: "Awa Ogooué",
  status: "declaree",
  badges: ["community"],
  facet: { countryOfResidence: "FR", city: "Lyon", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: null,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "reinforced",
  directoryVisibility: "hidden",
}

const NETWORK = { networkId: "networks_diasporale", slug: "diasporale", personId: MEMBER.personId } as IcomNetwork

const featureRoutes: FeatureRoutes = {
  profile: routes.profile,
  post: routes.post,
  page: routes.page,
  hub: routes.hub,
  feed: (tag, context) => routes.feed(context?.scope, tag, context?.country),
  sponsor: routes.sponsor,
  settings: routes.settings,
  attestation: routes.attestation,
  enter: routes.enter,
}
const Link: LinkComponent = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
)

/** Un écran qui ouvre le composeur de la coque (« Quoi de neuf ? »), comme le fil. */
function ComposerProbe() {
  const composer = useComposer()
  return (
    <button type="button" onClick={composer.open} disabled={!composer.canPublish}>
      Quoi de neuf ?
    </button>
  )
}

/** Un responsable reconnu par le serveur : modérateur du réseau et lecteur de la mesure du pilote (lectures stables). */
const RESPONSIBLE_DESK: Loadable<ModerationDeskView | null> = {
  status: "ready",
  data: { role: "network_admin", networkWide: true, canReviewAppeals: true, canManageTeams: true, teams: [] },
}
const PILOT_ALLOWED: Loadable<PilotMetricsAccessView> = { status: "ready", data: { allowed: true } }

function withResponsibleAccess(source: DiasporaleDataSource): DiasporaleDataSource {
  const { moderationDesk, pilotMetrics } = source
  if (!moderationDesk || !pilotMetrics) throw new Error("La démonstration sert la modération et la mesure du pilote.")
  return { ...source, moderationDesk: { ...moderationDesk, useDesk: () => RESPONSIBLE_DESK }, pilotMetrics: { ...pilotMetrics, useAccess: () => PILOT_ALLOWED } }
}

function renderShell(
  options: {
    pathname?: string
    membership?: MembershipView
    icom?: boolean
    network?: boolean
    responsible?: boolean
    locale?: "fr" | "en"
    actions?: Partial<DiasporaleActions>
  } = {},
) {
  mocks.pathname = options.pathname ?? "/fil"
  mocks.icom = options.icom ? NETWORK : null
  mocks.network = options.network ?? options.icom ? NETWORK : null
  const demo = createDemoDataSource(new DemoStore(null, () => NOW, 0))
  const source = options.responsible ? withResponsibleAccess(demo) : demo
  return render(
    <I18nProvider locale={options.locale ?? "fr"}>
      <DataSourceProvider source={{ ...source, actions: { ...source.actions, ...options.actions } }}>
        <RoutingProvider routes={featureRoutes} Link={Link}>
          <AppShell membership={options.membership ?? MEMBER}>
            <ComposerProbe />
          </AppShell>
        </RoutingProvider>
      </DataSourceProvider>
    </I18nProvider>,
  )
}

/** Le rail du bureau et la barre basse : deux navigations principales, une seule visible selon la largeur. */
function mainNavigations(locale: "fr" | "en" = "fr") {
  const navs = screen.getAllByRole("navigation", { name: locale === "fr" ? "Navigation principale" : "Main navigation" })
  expect(navs).toHaveLength(2)
  return { rail: navs[0]!, bar: navs[1]! }
}

function linksOf(container: HTMLElement) {
  return within(container)
    .getAllByRole("link")
    .map((link) => [link.textContent, link.getAttribute("href")])
}

/** Les entrées d'un menu : Radix donne aux liens le rôle « menuitem ». */
function menuItemsOf(container: HTMLElement) {
  return within(container)
    .getAllByRole("menuitem")
    .map((item) => [item.textContent, item.getAttribute("href")])
}

function currentLinks(container: HTMLElement) {
  return within(container)
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent)
}

function accountTrigger(kind: "menu" | "dialog", name = "Menu du compte (Awa Ogooué)") {
  const trigger = screen
    .getAllByRole("button", { name })
    .find((button) => button.getAttribute("aria-haspopup") === kind)
  expect(trigger).toBeDefined()
  return trigger!
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.desktop = true
  mocks.unreadReads = 0
  mocks.reportUnread = null
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** La navigation de page (`window.location.assign`), que jsdom n'exécute pas. */
function stubPageNavigation() {
  const assign = vi.fn()
  vi.stubGlobal("window", new Proxy(window, {
    get(target, property) {
      return property === "location" ? { assign } : Reflect.get(target, property, target)
    },
  }))
  return assign
}

/** Une sortie que le test termine quand il le décide. */
function pendingSignOut() {
  let finish: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const action = vi.fn<DiasporaleActions["signOutEverywhere"]>().mockReturnValueOnce(pending)
  return { action, pending, finish: () => finish() }
}

describe("coque — les cinq destinations (DG-005)", () => {
  it("pose Fil, Explorer, Services, Communautés et Messages dans cet ordre, au bureau comme au téléphone", () => {
    renderShell({ icom: true })
    const { rail, bar } = mainNavigations()
    const expected = [
      ["Fil", "/fil"],
      ["Explorer", "/explorer"],
      ["Services", "/services"],
      ["Communautés", "/communautes"],
      ["Messages", "/messages"],
    ]
    expect(linksOf(rail)).toEqual(expected)
    expect(linksOf(bar)).toEqual(expected)
    expect(within(bar).getAllByRole("listitem")).toHaveLength(5)
  })

  it("parle anglais avec les mêmes adresses", () => {
    renderShell({ icom: true, locale: "en" })
    const { bar } = mainNavigations("en")
    expect(linksOf(bar)).toEqual([
      ["Feed", "/fil"],
      ["Explore", "/explorer"],
      ["Services", "/services"],
      ["Communities", "/communautes"],
      ["Messages", "/messages"],
    ])
  })

  it("sans iCom (démonstration), Messages disparaît sans laisser de trou dans la barre", () => {
    renderShell({ icom: false })
    const { rail, bar } = mainNavigations()
    expect(within(bar).getAllByRole("listitem")).toHaveLength(4)
    expect(linksOf(bar).map(([label]) => label)).toEqual(["Fil", "Explorer", "Services", "Communautés"])
    expect(within(rail).queryByRole("link", { name: "Messages" })).toBeNull()
  })

  it.each([
    ["/fil", "Fil"],
    ["/publication/post-12", "Fil"],
    ["/actus", "Fil"],
    ["/explorer", "Explorer"],
    ["/membres", "Explorer"],
    ["/services", "Services"],
    ["/services/offre-coiffure", "Services"],
    ["/communautes", "Communautés"],
    ["/pays/fr", "Communautés"],
    ["/pays/ca", "Communautés"],
    ["/messages", "Messages"],
    ["/messages/conversation-7", "Messages"],
    // Décision 5 du plan 02 (UX-05) : la vie communautaire sous Communautés, les pages et les autres membres sous Explorer.
    ["/entraide", "Communautés"],
    ["/entraide/question-1", "Communautés"],
    ["/kit-arrivee", "Communautés"],
    ["/mentorat/mentor-1", "Communautés"],
    ["/emploi/offre-1", "Communautés"],
    ["/talents", "Communautés"],
    ["/agenda", "Communautés"],
    ["/pages/asso-lyon/groupe", "Communautés"],
    ["/pages/asso-lyon/evenements/evt-42", "Communautés"],
    ["/pages", "Explorer"],
    ["/pages/asso-lyon", "Explorer"],
    ["/pages/asso-lyon/revendiquer", "Explorer"],
    ["/@autre.membre", "Explorer"],
    ["/@autre.membre/albums/album-1", "Explorer"],
  ])("sur %s, seule la destination « %s » est courante", (pathname, current) => {
    renderShell({ pathname, icom: true })
    const { rail, bar } = mainNavigations()
    expect(currentLinks(bar)).toEqual([current])
    expect(currentLinks(rail)).toEqual([current])
  })

  it.each(["/servicesx", "/filtre", "/messagesx", "/parametres", "/@awa.demo", "/mes-demandes"])(
    "sur %s, aucune destination principale n'est courante",
    (pathname) => {
      renderShell({ pathname, icom: true })
      const { rail, bar } = mainNavigations()
      expect(currentLinks(bar)).toEqual([])
      expect(currentLinks(rail)).toEqual([])
    },
  )
})

describe("coque — l'espace personnel du rail", () => {
  function personal() {
    return screen.getByRole("navigation", { name: "Mon espace" })
  }

  it("suit les destinations : Mes demandes, Mon activité, Mes associations, Mes candidatures, Mes mentorats, Mes relations, Mes enregistrements, Parrainer", () => {
    renderShell({ network: true })
    expect(linksOf(personal())).toEqual([
      ["Mes demandes", "/mes-demandes"],
      ["Mon activité", "/mon-activite"],
      ["Mes associations", "/mes-associations"],
      ["Mes candidatures", "/mes-candidatures"],
      ["Mes mentorats", "/mes-mentorats"],
      ["Mes relations", "/relations"],
      ["Mes enregistrements", "/enregistrements"],
      ["Parrainer", "/parrainer"],
    ])
  })

  it("garde la règle d'avant pour les relations : absentes sans réseau du moteur", () => {
    renderShell({ network: false })
    expect(within(personal()).queryByRole("link", { name: "Mes relations" })).toBeNull()
  })

  it.each([
    ["/mes-demandes", "Mes demandes"],
    ["/mes-demandes/demande-3", "Mes demandes"],
    ["/mon-activite", "Mon activité"],
    ["/mon-activite/demandes/demande-3", "Mon activité"],
    ["/nouvelle-page", "Mon activité"],
    ["/pages/asso-lyon/gerer", "Mon activité"],
    ["/mes-associations", "Mes associations"],
    ["/mes-candidatures", "Mes candidatures"],
    ["/mes-mentorats", "Mes mentorats"],
    ["/relations", "Mes relations"],
    ["/enregistrements", "Mes enregistrements"],
    ["/parrainer", "Parrainer"],
  ])("sur %s, « %s » est courante", (pathname, current) => {
    renderShell({ pathname, network: true })
    expect(currentLinks(personal())).toEqual([current])
  })

  it("lire une page ou la revendiquer ne relève pas de Mon activité", () => {
    renderShell({ pathname: "/pages/asso-lyon/revendiquer", network: true })
    expect(currentLinks(personal())).toEqual([])
  })
})

describe("coque — une seule entrée courante pour chaque route de membre (UX-05)", () => {
  const LABEL_KEYS: Readonly<Record<NavDestination, string>> = {
    feed: "nav.feed",
    explore: "nav.explore",
    services: "nav.services",
    communities: "nav.communities",
    messages: "nav.messages",
    myRequests: "nav.myRequests",
    myActivity: "nav.myActivity",
    myAssociations: "nav.myAssociations",
    myApplications: "nav.myApplications",
    myMentoring: "nav.myMentoring",
    relations: "nav.relations",
    bookmarks: "bookmarks.title",
    sponsor: "nav.sponsor",
    moderation: "nav.moderation",
    pilot: "pilotMetrics.nav",
    profile: "nav.profile",
    settings: "nav.settings",
  }
  const PRIMARY = new Set<NavDestination>(PRIMARY_DESTINATIONS)
  const ACCOUNT = new Set<NavDestination>(ACCOUNT_DESTINATIONS)

  /** Une adresse de la table, composée en donnant la même valeur à chaque paramètre : la route dit elle-même son chemin. */
  function compose(key: RouteKey, value: string): string {
    const route = routes[key] as unknown as (...values: readonly string[]) => string
    return route(value, value, value).split(/[?#]/)[0] ?? ""
  }

  /** Toutes les adresses de membre de la table ; un profil l'est deux fois : le sien, puis celui d'un autre membre. */
  const CASES = (Object.keys(ROUTE_DESTINATIONS) as RouteKey[]).flatMap((key): [string, string, NavDestination][] => {
    const home = ROUTE_DESTINATIONS[key]
    if (home.kind === "outside") return []
    if (home.kind === "person") return [[key, compose(key, MEMBER.handle), "profile"], [key, compose(key, "autre.membre"), "explore"]]
    return [[key, compose(key, "valeur-1"), home.destination]]
  })

  it("parcourt toutes les adresses de membre de la table des routes", () => {
    expect(CASES.length).toBeGreaterThan(60)
  })

  it.each(CASES)("%s (%s) : seule l'entrée de « %s » est courante, au rail comme à la barre basse", async (_key, pathname, destination) => {
    renderShell({ pathname, icom: true, network: true, responsible: true })
    const label = t(LABEL_KEYS[destination])
    const { rail, bar } = mainNavigations()
    const personal = screen.getByRole("navigation", { name: "Mon espace" })
    const marked = () => Array.from(document.querySelectorAll("[aria-current]")).map((element) => element.textContent)
    if (PRIMARY.has(destination)) {
      expect(currentLinks(rail)).toEqual([label])
      expect(currentLinks(bar)).toEqual([label])
      expect(currentLinks(personal)).toEqual([])
      expect(marked()).toEqual([label, label])
      return
    }
    expect(currentLinks(rail)).toEqual([])
    expect(currentLinks(bar)).toEqual([])
    if (!ACCOUNT.has(destination)) {
      expect(currentLinks(personal)).toEqual([label])
      expect(marked()).toEqual([label])
      return
    }
    // Sous l'avatar : ni le rail ni la barre ne marquent d'entrée, le menu du compte marque la sienne.
    expect(marked()).toEqual([])
    await userEvent.setup().click(accountTrigger("dialog"))
    const sheet = await screen.findByRole("dialog", { name: "Mon compte" })
    expect(currentLinks(sheet)).toEqual([label])
    expect(marked()).toEqual([label])
  })
})

describe("coque — la pastille de non-lus sur Messages (UX-06)", () => {
  /** Le chiffre du serveur arrive : la coque le pose, sans rechargement. */
  function report(total: number) {
    const send = mocks.reportUnread
    expect(send).not.toBeNull()
    act(() => send?.(total))
  }

  function badgeOf(link: HTMLElement) {
    return link.querySelector("[data-unread-badge]")
  }

  it("iCom fermé (démonstration, membre qui ne peut pas encore écrire) : aucune lecture, aucune pastille", () => {
    renderShell({ icom: false, network: true })
    expect(mocks.unreadReads).toBe(0)
    expect(mocks.reportUnread).toBeNull()
    expect(document.querySelector("[data-unread-badge]")).toBeNull()
  })

  it("iCom ouvert, rien d'attente : pas de pastille, Messages garde son seul libellé", () => {
    renderShell({ icom: true })
    expect(mocks.unreadReads).toBeGreaterThan(0)
    report(0)
    const { rail, bar } = mainNavigations()
    for (const navigation of [rail, bar]) {
      expect(badgeOf(within(navigation).getByRole("link", { name: "Messages" }))).toBeNull()
    }
  })

  it("un message reçu fait paraître la pastille au rail et à la barre basse, annoncée avec l'entrée ; le lire la retire", () => {
    renderShell({ icom: true })
    report(3)
    const { rail, bar } = mainNavigations()
    for (const navigation of [rail, bar]) {
      const link = within(navigation).getByRole("link", { name: "Messages, 3 non lus" })
      expect(link).toHaveAttribute("href", "/messages")
      // Le chiffre se voit, et ne s'entend qu'une fois : par le nom de l'entrée.
      expect(badgeOf(link)).toHaveTextContent("3")
      expect(badgeOf(link)).toHaveAttribute("aria-hidden", "true")
    }
    report(0)
    for (const navigation of [rail, bar]) {
      expect(badgeOf(within(navigation).getByRole("link", { name: "Messages" }))).toBeNull()
    }
  })

  it("au singulier : « Messages, 1 non lu »", () => {
    renderShell({ icom: true })
    report(1)
    const { rail, bar } = mainNavigations()
    expect(within(rail).getByRole("link", { name: "Messages, 1 non lu" })).toBeInTheDocument()
    expect(within(bar).getByRole("link", { name: "Messages, 1 non lu" })).toBeInTheDocument()
  })

  it("plafonnée comme la carte iCom : « 99+ » à l'écran, « 99 non lus ou plus » annoncé", () => {
    renderShell({ icom: true })
    report(99)
    const { rail, bar } = mainNavigations()
    for (const navigation of [rail, bar]) {
      expect(badgeOf(within(navigation).getByRole("link", { name: "Messages, 99 non lus ou plus" }))).toHaveTextContent("99+")
    }
  })

  it("sur la messagerie, l'entrée reste la seule courante et garde sa pastille", () => {
    renderShell({ pathname: "/messages/conversation-7", icom: true })
    report(2)
    const { rail, bar } = mainNavigations()
    for (const navigation of [rail, bar]) {
      expect(within(navigation).getByRole("link", { name: "Messages, 2 non lus" })).toHaveAttribute("aria-current", "page")
      expect(within(navigation).getAllByRole("link").filter((link) => link.hasAttribute("aria-current"))).toHaveLength(1)
    }
  })

  it("parle anglais", () => {
    renderShell({ icom: true, locale: "en" })
    report(3)
    const { rail, bar } = mainNavigations("en")
    expect(within(rail).getByRole("link", { name: "Messages, 3 unread" })).toBeInTheDocument()
    expect(within(bar).getByRole("link", { name: "Messages, 3 unread" })).toBeInTheDocument()
    report(99)
    expect(within(bar).getByRole("link", { name: "Messages, 99 or more unread" })).toBeInTheDocument()
  })
})

describe("coque — le menu du compte, sous l'avatar", () => {
  const ACCOUNT = [
    ["Profil", "/@awa.demo"],
    ["Réglages", "/parametres"],
    ["Mes demandes", "/mes-demandes"],
    ["Mon activité", "/mon-activite"],
    ["Mes associations", "/mes-associations"],
    ["Mes candidatures", "/mes-candidatures"],
    ["Mes mentorats", "/mes-mentorats"],
    ["Mes relations", "/relations"],
    ["Mes enregistrements", "/enregistrements"],
    ["Parrainer", "/parrainer"],
    ["Mes données", "/parametres#mes-donnees"],
  ]
  const INFORMATION = [
    ["Mentions légales", "/mentions-legales"],
    ["Confidentialité", "/confidentialite"],
    ["Conditions d'utilisation", "/conditions-utilisation"],
    ["Règles de la communauté", "/regles-communaute"],
    ["Contact", "/contact"],
    ["Charte graphique", "/charte"],
  ]
  const SIGN_OUT = "Se déconnecter partout"

  it("au bureau : un menu au clavier — Entrée l'ouvre, les flèches le parcourent, Échap rend le focus à l'avatar", async () => {
    const user = userEvent.setup()
    renderShell({ pathname: "/parametres", network: true })
    const trigger = accountTrigger("menu")
    trigger.focus()
    await user.keyboard("{Enter}")

    const menu = await screen.findByRole("menu")
    const items = within(menu).getAllByRole("menuitem")
    // Le compte, puis les informations du site, puis la sortie (une action, pas un lien).
    expect(items.map((item) => [item.textContent, item.getAttribute("href")])).toEqual([...ACCOUNT, ...INFORMATION, [SIGN_OUT, null]])
    expect(menuItemsOf(within(menu).getByRole("group", { name: "Informations" }))).toEqual(INFORMATION)
    expect(items.filter((item) => item.getAttribute("aria-current") === "page").map((item) => item.textContent)).toEqual(["Réglages"])
    expect(items[0]).toHaveFocus()
    await user.keyboard("{ArrowDown}")
    expect(items[1]).toHaveFocus()
    await user.keyboard("{End}")
    expect(items[items.length - 1]).toHaveFocus()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("menu")).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it("au téléphone : une feuille — Échap la ferme et rend le focus à l'avatar, suivre un lien la referme", async () => {
    mocks.desktop = false
    const user = userEvent.setup()
    renderShell({ pathname: "/@awa.demo/albums/album-1", network: true })
    const trigger = accountTrigger("dialog")

    await user.click(trigger)
    let sheet = await screen.findByRole("dialog", { name: "Mon compte" })
    expect(linksOf(within(sheet).getByRole("navigation", { name: "Mon compte" }))).toEqual(ACCOUNT)
    expect(linksOf(within(sheet).getByRole("navigation", { name: "Informations" }))).toEqual(INFORMATION)
    // La sortie, en bouton neutre, est le seul bouton de la feuille hors de sa fermeture.
    expect(within(sheet).getAllByRole("button").map((button) => button.textContent || button.getAttribute("aria-label"))).toEqual([
      "Fermer le menu du compte",
      SIGN_OUT,
    ])
    expect(currentLinks(sheet)).toEqual(["Profil"])
    expect(sheet).toHaveTextContent("@awa.demo")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: "Mon compte" })).toBeNull()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    sheet = await screen.findByRole("dialog", { name: "Mon compte" })
    await user.click(within(sheet).getByRole("link", { name: "Parrainer" }))
    expect(screen.queryByRole("dialog", { name: "Mon compte" })).toBeNull()
  })

  it("aucun lien d'avant n'est perdu : profil, réglages, relations et parrainage restent à deux gestes", async () => {
    const user = userEvent.setup()
    renderShell({ network: true })
    await user.click(accountTrigger("dialog"))
    const sheet = await screen.findByRole("dialog", { name: "Mon compte" })
    for (const [label, href] of [
      ["Profil", "/@awa.demo"],
      ["Réglages", "/parametres"],
      ["Mes relations", "/relations"],
      ["Parrainer", "/parrainer"],
    ] as const) {
      expect(within(sheet).getByRole("link", { name: label })).toHaveAttribute("href", href)
    }
  })
  it.each([
    ["Mentions légales", "/mentions-legales"],
    ["Confidentialité", "/confidentialite"],
    ["Conditions d'utilisation", "/conditions-utilisation"],
    ["Règles de la communauté", "/regles-communaute"],
    ["Contact", "/contact"],
    ["Charte graphique", "/charte"],
  ])("« %s » est à deux gestes depuis tout écran : l'avatar, puis le lien, au bureau comme au téléphone", async (label, href) => {
    const user = userEvent.setup()
    renderShell({ pathname: "/services/offre-coiffure" })

    await user.click(accountTrigger("menu"))
    const menu = await screen.findByRole("menu")
    expect(within(within(menu).getByRole("group", { name: "Informations" })).getByRole("menuitem", { name: label })).toHaveAttribute("href", href)
    await user.keyboard("{Escape}")

    mocks.desktop = false
    await user.click(accountTrigger("dialog"))
    const sheet = await screen.findByRole("dialog", { name: "Mon compte" })
    const link = within(within(sheet).getByRole("navigation", { name: "Informations" })).getByRole("link", { name: label })
    expect(link).toHaveAttribute("href", href)
    await user.click(link)
    expect(screen.queryByRole("dialog", { name: "Mon compte" })).toBeNull()
  })

  it("se déconnecter partout depuis le menu du bureau, au clavier : la porte unique est appelée une fois, le menu dit l'attente", async () => {
    const user = userEvent.setup()
    const exit = pendingSignOut()
    renderShell({ actions: { signOutEverywhere: exit.action } })
    const trigger = accountTrigger("menu")
    trigger.focus()
    await user.keyboard("{Enter}")
    const menu = await screen.findByRole("menu")
    await user.keyboard("{End}")
    expect(within(menu).getByRole("menuitem", { name: SIGN_OUT })).toHaveFocus()

    await user.keyboard("{Enter}")
    await user.keyboard("{Enter}")
    expect(exit.action).toHaveBeenCalledOnce()
    // Le menu reste ouvert : la sortie s'y lit, fermée à un second geste.
    const pending = within(screen.getByRole("menu")).getByRole("menuitem", { name: "Déconnexion…" })
    expect(pending).toHaveAttribute("aria-disabled", "true")
    expect(screen.getByRole("menu")).toHaveAttribute("aria-busy", "true")

    // La démonstration recharge l'accueil une fois la sortie faite (le moteur garde sa propre navigation).
    const assign = stubPageNavigation()
    await act(async () => {
      exit.finish()
      await exit.pending
    })
    expect(assign).toHaveBeenCalledExactlyOnceWith(routes.home())
  })

  it("se déconnecter partout depuis la feuille du téléphone ; un échec reste générique, passe par un avis et laisse réessayer", async () => {
    mocks.desktop = false
    const user = userEvent.setup()
    const failed = vi.spyOn(toast, "error")
    const action = vi.fn<DiasporaleActions["signOutEverywhere"]>().mockRejectedValueOnce(new Error("diagnostic privé de la révocation")).mockReturnValue(new Promise<void>(() => {}))
    renderShell({ actions: { signOutEverywhere: action } })
    await user.click(accountTrigger("dialog"))
    const sheet = await screen.findByRole("dialog", { name: "Mon compte" })

    await user.click(within(sheet).getByRole("button", { name: SIGN_OUT }))
    await vi.waitFor(() => expect(failed).toHaveBeenCalledOnce())
    expect(failed).toHaveBeenCalledWith(t("errors.unknown"), expect.objectContaining({ id: expect.any(String) }))
    expect(screen.queryByText(/diagnostic privé/)).toBeNull()
    expect(within(sheet).getByRole("button", { name: SIGN_OUT })).toBeEnabled()

    await user.click(within(sheet).getByRole("button", { name: SIGN_OUT }))
    expect(action).toHaveBeenCalledTimes(2)
    expect(within(sheet).getByRole("button", { name: "Déconnexion…" })).toBeDisabled()
    expect(failed).toHaveBeenCalledOnce()
  })

  it("parle anglais : informations et sortie dans la langue de la personne", async () => {
    const user = userEvent.setup()
    renderShell({ locale: "en" })
    await user.click(accountTrigger("menu", "Account menu (Awa Ogooué)"))
    const menu = await screen.findByRole("menu")
    expect(menuItemsOf(within(menu).getByRole("group", { name: "Information" }))).toEqual([
      ["Legal notice", "/mentions-legales"],
      ["Privacy", "/confidentialite"],
      ["Terms of use", "/conditions-utilisation"],
      ["Community rules", "/regles-communaute"],
      ["Contact", "/contact"],
      ["Design charter", "/charte"],
    ])
    expect(within(menu).getByRole("menuitem", { name: "Sign out everywhere" })).not.toHaveAttribute("href")
  })
})

describe("coque — Publier, une action stable", () => {
  it("ouvre le composeur depuis l'en-tête, depuis le rail et depuis un écran (useComposer)", async () => {
    const user = userEvent.setup()
    renderShell()
    const [railButton, headerButton] = screen.getAllByRole("button", { name: "Publier" })
    expect(railButton).not.toHaveAttribute("aria-disabled")
    expect(headerButton).not.toHaveAttribute("aria-disabled")

    await user.click(headerButton!)
    expect(screen.getByRole("dialog", { name: "Composeur" })).toBeInTheDocument()
    expect(mocks.composer).toHaveBeenCalledWith(
      expect.objectContaining({ open: true, memberCountry: "FR", draftKey: "diasporale:brouillon:persons_awa" }),
    )
  })

  it("un écran ouvre le même composeur par useComposer", async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole("button", { name: "Quoi de neuf ?" }))
    expect(screen.getByRole("dialog", { name: "Composeur" })).toBeInTheDocument()
  })

  it("fermée pour un compte en attente : focalisable, raison annoncée, explication et chemins sans composeur", async () => {
    const user = userEvent.setup()
    renderShell({ membership: { ...MEMBER, status: "en_attente", canPublish: false } })
    const reason = "Publication possible après un parrainage ou une vérification"
    const buttons = screen.getAllByRole("button", { name: "Publier" })
    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(button).toHaveAttribute("aria-disabled", "true")
      expect(button).not.toBeDisabled()
      expect(button).toHaveAccessibleDescription(reason)
    }
    // Écrite sous le bouton du rail, annoncée avec celui de l'en-tête.
    expect(screen.getAllByText(reason)).toHaveLength(2)

    const headerButton = buttons[1]!
    await user.click(headerButton)
    const explanation = await screen.findByRole("dialog", { name: reason })
    expect(explanation).toHaveTextContent("Pour publier, demandez un parrainage à un membre vérifié")
    expect(within(explanation).getByRole("link", { name: "Obtenir un parrainage" })).toHaveAttribute("href", "/parametres#parrainage")
    expect(within(explanation).getByRole("link", { name: "Vérifier mon inscription consulaire" })).toHaveAttribute("href", "/verification")
    expect(screen.queryByRole("dialog", { name: "Composeur" })).toBeNull()
    expect(mocks.composer).not.toHaveBeenCalled()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog", { name: reason })).toBeNull()
    expect(headerButton).toHaveFocus()

    // Suivre un chemin referme l'explication.
    await user.click(headerButton)
    await user.click(within(await screen.findByRole("dialog", { name: reason })).getByRole("link", { name: "Obtenir un parrainage" }))
    expect(screen.queryByRole("dialog", { name: reason })).toBeNull()
  })

  it("fermée pendant une suspension : la raison et le chemin des recours", async () => {
    const user = userEvent.setup()
    renderShell({ membership: { ...MEMBER, status: "suspendue", canPublish: false } })
    const [railButton] = screen.getAllByRole("button", { name: "Publier" })
    expect(railButton).toHaveAccessibleDescription("Publication indisponible pendant la suspension du compte")

    await user.click(railButton!)
    const explanation = await screen.findByRole("dialog", { name: "Votre compte est suspendu." })
    expect(explanation).toHaveTextContent("Vous pourrez publier de nouveau à la fin de la suspension.")
    expect(within(explanation).getByRole("link", { name: "Mes données" })).toHaveAttribute("href", "/parametres#mes-donnees")
    await user.click(within(explanation).getByRole("button", { name: "Fermer l'explication" }))
    expect(screen.queryByRole("dialog", { name: "Votre compte est suspendu." })).toBeNull()
  })
})

describe("coque — le contexte pays", () => {
  it("garde le pays de résidence visible et le relie à Communautés", () => {
    renderShell()
    const homeLinks = screen.getAllByRole("link", { name: /^Mon pays/ })
    expect(homeLinks.length).toBeGreaterThan(0)
    for (const link of homeLinks) {
      expect(link).toHaveAttribute("href", "/communautes")
      expect(link).toHaveTextContent("France")
    }
  })

  it("annonce la zone consultée sur le hub d'un autre pays, sans toucher à la résidence", () => {
    renderShell({ pathname: "/pays/ca" })
    const note = screen.getByRole("note")
    expect(note).toHaveTextContent("Zone consultée : Canada")
    expect(note).toHaveTextContent("Votre pays de résidence ne change pas : France.")
    expect(within(note).getByRole("link", { name: "Revenir à mon pays" })).toHaveAttribute("href", "/communautes")
  })

  it.each(["/pays/fr", "/pays/ga", "/pays/xx", "/communautes", "/fil"])("sur %s, aucune zone consultée n'est annoncée", (pathname) => {
    renderShell({ pathname })
    expect(screen.queryByRole("note")).toBeNull()
  })

  it("dit la zone consultée en anglais", () => {
    renderShell({ pathname: "/pays/be", locale: "en" })
    expect(screen.getByRole("note")).toHaveTextContent("Area you're viewing: Belgium")
    expect(screen.getByRole("link", { name: "Back to my country" })).toHaveAttribute("href", "/communautes")
  })
})
