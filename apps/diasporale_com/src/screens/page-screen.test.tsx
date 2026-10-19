// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { DataSourceProvider, type DiasporaleDataSource, type MembershipView, type PageDetailQuery, type PageDetailView, type PagesCapability } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PageScreen } from "./page-screen"

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
