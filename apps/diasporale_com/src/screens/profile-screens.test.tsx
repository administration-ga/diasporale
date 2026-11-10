// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import {
  contentReportKey,
  DataSourceProvider,
  type ActionResult,
  type ContentReportInput,
  type ContentReportsCapability,
  type ContentReportTarget,
  type DiasporaleDataSource,
  type Loadable,
  type MembershipView,
  type ProfileImageView,
  type ProfileView,
  type RelationView,
} from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useSyncExternalStore, type ComponentProps, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ProfilePostPagesProps } from "@/components/feed-pages"
import type { IcomNetwork, IcomState } from "@/components/icom"
import type { ProfileAlbums } from "@/components/profile-albums"
import { routes } from "@/lib/routes"
import { filledButtons } from "@/test-utils"

import { ProfileScreen } from "./profile-screens"

const mocks = vi.hoisted(() => ({
  membership: null as MembershipView | null,
  profile: { status: "loading" } as Loadable<ProfileView | null>,
  relation: { status: "loading" } as Loadable<RelationView>,
  network: null as IcomNetwork | null,
  icom: { status: "off", reason: "not_allowed" } as IcomState,
  callsOpen: false,
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
  mute: vi.fn<(personId: string) => Promise<ActionResult>>(),
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}))

vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error, info: mocks.info } }))

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
    muteAuthor: mocks.mute,
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
  useIcomState: () => mocks.icom,
  useWriteTo: () => mocks.write,
  IcomIsland: (props: { children: ReactNode }) => <>{props.children}</>,
}))
vi.mock("@antsia/social-features/iappel", () => ({ useRingRelation: () => ({ busyHandle: null, ring: mocks.ring }) }))
// L'interrupteur des appels (IM-01) : chaque test choisit sa position.
vi.mock("@/lib/calls", () => ({ callsAreOpen: () => mocks.callsOpen }))

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
  mocks.icom = { status: "off", reason: "not_allowed" }
  mocks.callsOpen = false
  mocks.search = ""
  for (const action of [mocks.follow, mocks.unfollow, mocks.connect, mocks.respond, mocks.block, mocks.unblock, mocks.mute]) {
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

  it("garde un accès aux réglages de son profil indisponible, sans distinguer le motif public", () => {
    mocks.profile = { status: "ready", data: null }
    render(tree())
    expect(screen.getByRole("link", { name: t("profile.managePublication") })).toHaveAttribute("href", `${routes.settings()}#profil`)
  })

  it("ne révèle aucun réglage personnel pour le profil indisponible d'autrui", () => {
    mocks.profile = { status: "ready", data: null }
    render(tree("autre.demo"))
    expect(screen.queryByRole("link", { name: t("profile.managePublication") })).not.toBeInTheDocument()
    expect(screen.getByText(t("profile.unavailableTitle"))).toBeInTheDocument()
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

  it("un seul bouton plein par zone : le geste de relation prime sur « Suivre »", () => {
    mocks.relation = { status: "ready", data: { connection: "none", connectionId: null, following: false } }
    const first = render(tree(otherProfile.handle))
    expect(screen.getByRole("button", { name: t("relation.connect") })).toHaveClass("bg-social-fill")
    expect(screen.getByRole("button", { name: t("relation.follow") })).toHaveClass("bg-neutral")
    first.unmount()

    mocks.relation = { status: "ready", data: { connection: "connected", connectionId: "connections_boris", following: false } }
    const second = render(tree(otherProfile.handle))
    expect(screen.getByRole("button", { name: t("relation.follow") })).toHaveClass("bg-social-fill")
    second.unmount()

    mocks.relation = { status: "ready", data: { connection: "connected", connectionId: "connections_boris", following: true } }
    render(tree(otherProfile.handle))
    expect(screen.getByRole("button", { name: t("relation.unfollow") })).toHaveClass("bg-neutral")
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

describe("ProfileScreen — « Appeler » derrière l'interrupteur des appels (IM-01)", () => {
  const relationProfile: ProfileView = { ...profile, personId: "persons_boris", handle: "boris.demo", displayName: "Boris", isSelf: false }
  const callName = t("contact.callTo", { name: relationProfile.displayName })
  const writeName = t("contact.writeTo", { name: relationProfile.displayName })

  beforeEach(() => {
    mocks.profile = { status: "ready", data: relationProfile }
    mocks.relation = { status: "ready", data: { connection: "connected", connectionId: "connections_boris", following: false } }
    mocks.icom = { status: "on", network: { networkId: "networks_diasporale", slug: "diasporale", personId: membership.personId } as IcomNetwork }
  })

  it("appels fermés : « Écrire » reste, aucun geste d'appel n'est proposé à une relation", () => {
    mocks.callsOpen = false
    render(tree(relationProfile.handle))

    expect(screen.getByRole("button", { name: writeName })).toBeEnabled()
    expect(screen.queryByRole("button", { name: callName })).not.toBeInTheDocument()
    expect(screen.queryByText(t("contact.call"))).not.toBeInTheDocument()
    expect(mocks.ring).not.toHaveBeenCalled()
  })

  it("appels ouverts : « Appeler » revient à côté d'« Écrire » et fait sonner la relation", () => {
    mocks.callsOpen = true
    render(tree(relationProfile.handle))

    expect(screen.getByRole("button", { name: writeName })).toBeEnabled()
    const call = screen.getByRole("button", { name: callName })
    expect(call).toBeEnabled()
    fireEvent.click(call)
    expect(mocks.ring).toHaveBeenCalledExactlyOnceWith({ personId: relationProfile.personId, handle: relationProfile.handle, displayName: relationProfile.displayName })
  })

  it("DS-02 : « Appeler » en tonal des messages, comme « Écrire » ; un seul bouton plein dans la zone", () => {
    mocks.callsOpen = true
    render(tree(relationProfile.handle))

    const call = screen.getByRole("button", { name: callName })
    const write = screen.getByRole("button", { name: writeName })
    expect(call).toHaveClass("bg-message-soft", "text-message-ink")
    expect(write).toHaveClass("bg-message-soft")
    const zone = call.parentElement
    if (zone === null) throw new Error("Zone d'actions absente")
    expect(filledButtons(zone)).toEqual([screen.getByRole("button", { name: t("relation.follow") })])
  })

  it("ouverts ou non, aucun appel hors relation : seul « Écrire », fermé, dit pourquoi", () => {
    mocks.callsOpen = true
    mocks.relation = { status: "ready", data: { connection: "none", connectionId: null, following: false } }
    render(tree(relationProfile.handle))

    expect(screen.getByRole("button", { name: writeName })).toBeDisabled()
    expect(screen.queryByRole("button", { name: callName })).not.toBeInTheDocument()
  })
})

describe("ProfileScreen — RP-02 : le menu « … » de la fiche d'autrui", () => {
  const other: ProfileView = { ...profile, personId: "persons_boris", handle: "boris.demo", displayName: "Boris NZÉ", isSelf: false }
  const menuName = t("objectMenu.open", { name: other.displayName })
  const plain = (value: string) => value.replace(/\s+/g, " ").trim()

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

  function withReports(capability: ContentReportsCapability, handle: string) {
    const source = { contentReports: capability } as unknown as DiasporaleDataSource
    return <I18nProvider locale="fr"><DataSourceProvider source={source}><ProfileScreen handle={handle} /></DataSourceProvider></I18nProvider>
  }

  async function openMenu(user: ReturnType<typeof userEvent.setup>) {
    screen.getByRole("button", { name: menuName }).focus()
    await user.keyboard("{Enter}")
    return screen.findByRole("menu")
  }

  beforeEach(() => {
    mocks.profile = { status: "ready", data: other }
    mocks.relation = { status: "ready", data: { connection: "none", connectionId: null, following: false } }
  })

  it("Signaler ce profil, Bloquer, Mettre en sourdine, Copier le lien : dans le menu, aucun en bouton plein", async () => {
    const user = userEvent.setup()
    render(withReports(fakeReports().capability, other.handle))
    // « Bloquer » n'est plus un bouton de la barre : il vit dans le menu.
    expect(screen.queryByRole("button", { name: t("relation.block") })).not.toBeInTheDocument()
    const zone = screen.getByRole("button", { name: menuName }).parentElement
    if (zone === null) throw new Error("Zone d'actions absente")
    expect(filledButtons(zone)).toEqual([screen.getByRole("button", { name: t("relation.connect") })])

    const menu = await openMenu(user)
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      t("contentReports.action.person"),
      t("relation.block"),
      t("postMenu.mute", { name: other.displayName }),
      t("profileMenu.copyLink"),
    ])
  })

  it("Signaler ce profil : la feuille dit que le réseau racine traite le dossier ; envoyé, la fiche se masque", async () => {
    const user = userEvent.setup()
    const { capability, report } = fakeReports()
    render(withReports(capability, other.handle))
    await user.click(within(await openMenu(user)).getByRole("menuitem", { name: t("contentReports.action.person") }))
    const dialog = await screen.findByRole("dialog", { name: t("contentReports.title.person") })
    expect(within(dialog).getByText(plain(t("contentReports.rootNotice")))).toBeInTheDocument()
    await user.click(within(dialog).getByRole("radio", { name: t("report.reason.impersonation") }))
    await user.click(within(dialog).getByRole("button", { name: t("contentReports.confirm") }))

    await waitFor(() => expect(report).toHaveBeenCalledExactlyOnceWith({ kind: "person", id: other.personId, reason: "impersonation" }))
    await waitFor(() => expect(screen.queryByRole("heading", { level: 1, name: other.displayName })).not.toBeInTheDocument())
    const notice = screen.getByRole("note")
    expect(notice).toHaveTextContent(plain(t("contentReports.masked.title")))
    expect(within(notice).getByRole("link", { name: t("contentReports.back.feed") })).toHaveAttribute("href", routes.feed())
  })

  it("Bloquer, depuis le menu, ouvre la confirmation de la barre de relation", async () => {
    const user = userEvent.setup()
    render(withReports(fakeReports().capability, other.handle))
    await user.click(within(await openMenu(user)).getByRole("menuitem", { name: t("relation.block") }))
    const group = await screen.findByRole("group", { name: t("relation.blockConfirm", { name: other.displayName }) })
    await user.click(within(group).getByRole("button", { name: t("relation.blockAction") }))
    expect(mocks.block).toHaveBeenCalledExactlyOnceWith(other.personId)
  })

  it("Mettre en sourdine et Copier le lien : le choix privé, puis l'adresse du profil", async () => {
    const user = userEvent.setup()
    render(withReports(fakeReports().capability, other.handle))
    await user.click(within(await openMenu(user)).getByRole("menuitem", { name: t("postMenu.mute", { name: other.displayName }) }))
    await waitFor(() => expect(mocks.mute).toHaveBeenCalledExactlyOnceWith(other.personId))
    expect(mocks.success).toHaveBeenCalledWith(t("postMenu.muted", { name: other.displayName }))

    await user.click(within(await openMenu(user)).getByRole("menuitem", { name: t("profileMenu.copyLink") }))
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(t("profileMenu.linkCopied")))
    expect(await navigator.clipboard.readText()).toBe(new URL(routes.profile(other.handle), window.location.origin).href)
  })

  it("bloqué par soi : ni signalement ni sourdine, seul le lien reste ; sans capacité, pas de « Signaler »", async () => {
    const user = userEvent.setup()
    mocks.relation = { status: "ready", data: { connection: "blocked_by_me", connectionId: null, following: false } }
    const blocked = render(withReports(fakeReports().capability, other.handle))
    expect(within(await openMenu(user)).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([t("profileMenu.copyLink")])
    blocked.unmount()

    mocks.relation = { status: "ready", data: { connection: "none", connectionId: null, following: false } }
    render(tree(other.handle))
    expect(within(await openMenu(user)).queryByRole("menuitem", { name: t("contentReports.action.person") })).not.toBeInTheDocument()
  })

  it("jamais sur sa propre fiche : aucun menu, aucun geste de signalement", () => {
    mocks.profile = { status: "ready", data: profile }
    render(withReports(fakeReports().capability, profile.handle))
    expect(screen.queryByRole("button", { name: t("objectMenu.open", { name: profile.displayName }) })).not.toBeInTheDocument()
    expect(screen.queryByText(t("contentReports.action.person"))).not.toBeInTheDocument()
  })
})
