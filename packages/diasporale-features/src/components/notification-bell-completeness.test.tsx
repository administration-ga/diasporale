/**
 * Cloche DIASPORALE — complétude de NOTRE liste de genres (NP-04), test BLOQUANT : chaque genre que
 * DIASPORALE déclare savoir dire (`NOTIFICATION_KINDS`) a sa phrase en français et en anglais, son
 * icône et sa destination (`BELL_DESTINATIONS`). Un genre ajouté à notre liste sans l'un des trois
 * fait échouer ce test. L'écart avec les genres du MOTEUR, lui, est mesuré sans bloquer
 * (`apps/diasporale_com/src/data/bell-engine-kinds-gap.test.ts`) : la cloche a un repli sûr,
 * « Nouvelle activité », éprouvé ici aussi.
 */
import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataSourceProvider } from "../data/context"
import type { DiasporaleDataSource } from "../data/port"
import { NOTIFICATION_KINDS, type NotificationKind, type NotificationView } from "../data/types"
import { getFixedT } from "../i18n"
import { DIASPORALE_LOCALES, type LocaleTree } from "../i18n/resources"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { renderWithI18n } from "../test-utils"
import { BELL_ACTOR_LED_KINDS, BELL_KIND_ICONS, BELL_SYSTEM_KINDS, NotificationBell } from "./notification-bell"
import { BELL_DESTINATION_KINDS, BELL_DESTINATIONS } from "./notification-destinations"

const fr = getFixedT("fr")

/** La phrase posée à ce chemin dans une langue, ou `undefined`. */
function sentence(locale: "fr" | "en", path: string): string | undefined {
  let node: string | LocaleTree | undefined = DIASPORALE_LOCALES[locale]
  for (const part of path.split(".")) {
    if (node === undefined || typeof node === "string") return undefined
    node = node[part]
  }
  return typeof node === "string" && node.trim() !== "" ? node : undefined
}

/** Les clés de phrase d'un genre : sa phrase entière du système, ou la suite du nom de qui a agi. */
function sentenceKeys(kind: NotificationKind): string[] {
  const keys: string[] = []
  if ((BELL_SYSTEM_KINDS as readonly string[]).includes(kind)) keys.push(`bell.system.${kind}`)
  if ((BELL_ACTOR_LED_KINDS as readonly string[]).includes(kind)) keys.push(`bell.kind.${kind}`)
  return keys
}

describe("cloche — chaque genre de notre liste a sa phrase, son icône et sa destination", () => {
  it.each(NOTIFICATION_KINDS)("%s", (kind) => {
    const keys = sentenceKeys(kind)
    expect(keys.length, `${kind} : ni phrase du système ni suite d'un nom`).toBeGreaterThan(0)
    for (const key of keys) {
      expect(sentence("fr", key), `${key} (fr)`).toBeDefined()
      expect(sentence("en", key), `${key} (en)`).toBeDefined()
    }
    expect(BELL_KIND_ICONS[kind], `${kind} : icône`).toBeDefined()
    expect(BELL_DESTINATION_KINDS, `${kind} : destination`).toContain(BELL_DESTINATIONS[kind])
  })

  it("la page suivie qui a publié se dit aussi derrière le nom de la page, et un fichier libéré a sa phrase", () => {
    for (const key of ["bell.kind.page_post", "bell.fileReleased"]) {
      expect(sentence("fr", key), key).toBeDefined()
      expect(sentence("en", key), key).toBeDefined()
    }
  })

  it("la table des destinations ne porte aucun genre hors de notre liste", () => {
    expect(Object.keys(BELL_DESTINATIONS).sort()).toEqual([...NOTIFICATION_KINDS].sort())
  })

  it("« aucune destination » est une décision écrite, genre par genre", () => {
    const none = NOTIFICATION_KINDS.filter((kind) => BELL_DESTINATIONS[kind] === "none")
    // L'issue de l'attestation se lit dans la phrase ; un fichier retenu n'a pas de page ; le moteur
    // ne sert pas l'adresse de la page d'un groupe thématique (issue [S1] de NP-04).
    expect(none).toEqual(["attestation_verified", "attestation_not_confirmed", "file_withheld", "thematic_group_invite"])
  })
})

// ─── Le repli : un genre inconnu se dit « Nouvelle activité », sans erreur ───

const NOW = Date.UTC(2026, 10, 10, 9)
const routes: FeatureRoutes = {
  profile: (handle) => `/@${handle}`,
  post: (id) => `/publication/${id}`,
  page: (handle) => `/pages/${handle}`,
  hub: (country) => `/pays/${country}`,
  feed: () => "/fil",
  sponsor: () => "/parrainer",
  settings: () => "/parametres",
  attestation: () => "/verification",
  enter: () => "/entrer",
}

function Link({ children, ...props }: ComponentProps<"a">) {
  return <a {...props}>{children}</a>
}

function source(items: readonly NotificationView[]): DiasporaleDataSource {
  return {
    kind: "engine",
    useNotifications: () => ({ status: "ready", data: items }),
    useUnreadCount: () => ({ status: "ready", data: { count: items.length, capped: false } }),
    actions: { markNotificationRead: vi.fn(async () => ({ ok: true, value: null })), markAllNotificationsRead: vi.fn(async () => ({ ok: true, value: null })) },
  } as unknown as DiasporaleDataSource
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("cloche — le repli d'un genre que DIASPORALE ne connaît pas", () => {
  it("dit « Nouvelle activité dans DIASPORALE », garde la date et le marquage, sans lien inventé", async () => {
    const unknown: NotificationView = { id: "avis-inconnu", kind: "other", actor: null, createdAt: NOW - 60_000, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null }
    renderWithI18n(
      <DataSourceProvider source={source([unknown])}>
        <RoutingProvider routes={routes} Link={Link}>
          <NotificationBell />
        </RoutingProvider>
      </DataSourceProvider>,
    )
    await userEvent.setup().click(screen.getByRole("button", { name: fr("bell.openUnread", { count: 1 }) }))
    const dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText(fr("bell.system.other"))).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: fr("bell.markRead") })).toBeInTheDocument()
    expect(within(dialog).queryByRole("link")).not.toBeInTheDocument()
  })
})
