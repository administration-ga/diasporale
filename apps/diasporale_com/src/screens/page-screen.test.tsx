// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import {
  contentReportKey,
  DataSourceProvider,
  type ActionResult,
  type ContentReportInput,
  type ContentReportsCapability,
  type ContentReportTarget,
  type AidMissionCardView,
  type DiasporaleDataSource,
  type MembershipView,
  type MutualAidCapability,
  type PageDetailQuery,
  type PageDetailView,
  type PagesCapability,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useSyncExternalStore, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { PageScreen } from "./page-screen"

const t = getFixedT("fr")

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  capability: null as PagesCapability | null,
  detail: { status: "loading" } as PageDetailQuery,
  portDetail: { status: "loading" } as PageDetailQuery,
  pageCalls: [] as string[],
  portCalls: [] as string[],
  follow: vi.fn(),
  unfollow: vi.fn(),
  react: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  admin: vi.fn(),
  association: vi.fn(),
  services: vi.fn(),
  contact: vi.fn(),
  consulateUrl: null as string | null,
}))

// Les rubriques de la fiche lisent leur sélection dans l'adresse (`contenu=`) : aucune n'est demandée ici.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock("@/components/gate", () => ({
  Gate: (props: { require: string; children: (session: { membership: MembershipView | null }) => ReactNode }) => <>{props.children({ membership: mocks.membership })}</>,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }))
// Les activités associatives possèdent leurs scénarios propres ; ces cas isolent la fiche.
vi.mock("@/components/association-group", () => ({ AssociationGroupEntry: () => null }))
vi.mock("@/components/association-events", () => ({ AssociationEventsSection: () => null }))
vi.mock("@/components/profile-images", () => ({ ProfileCover: () => <div data-testid="banniere" /> }))
vi.mock("@/components/page-admin-entry", () => ({
  PageAdminEntry: (props: unknown) => {
    mocks.admin(props)
    return null
  },
}))
vi.mock("@/components/association-membership-entry", () => ({
  AssociationMembershipEntry: (props: unknown) => {
    mocks.association(props)
    return null
  },
}))
vi.mock("@/components/page-services-section", () => ({
  PageServicesSection: (props: unknown) => {
    mocks.services(props)
    return null
  },
  PageServiceContactEntry: (props: unknown) => {
    mocks.contact(props)
    return null
  },
}))
vi.mock("@diasporale/features", async (original) => ({
  ...(await original<typeof import("@diasporale/features")>()),
  PostCard: (props: { post: { body: string } }) => <article>{props.post.body}</article>,
}))
vi.mock("@diasporale/features/data", async (original) => ({
  ...(await original<typeof import("@diasporale/features/data")>()),
  usePagesCapability: () => mocks.capability,
  usePage: (handle: string) => {
    mocks.portCalls.push(handle)
    return mocks.portDetail
  },
  useActions: () => ({ react: mocks.react }),
}))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))
// La sortie vers consulat.ga ne vient que de l'environnement : absente, aucun lien.
vi.mock("@/lib/env", () => ({ publicEnv: { dataSource: "engine", convexUrl: null, idnPortalUrl: null, get consulateUrl() { return mocks.consulateUrl } } }))

