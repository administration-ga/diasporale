// @vitest-environment jsdom
import { COUNTRY_OPENING_REQUIREMENTS, DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { formatDate } from "@diasporale/features"
import { DataSourceProvider, type CountryHubView, type DiasporaleDataSource, type Loadable, type MembershipView, type MutualAidCapability } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { FeedPagesProps } from "@/components/feed-pages"

import { routes } from "@/lib/routes"

import { HubScreen } from "./hub-screen"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  hub: { status: "loading" } as Loadable<CountryHubView>,
  countryHub: vi.fn(),
  gate: vi.fn(),
  feed: vi.fn(),
  open: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  reload: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useCountryHub: (country: string) => {
    mocks.countryHub(country)
    return mocks.hub
  },
  useOpenCountries: () => ({ status: "ready", data: [] }),
}))

vi.mock("@/components/gate", () => ({
  Gate: (props: { require: "member"; children: (session: { membership: MembershipView | null }) => ReactNode }) => {
    mocks.gate(props.require)
    return <>{props.children({ membership: mocks.membership })}</>
  },
}))

vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { children: ReactNode }) => <>{props.children}</>,
  useComposer: () => ({ canPublish: true, open: mocks.open }),
}))

vi.mock("@/components/status-banner", () => ({ StatusBanner: () => null }))

vi.mock("@/components/feed-pages", () => ({
  FeedPages: (props: FeedPagesProps) => {
    mocks.feed(props)
    return <section aria-label="Publications paginées du hub" />
  },
}))

const membership: MembershipView = {
  personId: "persons_awa",
  handle: "awa.demo",
  displayName: "Awa",
  status: "declaree",
  badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: null,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "reinforced",
  directoryVisibility: "hidden",
}

/** Le dernier passage nocturne du moteur (2 h 30 UTC). */
const PASS = Date.UTC(2026, 10, 9, 2, 30)

const hub: CountryHubView = {
  country: "CA",
  open: true,
  counters: {
    dormant: false,
    members: { kind: "below_threshold", threshold: 10 },
    associations: { kind: "value", value: 0 },
    companies: { kind: "value", value: 0 },
    upcomingEvents: { kind: "value", value: 0 },
  },
  countersSource: "materialized",
  countersComputedAt: PASS,
  officialPages: [],
  associations: [],
  companies: [],
  events: [],
  eventsSource: "unmeasured",
}

function tree(iso = "CA", locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}><HubScreen iso={iso} /></I18nProvider>
}

/** Le texte tel que l'écran le montre, espaces insécables comprises, comparé espaces repliées. */
const spaced = (text: string) => text.replace(/\s+/g, " ")

