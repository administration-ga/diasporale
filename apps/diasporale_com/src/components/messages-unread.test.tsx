// @vitest-environment jsdom
import { NetworkProvider } from "@antsia/api/network"
import { cleanup, render } from "@testing-library/react"
import { getFunctionName } from "convex/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DEFAULT_CHARTE } from "@/lib/appearance"
import { engineRoutes } from "@/lib/engine-routes"
import type { IcomNetwork } from "@/lib/icom-state"

import { MessagesUnreadReader } from "./messages-unread"

/**
 * Le lecteur des non-lus de Messages (UX-06), sous le réseau courant : les deux décomptes du
 * serveur, réunis et plafonnés comme la carte iCom ; aucun chiffre ne reste après le démontage.
 */

type ServerCount = { readonly total: number; readonly capped: boolean }

const mocks = vi.hoisted(() => ({
  calls: [] as { name: string; args: unknown }[],
  directs: undefined as ServerCount | undefined,
  groups: undefined as ServerCount | undefined,
}))

// Les lectures du moteur : des sondes, sans Convex ni session.
vi.mock("@antsia/api/hooks", () => ({
  useAuthenticatedConvexQuery: (reference: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(reference)
    mocks.calls.push({ name, args })
    if (name === "modules/messaging/inbox:totalUnread") return { data: mocks.directs }
    if (name === "modules/groups/threads:totalUnread") return { data: mocks.groups }
    return { data: undefined }
  },
}))

const NETWORK = { networkId: "networks_diasporale", slug: "diasporale", personId: "persons_awa" } as IcomNetwork

function tree(onTotal: (total: number) => void) {
  return (
    <NetworkProvider networkId={NETWORK.networkId} slug={NETWORK.slug} personId={NETWORK.personId} charte={DEFAULT_CHARTE} routes={engineRoutes}>
      <MessagesUnreadReader onTotal={onTotal} />
    </NetworkProvider>
  )
}

function renderReader() {
  const onTotal = vi.fn<(total: number) => void>()
  const view = render(tree(onTotal))
  return { ...view, onTotal, rerender: () => view.rerender(tree(onTotal)) }
}

beforeEach(() => {
  mocks.calls = []
  mocks.directs = undefined
  mocks.groups = undefined
})

afterEach(() => {
  cleanup()
})

describe("lecteur des non-lus de Messages (UX-06)", () => {
  it("lit les deux décomptes du serveur dans le réseau de DIASPORALE et les réunit", () => {
    mocks.directs = { total: 4, capped: false }
    mocks.groups = { total: 2, capped: false }
    const { onTotal } = renderReader()
    expect(onTotal).toHaveBeenLastCalledWith(6)
    expect(mocks.calls).toEqual(
      expect.arrayContaining([
        { name: "modules/messaging/inbox:totalUnread", args: { networkId: NETWORK.networkId } },
        { name: "modules/groups/threads:totalUnread", args: { networkId: NETWORK.networkId } },
      ]),
    )
    // Aucune autre lecture : ni les mises en relation, ni le contenu des conversations.
    expect(new Set(mocks.calls.map((call) => call.name))).toEqual(new Set(["modules/messaging/inbox:totalUnread", "modules/groups/threads:totalUnread"]))
  })

  it("plafonne comme la carte iCom : 99 dès qu'un décompte est plafonné ou que la somme l'atteint", () => {
    mocks.directs = { total: 99, capped: true }
    mocks.groups = { total: 1, capped: false }
    const capped = renderReader()
    expect(capped.onTotal).toHaveBeenLastCalledWith(99)
    capped.unmount()

    mocks.directs = { total: 60, capped: false }
    mocks.groups = { total: 45, capped: false }
    expect(renderReader().onTotal).toHaveBeenLastCalledWith(99)
  })

  it("tant que les décomptes ne sont pas arrivés, aucun chiffre", () => {
    const { onTotal } = renderReader()
    expect(onTotal).toHaveBeenLastCalledWith(0)
  })

  it("suit le serveur sans rechargement : un message reçu fait paraître le chiffre, l'ouvrir le retire", () => {
    mocks.directs = { total: 0, capped: false }
    mocks.groups = { total: 0, capped: false }
    const reader = renderReader()
    expect(reader.onTotal).toHaveBeenLastCalledWith(0)

    mocks.directs = { total: 1, capped: false }
    reader.rerender()
    expect(reader.onTotal).toHaveBeenLastCalledWith(1)

    mocks.directs = { total: 0, capped: false }
    reader.rerender()
    expect(reader.onTotal).toHaveBeenLastCalledWith(0)
  })

  it("démonté (iCom fermé, sortie), il retire le chiffre de la barre", () => {
    mocks.directs = { total: 3, capped: false }
    const reader = renderReader()
    expect(reader.onTotal).toHaveBeenLastCalledWith(3)
    reader.unmount()
    expect(reader.onTotal).toHaveBeenLastCalledWith(0)
  })
})