const MEMBER: MembershipView = {
  personId: "person-me",
  handle: "recette",
  displayName: "Recette",
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

function view(overrides: { following?: boolean; role?: "admin" | "signatory" | null; claimable?: boolean } = {}): PageDetailView {
  return {
    page: {
      id: "page-lyon",
      handle: "collectif-lyon",
      name: "Collectif de Lyon",
      ownerKind: "association",
      trust: "community",
      badge: "community",
      country: "FR",
      city: null,
      description: "Accueil des nouveaux arrivants.",
      followers: 3,
      claimable: overrides.claimable ?? true,
      shortName: "CDL",
      logoUrl: null,
    },
    bannerUrl: null,
    postCount: 7,
    posts: [],
    morePosts: true,
    events: [],
    viewer: { role: overrides.role ?? null, following: overrides.following ?? false },
  }
}

function capability(): PagesCapability {
  return {
    usePage: (handle) => {
      mocks.pageCalls.push(handle)
      return mocks.detail
    },
    useDirectory: () => ({ status: "loading" }),
    useHubPages: () => ({ status: "loading" }),
    follow: mocks.follow,
    unfollow: mocks.unfollow,
  }
}

/** La fiche vit dans le fournisseur de l'application ; celui-ci ne sert aucune capacité facultative (mur d'origine). */
const SOURCE = { kind: "engine" } as unknown as DiasporaleDataSource

function tree() {
  return (
    <I18nProvider locale="fr">
      <DataSourceProvider source={SOURCE}>
        <PageScreen handle="collectif-lyon" />
      </DataSourceProvider>
    </I18nProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.membership = MEMBER
  mocks.capability = capability()
  mocks.detail = { status: "loading" }
  mocks.portDetail = { status: "loading" }
  mocks.pageCalls.length = 0
  mocks.portCalls.length = 0
  mocks.consulateUrl = null
})

afterEach(cleanup)

describe("PageScreen — états de la fiche (DG-007)", () => {
  it("le chargement seul a son squelette, sans alerte", () => {
    const { container } = render(tree())
    expect(screen.getByRole("status")).toHaveTextContent("Un instant…")
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(mocks.pageCalls).toEqual(["collectif-lyon"])
  })

  it("un refus sort du squelette : message traduit et reprise", async () => {
    const retry = vi.fn().mockResolvedValue(undefined)
    mocks.detail = { status: "error", code: "rate_limited", retry }
    const { container } = render(tree())
    const alert = screen.getByRole("alert")
    expect(within(alert).getByRole("heading", { name: "Cette page n'a pas pu être affichée." })).toBeInTheDocument()
    expect(alert).toHaveTextContent(/Trop de demandes/)
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument()
    await act(async () => {
      fireEvent.click(within(alert).getByRole("button", { name: "Réessayer" }))
    })
    expect(retry).toHaveBeenCalledOnce()
  })

  it("un code inconnu se dit « erreur inconnue », jamais tel quel ; sans reprise, pas de bouton", () => {
    mocks.detail = { status: "error", code: "PRIVATE_BACKEND_FAILURE" }
    render(tree())
    const alert = screen.getByRole("alert")
    expect(alert).not.toHaveTextContent("PRIVATE_BACKEND_FAILURE")
    expect(alert).toHaveTextContent(/Une erreur est survenue/)
    expect(within(alert).queryByRole("button")).not.toBeInTheDocument()
  })

  it("introuvable et illisible rendent la même page indisponible", () => {
    mocks.detail = { status: "ready", data: null }
    render(tree())
    expect(screen.getByText("Cette page n'est pas disponible.")).toBeInTheDocument()
    expect(mocks.admin).not.toHaveBeenCalled()
  })

  it("la fiche réelle : identité, badge, compteurs mesurés, gestes montés, sans revendication désactivée", () => {
    mocks.detail = { status: "ready", data: view({ role: "admin", claimable: true }) }
    render(tree())
    expect(screen.getByRole("heading", { level: 1, name: "Collectif de Lyon" })).toBeInTheDocument()
    expect(screen.getByText("CDL")).toBeInTheDocument()
    expect(screen.getByText("Accueil des nouveaux arrivants.")).toBeInTheDocument()
    expect(screen.getByText(/3 abonnés/)).toBeInTheDocument()
    expect(screen.getByText(/7 publications/)).toBeInTheDocument()
    expect(screen.getByText("Seules les publications les plus récentes de la page sont affichées ici.")).toBeInTheDocument()
    expect(screen.getByText("Cette page n'a encore rien publié.")).toBeInTheDocument()
    expect(mocks.admin).toHaveBeenLastCalledWith({ pageId: "page-lyon", handle: "collectif-lyon", viewerRole: "admin", claimable: true })
    expect(mocks.association).toHaveBeenLastCalledWith({ pageId: "page-lyon", handle: "collectif-lyon", ownerKind: "association" })
    // Une association propose des services : la section reste visible, même vide, et son équipe la gère.
    expect(mocks.services).toHaveBeenLastCalledWith({ pageId: "page-lyon", pageHandle: "collectif-lyon", canManage: true, showEmpty: true })
    // L'entrée de contact est réservée aux visiteurs : l'équipe ne se contacte pas elle-même.
    expect(mocks.contact).not.toHaveBeenCalled()
    expect(screen.queryByText("Revendiquer cette page")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("monte les publications de la première fenêtre", () => {
    mocks.detail = {
      status: "ready",
      data: {
        ...view(),
        morePosts: false,
        posts: [{
          id: "post-1", author: { kind: "page", id: "page-lyon", handle: "collectif-lyon", displayName: "Collectif de Lyon", badges: ["community"] },
          body: "Assemblée générale samedi", media: [], share: null, shareCount: 0, scope: { reach: "diaspora" }, audience: "public",
          visibility: "network", moderation: "published", createdAt: 1, reactionCount: 0, commentCount: 0, myReaction: null,
          isMine: false, bookmarked: false, edited: false,
        }],
      },
    }
    render(tree())
    expect(screen.getByText("Assemblée générale samedi")).toBeInTheDocument()
    expect(screen.queryByText("Seules les publications les plus récentes de la page sont affichées ici.")).not.toBeInTheDocument()
  })
})

describe("PageScreen — suivre et ne plus suivre", () => {
  it("suivre passe par la capacité, avec retour sonner", async () => {
    mocks.detail = { status: "ready", data: view({ following: false }) }
    mocks.follow.mockResolvedValue({ ok: true, value: { following: true } })
    render(tree())
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Suivre" }))
    })
    expect(mocks.follow).toHaveBeenCalledWith("collectif-lyon")
    expect(mocks.unfollow).not.toHaveBeenCalled()
    expect(mocks.success).toHaveBeenCalledWith("Vous suivez Collectif de Lyon.")
  })

  it("un seul bouton plein par zone : Suivre, puis le service une fois suivie ; qui tient un rôle a « Publier »", () => {
    mocks.detail = { status: "ready", data: view({ following: false }) }
    const first = render(tree())
    expect(screen.getByRole("button", { name: "Suivre" })).toHaveClass("bg-social-fill")
    expect(mocks.contact).toHaveBeenLastCalledWith(expect.objectContaining({ variant: "outline" }))
    first.unmount()

    mocks.detail = { status: "ready", data: view({ following: true }) }
    const second = render(tree())
    expect(screen.getByRole("button", { name: "Ne plus suivre" })).toHaveClass("bg-neutral")
    expect(mocks.contact).toHaveBeenLastCalledWith(expect.objectContaining({ variant: "commerce" }))
    second.unmount()

    mocks.detail = { status: "ready", data: view({ following: false, role: "admin" }) }
    render(tree())
    expect(screen.getByRole("button", { name: "Suivre" })).toHaveClass("bg-neutral")
  })

  it("l'état affiché suit la fiche relue : « Ne plus suivre » désabonne", async () => {
    mocks.detail = { status: "ready", data: view({ following: true }) }
    mocks.unfollow.mockResolvedValue({ ok: true, value: { following: false } })
    const { rerender } = render(tree())
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ne plus suivre" }))
    })
    expect(mocks.unfollow).toHaveBeenCalledWith("collectif-lyon")
    expect(mocks.success).toHaveBeenCalledWith("Vous ne suivez plus Collectif de Lyon.")
    mocks.detail = { status: "ready", data: view({ following: false }) }
    rerender(tree())
    expect(screen.getByRole("button", { name: "Suivre" })).toBeEnabled()
  })

  it("un refus se dit par un code traduit", async () => {
    mocks.detail = { status: "ready", data: view() }
    mocks.follow.mockResolvedValue({ ok: false, code: "rate_limited" })
    render(tree())
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Suivre" }))
    })
    expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/Trop de demandes/))
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it("un membre en attente lit sans suivre ; se désabonner reste possible", () => {
    mocks.membership = { ...MEMBER, status: "en_attente", canPublish: false }
    mocks.detail = { status: "ready", data: view({ following: false }) }
    const { rerender } = render(tree())
    const follow = screen.getByRole("button", { name: "Suivre" })
    expect(follow).toBeDisabled()
    expect(follow).toHaveAccessibleDescription(/adhésion déclarée/)
    mocks.detail = { status: "ready", data: view({ following: true }) }
    rerender(tree())
    expect(screen.getByRole("button", { name: "Ne plus suivre" })).toBeEnabled()
  })

  it("sans capacité « pages », la fiche du port se lit et aucun geste n'est inventé", () => {
    mocks.capability = null
    mocks.portDetail = { status: "ready", data: view() }
    render(tree())
    expect(mocks.portCalls).toEqual(["collectif-lyon"])
    expect(screen.getByRole("heading", { level: 1, name: "Collectif de Lyon" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Suivre" })).not.toBeInTheDocument()
  })
})

describe("PageScreen — fiche d'une institution (VC-01)", () => {
  function institution(): PageDetailView {
    const base = view()
    return {
      ...base,
      page: { ...base.page, id: "page-poste", handle: "poste-recette", name: "Poste consulaire de recette", ownerKind: "institution", trust: "official", badge: "official", claimable: false, shortName: null },
    }
  }

  it("aucun « Écrire » inactif : la fiche renvoie les questions de dossier vers consulat.ga, sans lien si l'adresse manque", () => {
    mocks.detail = { status: "ready", data: institution() }
    render(tree())
    expect(screen.queryByRole("button", { name: /Écrire/ })).not.toBeInTheDocument()
    expect(screen.queryByTitle(/messagerie/i)).not.toBeInTheDocument()
    expect(screen.getByText("Les questions sur un dossier se traitent sur consulat.ga.")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Aller sur consulat\.ga/ })).not.toBeInTheDocument()
    expect(mocks.contact).not.toHaveBeenCalled()
  })

  it("l'adresse configurée devient le lien sortant, celui de la bannière d'élévation", () => {
    mocks.consulateUrl = "https://consulat.example/"
    mocks.detail = { status: "ready", data: institution() }
    render(tree())
    expect(screen.getByRole("link", { name: /Aller sur consulat\.ga/ })).toHaveAttribute("href", "https://consulat.example/")
  })

  it("une association garde son entrée de contact, sans renvoi consulaire", () => {
    mocks.detail = { status: "ready", data: view() }
    render(tree())
    expect(mocks.contact).toHaveBeenCalled()
    expect(screen.queryByText("Les questions sur un dossier se traitent sur consulat.ga.")).not.toBeInTheDocument()
  })
})

