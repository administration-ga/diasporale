// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ActionResult, Loadable, MembershipView, ProfileImageView, ProfileView, RelationView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ProfilePostPagesProps } from "@/components/feed-pages"
import type { IcomNetwork } from "@/components/icom"
import type { ProfileAlbums } from "@/components/profile-albums"
import { routes } from "@/lib/routes"

import { ProfileScreen } from "./profile-screens"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  profile: { status: "loading" } as Loadable<ProfileView | null>,
  relation: { status: "loading" } as Loadable<RelationView>,
  network: null as IcomNetwork | null,
  search: "",
  read: vi.fn(),
  gate: vi.fn(),
  shell: vi.fn(),
  posts: vi.fn(),
  albums: vi.fn(),
  avatar: vi.fn(),
  cover: vi.fn(),
  ring: vi.fn(),
  write: vi.fn(),
  follow: vi.fn<(handle: string) => Promise<ActionResult>>(),
  unfollow: vi.fn<(personId: string) => Promise<ActionResult>>(),
  connect: vi.fn<(personId: string) => Promise<ActionResult>>(),
  respond: vi.fn<(connectionId: string, accept: boolean) => Promise<ActionResult>>(),
  block: vi.fn<(personId: string) => Promise<ActionResult>>(),
  unblock: vi.fn<(personId: string) => Promise<ActionResult>>(),
}))

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.search) }))

vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useProfile: (handle: string) => {
    mocks.read(handle)
    return mocks.profile
  },
  useActions: () => ({
    follow: mocks.follow,
    unfollow: mocks.unfollow,
    connect: mocks.connect,
    respondToConnection: mocks.respond,
    block: mocks.block,
    unblock: mocks.unblock,
  }),
  useRelation: () => mocks.relation,
  usePage: () => ({ status: "loading" }),
}))

vi.mock("@/components/gate", () => ({
  Gate: (props: { require: "member"; children: (session: { membership: MembershipView | null }) => ReactNode }) => {
    mocks.gate(props.require)
    return <>{props.children({ membership: mocks.membership })}</>
  },
}))

vi.mock("@/components/app-shell", () => ({
  AppShell: (props: { membership: MembershipView; children: ReactNode }) => {
    mocks.shell(props.membership)
    return <>{props.children}</>
  },
}))

// Les hôtes de communication et leurs contextes ne participent pas à ces
// gardes d'affichage ; aucun appel ou abonnement Convex réel n'est monté.
vi.mock("@/components/icom", () => ({
  useEngineNetwork: () => mocks.network,
  useIcomState: () => ({ status: "off", reason: "not_allowed" }),
  useWriteTo: () => mocks.write,
  IcomIsland: (props: { children: ReactNode }) => <>{props.children}</>,
}))
vi.mock("@antsia/social-features/iappel", () => ({ useRingRelation: () => ({ busyHandle: null, ring: mocks.ring }) }))

vi.mock("@/components/feed-pages", () => ({
  ProfilePostPages: (props: ProfilePostPagesProps) => {
    mocks.posts(props)
    return <section aria-label="Mur paginé DIASPORALE" />
  },
}))

vi.mock("@/components/profile-albums", () => ({
  ProfileAlbums: (props: ComponentProps<typeof ProfileAlbums>) => {
    mocks.albums(props)
    return <section aria-label="Albums DIASPORALE" />
  },
}))

vi.mock("@/components/profile-images", () => ({
  ProfileAvatar: (props: { id: string; name: string; image: ProfileImageView | null }) => {
    mocks.avatar(props)
    return <div data-testid="avatar-garde" />
  },
  ProfileCover: (props: { image: ProfileImageView | null }) => {
    mocks.cover(props)
    return <div data-testid="couverture-gardee" />
  },
}))

const t = getFixedT("fr")
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
const profile: ProfileView = {
  personId: membership.personId,
  handle: membership.handle,
  displayName: membership.displayName,
  headline: "Présentation choisie",
  avatar: { url: "/avatar-garde.png", withheld: null },
  cover: { url: "/couverture-gardee.png", withheld: null },
  badges: [],
  facet: { countryOfResidence: "FR", city: "Ville confidentielle", postSlug: "poste-confidentiel", arrivedAt: 2007, helpAvailable: true },
  publicFacet: { countryOfResidence: "CA" },
  postName: "Poste confidentiel",
  isSelf: true,
  posts: [],
}

function tree(handle = "@AWA.DEMO") {
  return <I18nProvider locale="fr"><ProfileScreen handle={handle} /></I18nProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.membership = membership
  mocks.profile = { status: "ready", data: profile }
  mocks.relation = { status: "loading" }
  mocks.network = { networkId: "networks_diasporale", slug: "diasporale", personId: membership.personId } as IcomNetwork
  mocks.search = ""
  for (const action of [mocks.follow, mocks.unfollow, mocks.connect, mocks.respond, mocks.block, mocks.unblock]) {
    action.mockReset().mockResolvedValue({ ok: true, value: null })
  }
})

afterEach(cleanup)

