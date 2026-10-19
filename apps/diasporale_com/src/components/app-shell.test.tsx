// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { RoutingProvider, type FeatureRoutes, type LinkComponent } from "@diasporale/features"
import { DataSourceProvider, type MembershipView } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { IcomNetwork } from "@/lib/icom-state"
import { routes } from "@/lib/routes"

import { AppShell, useComposer } from "./app-shell"

const mocks = vi.hoisted(() => ({
  pathname: "/fil",
  icom: null as IcomNetwork | null,
  network: null as IcomNetwork | null,
  desktop: true,
  composer: vi.fn(),
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

function renderShell(options: { pathname?: string; membership?: MembershipView; icom?: boolean; network?: boolean; locale?: "fr" | "en" } = {}) {
  mocks.pathname = options.pathname ?? "/fil"
  mocks.icom = options.icom ? NETWORK : null
  mocks.network = options.network ?? options.icom ? NETWORK : null
  const source = createDemoDataSource(new DemoStore(null, () => NOW, 0))
  return render(
    <I18nProvider locale={options.locale ?? "fr"}>
      <DataSourceProvider source={source}>
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

function currentLinks(container: HTMLElement) {
  return within(container)
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent)
}

function accountTrigger(kind: "menu" | "dialog") {
  const trigger = screen
    .getAllByRole("button", { name: "Menu du compte (Awa Ogooué)" })
    .find((button) => button.getAttribute("aria-haspopup") === kind)
  expect(trigger).toBeDefined()
  return trigger!
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.desktop = true
})

afterEach(cleanup)

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
  ])("sur %s, seule la destination « %s » est courante", (pathname, current) => {
    renderShell({ pathname, icom: true })
    const { rail, bar } = mainNavigations()
    expect(currentLinks(bar)).toEqual([current])
    expect(currentLinks(rail)).toEqual([current])
  })

  it.each(["/servicesx", "/filtre", "/messagesx", "/parametres", "/@autre.membre", "/pages/asso-lyon"])(
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

  it("au bureau : un menu au clavier — Entrée l'ouvre, les flèches le parcourent, Échap rend le focus à l'avatar", async () => {
    const user = userEvent.setup()
    renderShell({ pathname: "/parametres", network: true })
    const trigger = accountTrigger("menu")
    trigger.focus()
    await user.keyboard("{Enter}")

    const menu = await screen.findByRole("menu")
    const items = within(menu).getAllByRole("menuitem")
    expect(items.map((item) => [item.textContent, item.getAttribute("href")])).toEqual(ACCOUNT)
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
