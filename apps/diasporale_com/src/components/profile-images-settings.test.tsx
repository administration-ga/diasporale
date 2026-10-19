// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { DiasporaleDataSource, Loadable, MembershipView, ProfileImagesActions, ProfileView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ProfileImagesEditorProps } from "./profile-images-editor"
import { ProfileImagesSettings } from "./profile-images-settings"

const mocks = vi.hoisted(() => ({
  source: { kind: "engine", profileImages: null } as Pick<DiasporaleDataSource, "kind" | "profileImages">,
  profile: { status: "loading" } as Loadable<ProfileView | null>,
  read: vi.fn(),
  editor: vi.fn(),
  reload: vi.fn(),
}))

vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useDataSource: () => mocks.source,
  useProfile: (handle: string) => {
    mocks.read(handle)
    return mocks.profile
  },
}))

vi.mock("./profile-images-editor", () => ({
  ProfileImagesEditor: (props: ProfileImagesEditorProps) => {
    mocks.editor(props)
    return <div role="group" aria-label="Éditeur des images du profil" />
  },
}))

const t = getFixedT("fr")
const actions: ProfileImagesActions = { set: vi.fn(), clear: vi.fn() }
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
  headline: null,
  avatar: { url: "/avatar-garde.png", withheld: null },
  cover: { url: null, withheld: "fileScanPending" },
  badges: [],
  facet: { countryOfResidence: "FR" },
  publicFacet: { countryOfResidence: "FR" },
  postName: null,
  isSelf: true,
  posts: [],
}

function tree(member = membership) {
  return <I18nProvider locale="fr"><ProfileImagesSettings membership={member} /></I18nProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.source = { kind: "engine", profileImages: actions }
  mocks.profile = { status: "ready", data: profile }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("ProfileImagesSettings — gardes de l'éditeur du profil commun", () => {
  it.each(["demo", "actions_nulles", "actions_absentes"] as const)("ne monte rien pour %s et ne lit aucun profil", (kind) => {
    mocks.source = kind === "demo" ? { kind: "demo", profileImages: actions }
      : kind === "actions_nulles" ? { kind: "engine", profileImages: null } : { kind: "engine" }
    const { container } = render(tree())

    expect(container).toBeEmptyDOMElement()
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.editor).not.toHaveBeenCalled()
  })

  it("dit la lecture seule en attente sans appeler la lecture du profil ni monter l'éditeur", () => {
    render(tree({ ...membership, status: "en_attente", canPublish: false }))

    expect(screen.getByText(t("profile.images.readOnly"))).toBeInTheDocument()
    expect(mocks.read).not.toHaveBeenCalled()
    expect(mocks.editor).not.toHaveBeenCalled()
  })

  it("réserve l'éditeur au profil propre et transmet ses deux images gardées et les seules actions d'images", () => {
    render(tree())

    expect(mocks.read).toHaveBeenLastCalledWith(membership.handle)
    expect(screen.getByRole("group", { name: "Éditeur des images du profil" })).toBeInTheDocument()
    expect(mocks.editor).toHaveBeenLastCalledWith({ avatar: profile.avatar, cover: profile.cover, actions })
    expect(screen.getByText(t("profile.images.shared"))).toBeInTheDocument()
  })

  it.each(["autre_personne", "pas_soi", "absent"] as const)("ferme l'éditeur pour un profil %s", (kind) => {
    mocks.profile = { status: "ready", data: kind === "absent" ? null : kind === "autre_personne" ? { ...profile, personId: "persons_autre" } : { ...profile, isSelf: false } }
    render(tree())

    expect(screen.getByText(t("profile.images.unavailable"))).toBeInTheDocument()
    expect(mocks.editor).not.toHaveBeenCalled()
  })

  it("annonce le chargement sans exposer de commandes de l'éditeur", () => {
    mocks.profile = { status: "loading" }
    render(tree())

    expect(screen.getByRole("status")).toHaveTextContent(t("common.pleaseWait"))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(mocks.editor).not.toHaveBeenCalled()
  })

  it("annonce une erreur fermée et propose un vrai rechargement du client", () => {
    mocks.profile = { status: "error", code: "PRIVATE_PROFILE_FAILURE" }
    render(tree())

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent(t("profile.errorBody"))
    expect(screen.queryByText("PRIVATE_PROFILE_FAILURE")).not.toBeInTheDocument()
    expect(mocks.editor).not.toHaveBeenCalled()
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    vi.stubGlobal("window", new Proxy(window, {
      get(target, property) {
        return property === "location" ? { reload: mocks.reload } : Reflect.get(target, property, target)
      },
    }))
    fireEvent.click(within(alert).getByRole("button", { name: t("profile.reload") }))
    expect(mocks.reload).toHaveBeenCalledOnce()
  })
})