describe("ProfileScreen — mur et confidentialité du profil DIASPORALE", () => {
  it("monte le mur prêt avec le handle canonique et l'adhésion du lecteur", () => {
    render(tree())

    expect(mocks.gate).toHaveBeenLastCalledWith("member")
    expect(mocks.shell).toHaveBeenLastCalledWith(membership)
    expect(mocks.read).toHaveBeenLastCalledWith("awa.demo")
    expect(screen.getByRole("region", { name: "Mur paginé DIASPORALE" })).toBeInTheDocument()
    expect(mocks.posts).toHaveBeenLastCalledWith(expect.objectContaining({ membership, handle: profile.handle, now: expect.any(Number), emptyFallback: expect.anything() }))
    expect(screen.getByText("Ville confidentielle")).toBeInTheDocument()
    expect(screen.getByText("Poste confidentiel")).toBeInTheDocument()
  })

  it.each(["apercu=1", "apercu=1&onglet=albums&nouveau=1"])("masque le mur, les albums et toutes les commandes propriétaires en aperçu (%s)", (search) => {
    mocks.search = search
    render(tree())

    expect(screen.getByText(t("profile.previewNotice"))).toBeInTheDocument()
    expect(screen.getByText(t("profile.previewPostsUnavailable"))).toBeInTheDocument()
    expect(mocks.posts).not.toHaveBeenCalled()
    expect(mocks.albums).not.toHaveBeenCalled()
    expect(screen.queryByRole("navigation", { name: t("profile.tabsLabel") })).not.toBeInTheDocument()
    const links = screen.getAllByRole("link")
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAccessibleName(t("profile.previewExit"))
    expect(links[0]).toHaveAttribute("href", routes.profile(profile.handle))
    expect(screen.queryByText("Ville confidentielle")).not.toBeInTheDocument()
    expect(screen.queryByText("Poste confidentiel")).not.toBeInTheDocument()
    expect(screen.queryByText("2007")).not.toBeInTheDocument()
    expect(screen.queryByText(t("facet.helpAvailable"))).not.toBeInTheDocument()
    expect(screen.getAllByText("Canada").length).toBeGreaterThan(0)
  })

  it.each(["error", "null"] as const)("ne monte aucune chaîne ni image quand la fiche est %s", (status) => {
    mocks.profile = status === "error" ? { status: "error", code: "PRIVATE_PROFILE_FAILURE" } : { status: "ready", data: null }
    render(tree())

    if (status === "error") {
      expect(screen.getByRole("alert")).toHaveTextContent(t("profile.errorBody"))
      expect(screen.getByRole("button", { name: t("profile.reload") })).toBeInTheDocument()
      expect(screen.queryByText("PRIVATE_PROFILE_FAILURE")).not.toBeInTheDocument()
    } else {
      expect(screen.getByText(t("profile.unavailableTitle"))).toBeInTheDocument()
      expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    }
    expect(mocks.posts).not.toHaveBeenCalled()
    expect(mocks.albums).not.toHaveBeenCalled()
    expect(mocks.avatar).not.toHaveBeenCalled()
    expect(mocks.cover).not.toHaveBeenCalled()
  })

  it.each([
    { isSelf: true, canPublish: true, visible: true },
    { isSelf: true, canPublish: false, visible: false },
    { isSelf: false, canPublish: true, visible: false },
    { isSelf: false, canPublish: false, visible: false },
  ])("ne propose les images que chez soi et avec le droit de publier ($isSelf / $canPublish)", ({ isSelf, canPublish, visible }) => {
    mocks.membership = { ...membership, canPublish }
    mocks.profile = { status: "ready", data: { ...profile, isSelf } }
    render(tree())

    const link = screen.queryByRole("link", { name: t("profile.images.edit") })
    if (visible) expect(link).toHaveAttribute("href", routes.settingsImages())
    else expect(link).not.toBeInTheDocument()
  })

  it("ne propose pas un éditeur d'images absent de la démonstration", () => {
    mocks.network = null
    render(tree())
    expect(screen.queryByRole("link", { name: t("profile.images.edit") })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: t("profile.edit") })).toBeInTheDocument()
  })

  it("transmet les retenues d'analyse aux deux composants gardés sans les convertir en images servies", () => {
    const avatar: ProfileImageView = { url: "/avatar-retenu.png", withheld: "fileScanPending" }
    const cover: ProfileImageView = { url: "/couverture-retenue.png", withheld: "fileQuarantined" }
    mocks.profile = { status: "ready", data: { ...profile, avatar, cover } }
    render(tree())

    expect(mocks.avatar).toHaveBeenLastCalledWith({ id: profile.personId, name: profile.displayName, image: avatar })
    expect(mocks.cover).toHaveBeenLastCalledWith({ image: cover })
  })

  it.each(["a%25", "a%"])("transmet le segment déjà décodé sans décodage supplémentaire (%s)", (handle) => {
    render(tree(handle))

    expect(mocks.read).toHaveBeenLastCalledWith(handle)
    expect(screen.getByRole("heading", { level: 1, name: profile.displayName })).toBeInTheDocument()
  })

  it("ouvre les albums hors aperçu sans monter la chaîne du mur à la même place", () => {
    mocks.search = "onglet=albums"
    render(tree())

    expect(screen.getByRole("region", { name: "Albums DIASPORALE" })).toBeInTheDocument()
    expect(mocks.posts).not.toHaveBeenCalled()
    expect(mocks.albums).toHaveBeenLastCalledWith(expect.objectContaining({ handle: profile.handle, isSelf: true, canPublish: true, preview: false, variant: "albums" }))
  })
})