beforeEach(() => {
  vi.clearAllMocks()
  mocks.membership = membership
  mocks.hub = { status: "loading" }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("HubScreen — reprise des informations du pays", () => {
  it("remplace une erreur de lecture par une alerte traduite et recharge réellement la page", () => {
    mocks.hub = { status: "error", code: "PRIVATE_BACKEND_FAILURE" }
    const { container } = render(tree())

    const alert = screen.getByRole("alert")
    expect(within(alert).getByRole("heading", { name: "Les informations de ce pays ne sont pas disponibles." })).toBeInTheDocument()
    expect(alert).toHaveTextContent("Vérifiez votre connexion et rechargez la page pour réessayer.")
    expect(screen.queryByText("PRIVATE_BACKEND_FAILURE")).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
    expect(mocks.feed).not.toHaveBeenCalled()

    // Location.reload est non configurable dans jsdom. Cette façade n'altère
    // ni les documents ni les évènements DOM ; elle observe seulement le geste.
    vi.stubGlobal("window", new Proxy(window, {
      get(target, property) {
        return property === "location" ? { reload: mocks.reload } : Reflect.get(target, property, target)
      },
    }))
    fireEvent.click(within(alert).getByRole("button", { name: "Recharger la page" }))

    expect(mocks.reload).toHaveBeenCalledOnce()
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it("conserve un chargement distinct sans alerte ni action de reprise", () => {
    const { container } = render(tree())

    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Recharger la page" })).not.toBeInTheDocument()
    expect(mocks.feed).not.toHaveBeenCalled()
  })

  it("monte le fil prêt avec le pays consulté, l'adhésion et sa portée", () => {
    mocks.hub = { status: "ready", data: hub }
    const { container } = render(tree())

    expect(mocks.gate).toHaveBeenLastCalledWith("member")
    expect(mocks.countryHub).toHaveBeenLastCalledWith("CA")
    expect(screen.getByRole("region", { name: "Publications paginées du hub" })).toBeInTheDocument()
    expect(mocks.feed).toHaveBeenLastCalledWith(expect.objectContaining({
      membership,
      scope: "mon_pays",
      hubCountry: "CA",
      now: expect.any(Number),
      emptyFallback: expect.anything(),
    }))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
  })
})

describe("HubScreen — rubriques du pays consulté (HB-04)", () => {
  const shortcuts = () => screen.getByRole("navigation", { name: "Vie communautaire du pays" })
  const hrefOf = (name: string) => within(shortcuts()).getByRole("link", { name }).getAttribute("href")

  it("sur le hub d'un autre pays que la résidence, chaque rubrique s'ouvre sur le pays consulté", () => {
    // Awa réside en France ; elle consulte le hub du Canada.
    mocks.hub = { status: "ready", data: hub }
    render(tree("ca"))

    expect(hrefOf("Kit d'arrivée")).toBe("/kit-arrivee?pays=CA")
    expect(hrefOf("Entraide")).toBe("/entraide?pays=CA")
    expect(hrefOf("Mentorat")).toBe("/mentorat?pays=CA")
    expect(hrefOf("Emploi")).toBe("/emploi?pays=CA")
    expect(hrefOf("Services")).toBe("/services?pays=CA")
    expect(hrefOf("Pages")).toBe("/pages?pays=CA")
    // Aucune rubrique n'emporte le pays de résidence.
    for (const link of within(shortcuts()).getAllByRole("link")) expect(link.getAttribute("href")).not.toMatch(/pays=FR/)
  })

  it("l'agenda, personnel, ne suit pas le pays consulté ; l'annuaire des membres n'a pas de raccourci sans filtre par pays", () => {
    mocks.hub = { status: "ready", data: hub }
    render(tree("ca"))

    expect(hrefOf("Mon agenda")).toBe("/agenda")
    expect(within(shortcuts()).queryByRole("link", { name: /Membres/ })).not.toBeInTheDocument()
  })

  it("le hub de la résidence porte les mêmes rubriques, sur son pays", () => {
    mocks.hub = { status: "ready", data: { ...hub, country: "FR" } }
    render(tree("fr"))

    expect(hrefOf("Kit d'arrivée")).toBe("/kit-arrivee?pays=FR")
    expect(hrefOf("Services")).toBe("/services?pays=FR")
  })

  it("les rubriques restent atteignables pendant le chargement et après une erreur de lecture du hub", () => {
    const view = render(tree("ca"))
    expect(hrefOf("Pages")).toBe("/pages?pays=CA")
    mocks.hub = { status: "error", code: "PRIVATE_BACKEND_FAILURE" }
    view.rerender(tree("ca"))
    expect(hrefOf("Pages")).toBe("/pages?pays=CA")
  })

  it("un code inconnu ne montre aucune rubrique", () => {
    render(tree("zz"))
    expect(screen.queryByRole("navigation", { name: "Vie communautaire du pays" })).not.toBeInTheDocument()
  })
})

describe("HubScreen — pays pas encore ouvert (HB-01)", () => {
  it("dit ce qui est possible (tout lire, publier pour toute la diaspora), sans promettre de relecture", () => {
    mocks.hub = { status: "ready", data: { ...hub, country: "ES", open: false } }
    render(tree("es"))

    const notice = screen.getByRole("note")
    expect(notice).toHaveTextContent("Pas encore ouvert")
    expect(notice).toHaveTextContent("Espagne n'est pas encore ouvert. Vous lisez tout et publiez pour toute la diaspora")
    expect(notice).toHaveTextContent(/le hub du pays attend son ouverture/)
    expect(notice).not.toHaveTextContent(/relue|relecture/i)
  })

  it("un pays ouvert ne montre aucun avis", () => {
    mocks.hub = { status: "ready", data: hub }
    render(tree())
    expect(screen.queryByRole("note")).not.toBeInTheDocument()
  })
})

describe("HubScreen — compteurs datés (HB-05)", () => {
  it("après un passage, la date affichée est celle du passage, et « Membres visibles » dit ce qu'il compte", () => {
    mocks.hub = { status: "ready", data: hub }
    render(tree())

    expect(screen.getByText("Membres visibles")).toBeInTheDocument()
    expect(screen.getByText(spaced(`Comptés le ${formatDate(PASS, "fr")}.`))).toBeInTheDocument()
    expect(screen.getByText("Membres visibles : ceux qui ont choisi l'annuaire.")).toBeInTheDocument()
  })

  it("avant tout passage, aucune date, et les compteurs du moteur ne se montrent pas comme mesurés", () => {
    mocks.hub = { status: "ready", data: { ...hub, countersComputedAt: null } }
    render(tree())

    expect(screen.queryByText(/Comptés le/)).not.toBeInTheDocument()
    expect(screen.queryByText("Membres visibles")).not.toBeInTheDocument()
    expect(screen.queryByText("Membres visibles : ceux qui ont choisi l'annuaire.")).not.toBeInTheDocument()
  })

  it("la démonstration garde ses compteurs signalés comme fictifs, sans date de passage", () => {
    mocks.hub = { status: "ready", data: { ...hub, countersSource: "demo", countersComputedAt: null, eventsSource: "demo" } }
    render(tree())

    expect(screen.getByText("Membres visibles")).toBeInTheDocument()
    expect(screen.getByText("Compteurs de démonstration, calculés sur les données fictives.")).toBeInTheDocument()
    expect(screen.getByText("Membres visibles : ceux qui ont choisi l'annuaire.")).toBeInTheDocument()
    expect(screen.queryByText(/Comptés le/)).not.toBeInTheDocument()
  })

  it("en anglais : la date du passage et ce que comptent les membres visibles", () => {
    mocks.hub = { status: "ready", data: hub }
    render(tree("CA", "en"))

    expect(screen.getByText(spaced(`Counted on ${formatDate(PASS, "en")}.`))).toBeInTheDocument()
    expect(screen.getByText("Visible members: those who chose to appear in the directory.")).toBeInTheDocument()
  })
})

describe("HubScreen — à propos du hub (HB-05)", () => {
  const about = (title: RegExp = /^À propos du hub/) => {
    const summary = screen.getByText(title)
    const details = summary.closest("details")
    if (!details) throw new Error("Le bloc « À propos » n'est pas repliable.")
    return { summary, details }
  }

  it("se replie sous l'en-tête : statut, règle d'ouverture lue dans le domaine, règles de la communauté et signalement", () => {
    mocks.hub = { status: "ready", data: hub }
    render(tree())

    const { summary, details } = about()
    expect(summary).toHaveTextContent("À propos du hub — Canada")
    expect(details).not.toHaveAttribute("open")
    expect(details).toHaveTextContent("Pays ouvert : les membres qui y résident peuvent publier dans ce hub. Tout membre de DIASPORALE le lit, quel que soit son pays.")
    expect(details).toHaveTextContent(`Un pays est ouvert par l'administration de la plateforme. Le réseau s'est donné pour règle de l'ouvrir avec ${COUNTRY_OPENING_REQUIREMENTS.relayAssociations} associations relais et ${COUNTRY_OPENING_REQUIREMENTS.activeModerators} modérateur ; l'application ne vérifie pas encore cette condition d'elle-même.`)
    expect(details).toHaveTextContent("l'équipe de modération du réseau l'examine, et son auteur ne sait pas qui l'a signalé.")
    expect(within(details).getByRole("link", { name: "Lire les règles de la communauté", hidden: true })).toHaveAttribute("href", "/regles-communaute")
    expect(within(details).getByRole("link", { name: "Suivre mes signalements", hidden: true })).toHaveAttribute("href", "/parametres#mes-signalements")
    // La date d'ouverture n'existe pas encore (HB-08) : aucune n'est affichée.
    expect(details).not.toHaveTextContent(/ouvert le|ouvert depuis/i)
  })

  it("un pays pas encore ouvert : ce que l'on peut y faire, sans promesse de relecture", () => {
    mocks.hub = { status: "ready", data: { ...hub, country: "ES", open: false } }
    render(tree("es"))

    const { details } = about()
    expect(details).toHaveTextContent("Pas encore ouvert : tout membre lit ce hub. Ceux qui y résident peuvent publier pour toute la diaspora ; la publication dans ce hub attend l'ouverture du pays.")
    expect(details).not.toHaveTextContent(/relue|relecture/i)
  })

  it("avant la lecture du hub, aucun bloc « À propos »", () => {
    render(tree())
    expect(screen.queryByText(/^À propos du hub/)).not.toBeInTheDocument()
  })

  it("en anglais", () => {
    mocks.hub = { status: "ready", data: hub }
    render(tree("CA", "en"))

    const { summary, details } = about(/^About the hub/)
    expect(summary).toHaveTextContent("About the hub — Canada")
    expect(details).toHaveTextContent("Open country: members who live there can post in this hub.")
    expect(within(details).getByRole("link", { name: "Read the community rules", hidden: true })).toHaveAttribute("href", "/regles-communaute")
  })
})

describe("HubScreen — ET-09 : l'entraide du pays", () => {
  it("les dernières questions ouvertes du pays du hub, trois au plus, et le lien vers son entraide ; sans fournisseur d'entraide, rien", () => {
    const read = vi.fn((_request: { readonly country: string; readonly limit?: number }) => ({
      status: "ready" as const,
      data: {
        items: [{
          id: "question-1", title: "Trouver un logement à Montréal", detail: "", theme: "housing" as const, country: "CA" as const, city: null, status: "open" as const,
          answerCount: 0, hasAcceptedAnswer: false, author: { displayName: null, handle: null }, isMine: false, createdAt: 1,
        }],
        continueCursor: null,
        isDone: true,
      },
    }))
    const source = { kind: "engine", mutualAid: { useQuestions: read } as unknown as MutualAidCapability } as unknown as DiasporaleDataSource
    render(<DataSourceProvider source={source}>{tree("ca")}</DataSourceProvider>)
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ country: "CA", status: "open", limit: 3 }))
    const block = screen.getByRole("region", { name: /Entraide.*Canada/ })
    expect(within(block).getByRole("link", { name: "Trouver un logement à Montréal" })).toHaveAttribute("href", routes.mutualAidItem("question-1"))
    expect(within(block).getByRole("link", { name: "Voir toute l'entraide" })).toHaveAttribute("href", routes.mutualAid("CA"))
    cleanup()
    render(tree("ca"))
    expect(screen.queryByRole("region", { name: /Entraide.*Canada/ })).not.toBeInTheDocument()
  })
})
