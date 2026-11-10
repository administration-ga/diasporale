// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY, type MembershipStatus } from "@diasporale/domain"
import { DataSourceProvider, type AccountView, type ActionResult, type DiasporaleDataSource, type Loadable, type MembershipView, type SessionView } from "@diasporale/features/data"
import { createDemoDataSource, DemoStore } from "@diasporale/features/demo"
import { act, cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MembershipStatusRefresh } from "./membership-refresh"

/**
 * EA-03 — la relecture du statut ne part que si le moteur signale un écart, une seule
 * fois par écart ; jamais hors session, sans adhésion, sans écart, ni chez un
 * fournisseur qui ne sert pas la relecture (la démonstration).
 */

const ACCOUNT: AccountView = { id: "person_fictive", idn: { loa: 1 }, local: null, nameHints: {} }

function membership(status: MembershipStatus, statusOutdated?: boolean): MembershipView {
  return {
    personId: "person_fictive",
    handle: "lecture.demo",
    displayName: "Lecteur FICTIF",
    status,
    badges: ["community"],
    facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
    joinedAt: 1,
    verifiedSince: null,
    sponsoredBy: null,
    attestation: { outcome: "none", postSlug: null, requestedAt: null },
    root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
    canPublish: status !== "en_attente",
    rateTier: "standard",
    directoryVisibility: "hidden",
    ...(statusOutdated === undefined ? {} : { statusOutdated }),
  }
}

const signedIn = (member: MembershipView | null): Loadable<SessionView> => ({ status: "ready", data: { status: "signed_in", account: ACCOUNT, membership: member } })

/** Une source de démonstration dont la session et la relecture sont tenues par le test. */
function harness(options: { withRefresh?: boolean; result?: ActionResult<{ changed: boolean }> } = {}) {
  const demo = createDemoDataSource(new DemoStore(null, () => Date.UTC(2026, 10, 10, 12), 0))
  const refreshMembership = vi.fn(async (): Promise<ActionResult<{ changed: boolean }>> => options.result ?? { ok: true, value: { changed: true } })
  let session: Loadable<SessionView> = { status: "loading" }
  const source: DiasporaleDataSource = {
    ...demo,
    useSession: () => session,
    actions: options.withRefresh === false ? demo.actions : { ...demo.actions, refreshMembership },
  }
  const view = render(
    <DataSourceProvider source={source}>
      <MembershipStatusRefresh />
    </DataSourceProvider>,
  )
  const show = async (next: Loadable<SessionView>) => {
    session = next
    await act(async () => {
      view.rerender(
        <DataSourceProvider source={source}>
          <MembershipStatusRefresh />
        </DataSourceProvider>,
      )
    })
  }
  return { refreshMembership, show, view }
}

afterEach(cleanup)

describe("MembershipStatusRefresh — relire le statut seulement sur écart (EA-03)", () => {
  it("un écart signalé à l'ouverture de session : une seule relecture, même si l'écran se redessine", async () => {
    const { refreshMembership, show, view } = harness()
    await show(signedIn(membership("en_attente", true)))
    await show(signedIn(membership("en_attente", true)))
    expect(refreshMembership).toHaveBeenCalledTimes(1)
    // Rien ne s'affiche.
    expect(view.container.textContent).toBe("")
  })

  it("aucune relecture sans écart : chargement, hors session, sans adhésion, écart absent ou faux", async () => {
    const { refreshMembership, show } = harness()
    await show({ status: "loading" })
    await show({ status: "ready", data: { status: "anonymous" } })
    await show(signedIn(null))
    await show(signedIn(membership("declaree")))
    await show(signedIn(membership("declaree", false)))
    expect(refreshMembership).not.toHaveBeenCalled()
  })

  it("un refus ne boucle pas ; un nouvel écart, après résorption ou changement de statut, est relu", async () => {
    const { refreshMembership, show } = harness({ result: { ok: false, code: "rate_limited" } })
    await show(signedIn(membership("en_attente", true)))
    await show(signedIn(membership("en_attente", true)))
    expect(refreshMembership).toHaveBeenCalledTimes(1)
    // Le retour d'IDN : le statut a changé et un nouvel écart est signalé (lien révoqué depuis).
    await show(signedIn(membership("declaree", true)))
    expect(refreshMembership).toHaveBeenCalledTimes(2)
    // Écart résorbé, puis signalé de nouveau sur le même statut.
    await show(signedIn(membership("declaree", false)))
    await show(signedIn(membership("declaree", true)))
    expect(refreshMembership).toHaveBeenCalledTimes(3)
  })

  it("un fournisseur sans relecture (la démonstration) n'appelle rien et ne casse rien", async () => {
    const { refreshMembership, show } = harness({ withRefresh: false })
    await show(signedIn(membership("en_attente", true)))
    expect(refreshMembership).not.toHaveBeenCalled()
  })
})