describe("ProfileScreen — suivre et ne plus suivre selon l'adhésion", () => {
  const otherProfile: ProfileView = { ...profile, personId: "persons_boris", handle: "boris.demo", displayName: "Boris", isSelf: false }

  beforeEach(() => {
    mocks.profile = { status: "ready", data: otherProfile }
    mocks.relation = { status: "ready", data: { connection: "none", connectionId: null, following: true } }
  })

  it("un membre en attente peut retirer son abonnement existant par l'identifiant de la personne", async () => {
    mocks.membership = { ...membership, status: "en_attente", canPublish: false }
    render(tree(otherProfile.handle))
    const unfollow = screen.getByRole("button", { name: t("relation.unfollow") })

    expect(unfollow).toBeEnabled()
    expect(unfollow).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: t("relation.connect") })).toBeDisabled()
    await act(async () => { fireEvent.click(unfollow) })

    expect(mocks.unfollow).toHaveBeenCalledExactlyOnceWith(otherProfile.personId)
    expect(mocks.follow).not.toHaveBeenCalled()
    expect(mocks.connect).not.toHaveBeenCalled()
  })

  it("un membre en attente ne peut ni suivre une nouvelle personne ni demander une connexion", () => {
    mocks.membership = { ...membership, status: "en_attente", canPublish: false }
    mocks.relation = { status: "ready", data: { connection: "none", connectionId: null, following: false } }
    render(tree(otherProfile.handle))
    const follow = screen.getByRole("button", { name: t("relation.follow") })
    const connect = screen.getByRole("button", { name: t("relation.connect") })

    expect(follow).toBeDisabled()
    expect(follow).toHaveAttribute("aria-pressed", "false")
    expect(connect).toBeDisabled()
    fireEvent.click(follow)
    fireEvent.click(connect)
    expect(mocks.follow).not.toHaveBeenCalled()
    expect(mocks.connect).not.toHaveBeenCalled()
  })

  it("le droit de se désabonner n'ouvre pas la réponse à une demande reçue en attente", () => {
    mocks.membership = { ...membership, status: "en_attente", canPublish: false }
    mocks.relation = { status: "ready", data: { connection: "requested_by_them", connectionId: "connections_boris", following: true } }
    render(tree(otherProfile.handle))

    expect(screen.getByRole("button", { name: t("relation.unfollow") })).toBeEnabled()
    const accept = screen.getByRole("button", { name: t("relation.accept") })
    const decline = screen.getByRole("button", { name: t("relation.decline") })
    expect(accept).toBeDisabled()
    expect(decline).toBeDisabled()
    fireEvent.click(accept)
    fireEvent.click(decline)
    expect(mocks.respond).not.toHaveBeenCalled()
  })

  it.each([false, true])("conserve le droit normal de suivre ou de se désabonner (%s)", async (following) => {
    mocks.relation = { status: "ready", data: { connection: "none", connectionId: null, following } }
    render(tree(otherProfile.handle))
    const button = screen.getByRole("button", { name: t(following ? "relation.unfollow" : "relation.follow") })

    expect(button).toBeEnabled()
    expect(screen.getByRole("button", { name: t("relation.connect") })).toBeEnabled()
    await act(async () => { fireEvent.click(button) })
    if (following) {
      expect(mocks.unfollow).toHaveBeenCalledExactlyOnceWith(otherProfile.personId)
      expect(mocks.follow).not.toHaveBeenCalled()
    } else {
      expect(mocks.follow).toHaveBeenCalledExactlyOnceWith(otherProfile.handle)
      expect(mocks.unfollow).not.toHaveBeenCalled()
    }
  })

  it("verrouille immédiatement le désabonnement en vol et permet une reprise après refus", async () => {
    mocks.membership = { ...membership, status: "en_attente", canPublish: false }
    let finish!: (result: ActionResult) => void
    mocks.unfollow.mockImplementationOnce(() => new Promise<ActionResult>((resolve) => { finish = resolve }))
    render(tree(otherProfile.handle))
    const button = screen.getByRole("button", { name: t("relation.unfollow") })

    act(() => {
      fireEvent.click(button)
      fireEvent.click(button)
    })
    expect(mocks.unfollow).toHaveBeenCalledExactlyOnceWith(otherProfile.personId)
    expect(button).toBeDisabled()
    await act(async () => { finish({ ok: false, code: "unknown" }) })
    expect(button).toBeEnabled()

    await act(async () => { fireEvent.click(button) })
    expect(mocks.unfollow).toHaveBeenCalledTimes(2)
    expect(mocks.follow).not.toHaveBeenCalled()
  })
})
