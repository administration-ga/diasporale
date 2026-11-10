// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataSourceProvider } from "../data/context"
import type { ActionResult, DiasporaleDataSource, PublishInput, PublishOutcome } from "../data/port"
import type { PostView } from "../data/types"
import { getFixedT } from "../i18n"
import { I18nProvider } from "../i18n/client"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { PostComposerSheet } from "./composer"

/**
 * FD-04 — l'auteur sait où en est sa publication : l'avis d'envoi dit l'état que le
 * fournisseur rend, jamais « Publié. » d'office ; le refus d'un pays fermé dit ce que
 * dit le composeur.
 */
const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const t = getFixedT("fr")
const en = getFixedT("en")
const publish = vi.fn<(input: PublishInput) => Promise<ActionResult<PublishOutcome>>>()
const source = {
  kind: "engine",
  actions: { publish, uploadMedia: vi.fn() },
  useSession: () => ({ status: "ready", data: { status: "anonymous" } }),
} as unknown as DiasporaleDataSource

const shared: PostView = {
  id: "post-cite",
  author: { kind: "person", id: "person-autre", handle: "membre.b", displayName: "Membre B", badges: [] },
  body: "Une publication citée (démo).",
  media: [],
  share: null,
  shareCount: 0,
  scope: { reach: "diaspora" },
  audience: "public",
  visibility: "network",
  moderation: "published",
  createdAt: Date.UTC(2026, 10, 10, 9),
  reactionCount: 0,
  commentCount: 0,
  myReaction: null,
  isMine: false,
  bookmarked: false,
  edited: false,
}

const routes: FeatureRoutes = {
  profile: (handle) => `/@${handle}`, post: (id) => `/publication/${id}`, page: (handle) => `/pages/${handle}`,
  hub: (country) => `/pays/${country}`, feed: () => "/fil", sponsor: () => "/parrainer",
  settings: () => "/parametres", attestation: () => "/attestation", enter: () => "/entrer",
}
function Link({ children, ...props }: ComponentProps<"a">) { return <a {...props}>{children}</a> }

function mount(props: { readonly share?: PostView; readonly memberCountry?: "FR" | "ES"; readonly openCountries?: readonly ("FR" | "ES")[] | null; readonly locale?: "fr" | "en" } = {}) {
  return render(<I18nProvider locale={props.locale ?? "fr"}><RoutingProvider routes={routes} Link={Link}><DataSourceProvider source={source}>
    <PostComposerSheet
      open
      onOpenChange={vi.fn()}
      memberCountry={props.memberCountry ?? "FR"}
      openCountries={props.openCountries === undefined ? ["FR"] : props.openCountries}
      {...(props.share ? { share: props.share } : {})}
    />
  </DataSourceProvider></RoutingProvider></I18nProvider>)
}

async function send(text: string, label = t("composer.bodyLabel"), button = t("composer.publish")) {
  const user = userEvent.setup()
  await user.type(screen.getByRole("textbox", { name: label }), text)
  await user.click(screen.getByRole("button", { name: button }))
  await waitFor(() => expect(publish).toHaveBeenCalledOnce())
}

beforeEach(() => {
  vi.clearAllMocks()
  publish.mockReset()
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => { vi.unstubAllGlobals() })

describe("Composeur — l'avis d'envoi dit l'état réel de la publication (FD-04)", () => {
  it.each([
    { moderation: "published" as const, key: "composer.published" },
    { moderation: "pending_review" as const, key: "composer.sentForReview" },
    { moderation: null, key: "composer.sent" },
  ])("état rendu $moderation : « $key »", async ({ moderation, key }) => {
    publish.mockResolvedValue({ ok: true, value: { moderation } })
    mount()
    await send("Bonjour à tous")
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(t(key)))
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it("une publication retenue n'est jamais annoncée « Publié. » ; un état non rendu non plus", async () => {
    for (const moderation of ["pending_review", null] as const) {
      publish.mockReset().mockResolvedValue({ ok: true, value: { moderation } })
      mocks.success.mockClear()
      const view = mount()
      await send("Texte de recette")
      await waitFor(() => expect(mocks.success).toHaveBeenCalledOnce())
      expect(mocks.success).not.toHaveBeenCalledWith(t("composer.published"))
      view.unmount()
    }
  })

  it.each([
    { moderation: "published" as const, key: "composer.shared" },
    { moderation: null, key: "composer.shareSent" },
  ])("un partage dit aussi l'état rendu ($moderation)", async ({ moderation, key }) => {
    publish.mockResolvedValue({ ok: true, value: { moderation } })
    mount({ share: shared })
    await send("Mon mot", t("composer.shareBodyLabel"))
    expect(publish.mock.calls[0]?.[0]).toMatchObject({ sharedPostId: "post-cite" })
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(t(key)))
  })

  it("en anglais, l'état non rendu reste prudent", async () => {
    publish.mockResolvedValue({ ok: true, value: { moderation: null } })
    mount({ locale: "en" })
    await send("Hello", en("composer.bodyLabel"), en("composer.publish"))
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(en("composer.sent")))
  })
})

describe("Composeur — pays non ouvert : le refus dit ce que dit le composeur (FD-04)", () => {
  it("pays ouverts encore inconnus : le refus du fournisseur parle du hub, pas d'une « fonction »", async () => {
    publish.mockResolvedValue({ ok: false, code: "hub_not_open" })
    mount({ memberCountry: "ES", openCountries: null })
    await send("Bonjour Madrid")
    expect(publish.mock.calls[0]?.[0]).toMatchObject({ reach: "local", country: "ES" })
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(t("errors.hub_not_open")))
    expect(t("errors.hub_not_open")).toMatch(/pas encore ouvert/)
    expect(t("errors.hub_not_open")).toMatch(/toute la diaspora/)
    expect(mocks.success).not.toHaveBeenCalled()
  })
})