describe("PageScreen — AS-02 : signaler la page depuis le menu « … » de la fiche", () => {
  const plain = (value: string) => value.replace(/\s+/g, " ").trim()
  const menuName = t("objectMenu.open", { name: "Collectif de Lyon" })

  /** Une capacité factice : sa mémoire des cibles signalées relance le rendu, comme les vrais fournisseurs. */
  function fakeReports() {
    const reported = new Set<string>()
    const listeners = new Set<() => void>()
    let version = 0
    const subscribe = (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
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

  function reportingTree(capability: ContentReportsCapability) {
    const source = { kind: "engine", contentReports: capability } as unknown as DiasporaleDataSource
    return (
      <I18nProvider locale="fr">
        <DataSourceProvider source={source}>
          <PageScreen handle="collectif-lyon" />
        </DataSourceProvider>
      </I18nProvider>
    )
  }

  it("un membre sans rôle signale la page par le menu ; elle se masque aussitôt pour lui, avec le retour à l'annuaire", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    mocks.detail = { status: "ready", data: view({ role: null }) }
    render(reportingTree(capability))
    // Jamais en bouton plein : le geste vit dans le menu.
    expect(screen.queryByRole("button", { name: t("contentReports.action.page") })).not.toBeInTheDocument()
    screen.getByRole("button", { name: menuName }).focus()
    await user.keyboard("{Enter}")
    await user.click(within(await screen.findByRole("menu")).getByRole("menuitem", { name: t("contentReports.action.page") }))
    const dialog = await screen.findByRole("dialog", { name: t("contentReports.title.page") })
    expect(within(dialog).queryByText(plain(t("contentReports.rootNotice")))).not.toBeInTheDocument()
    await user.click(within(dialog).getByRole("radio", { name: t("report.reason.misinformation") }))
    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))

    await waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "page", id: "page-lyon", reason: "misinformation" }))
    await waitFor(() => expect(screen.queryByRole("heading", { level: 1, name: "Collectif de Lyon" })).not.toBeInTheDocument())
    const notice = screen.getByRole("note")
    expect(notice).toHaveTextContent(plain(t("contentReports.masked.title")))
    expect(within(notice).getByRole("link", { name: t("pageBrowsing.backToDirectory") })).toHaveAttribute("href", routes.pages({ ownerKind: "association", country: "FR" }))
  })

  it("jamais sur la page que l'on administre ou signe ; sans capacité, aucun menu", () => {
    const { capability } = fakeReports()
    for (const role of ["admin", "signatory"] as const) {
      mocks.detail = { status: "ready", data: view({ role }) }
      const mounted = render(reportingTree(capability))
      expect(screen.getByRole("heading", { level: 1, name: "Collectif de Lyon" })).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: menuName })).not.toBeInTheDocument()
      mounted.unmount()
    }
    mocks.detail = { status: "ready", data: view({ role: null }) }
    render(tree())
    expect(screen.queryByRole("button", { name: menuName })).not.toBeInTheDocument()
  })
})

describe("PageScreen — ET-09 : les missions bénévoles de l'association sur sa fiche", () => {
  const MISSION: AidMissionCardView = {
    id: "mission-1", page: { id: "page-lyon", handle: "collectif-lyon", name: "Collectif de Lyon", badge: "community" }, title: "Accueillir les étudiants à la gare",
    description: "Orienter les nouveaux arrivants. (Mission fictive.)", country: "FR", city: "Lyon", area: null, startsAt: Date.UTC(2030, 0, 5, 9), endsAt: null,
    timeZone: "Europe/Paris", places: 4, signupCount: 1, status: "open", signedUp: false,
  }

  it("ses prochaines missions ouvertes se montrent sous ses évènements, lues pour cette page ; sans mission, aucune section", () => {
    const read = vi.fn((_args: { readonly pageId: string }) => ({ status: "ready" as const, data: [MISSION] }))
    const mutualAid = { useUpcomingPageMissions: read } as unknown as MutualAidCapability
    mocks.detail = { status: "ready", data: view({ role: null }) }
    const tree = (missions: MutualAidCapability) => (
      <I18nProvider locale="fr">
        <DataSourceProvider source={{ kind: "engine", mutualAid: missions } as unknown as DiasporaleDataSource}>
          <PageScreen handle="collectif-lyon" />
        </DataSourceProvider>
      </I18nProvider>
    )
    const { unmount } = render(tree(mutualAid))
    expect(read).toHaveBeenCalledWith({ pageId: "page-lyon" })
    const section = screen.getByRole("region", { name: "Missions bénévoles" })
    expect(within(section).getByRole("link", { name: "Accueillir les étudiants à la gare" })).toHaveAttribute("href", routes.mutualAidItem("mission-1"))
    unmount()
    render(tree({ useUpcomingPageMissions: () => ({ status: "ready", data: [] }) } as unknown as MutualAidCapability))
    expect(screen.queryByRole("region", { name: "Missions bénévoles" })).not.toBeInTheDocument()
  })
})
