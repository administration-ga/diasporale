// @vitest-environment jsdom
import { useCallsAvailable } from "@antsia/api/network"
import { ConversationHeader } from "@antsia/social-features/messagerie"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { IcomNetwork } from "@/lib/icom-state"

import { IcomIsland } from "./icom"

/**
 * IM-01 sur la déclaration du moteur (IC-04, antsia#138) : l'interrupteur des appels de
 * DIASPORALE passe par l'îlot au moteur (`callsAvailable`). Fermé, une surface d'iCom montée
 * telle quelle — ici l'en-tête d'une conversation à deux — ne propose aucun bouton d'appel ;
 * ouvert, elle les rend. Personne fictive.
 */
const mocks = vi.hoisted(() => ({ callsOpen: false }))
vi.mock("@/lib/calls", () => ({ callsAreOpen: () => mocks.callsOpen }))
// L'îlot ne monte pas la couche de communication : ses paquets lourds restent hors de ce test.
vi.mock("@antsia/social-features/shell", () => ({ CommunicationShell: () => null }))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/messages",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

const NETWORK = { networkId: "networks_diasporale", slug: "diasporale", personId: "persons_awa" } as IcomNetwork
/** Le titre du fil : une donnée du test, pas un texte d'interface. */
const TITLE = "Awa OGOOUÉ"

/** Ce que le moteur lit sous l'îlot. */
function Probe() {
  return <output data-testid="calls-available">{String(useCallsAvailable())}</output>
}

function mount() {
  return render(
    <I18nProvider locale="fr">
      <IcomIsland network={NETWORK}>
        <Probe />
        <ConversationHeader variant="page" kind="chat" title={TITLE} counterpartHandle="awa.demo" onBack={vi.fn()} onCallAudio={vi.fn()} onCallVideo={vi.fn()} />
      </IcomIsland>
    </I18nProvider>,
  )
}

beforeEach(() => {
  mocks.callsOpen = false
})
afterEach(cleanup)

describe("iCom — l'interrupteur des appels déclaré au moteur (callsAvailable)", () => {
  it("fermé : le moteur le lit fermé, et l'en-tête d'une conversation ne propose ni audio ni vidéo", () => {
    mount()
    expect(screen.getByTestId("calls-available")).toHaveTextContent("false")
    expect(screen.queryByRole("button", { name: "Appel audio" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Appel vidéo" })).toBeNull()
    // Le reste de l'en-tête demeure : le titre du fil.
    expect(screen.getByText(TITLE)).toBeInTheDocument()
  })

  it("ouvert : le moteur le lit ouvert, et l'en-tête rend l'appel audio et l'appel vidéo", () => {
    mocks.callsOpen = true
    mount()
    expect(screen.getByTestId("calls-available")).toHaveTextContent("true")
    expect(screen.getByRole("button", { name: "Appel audio" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Appel vidéo" })).toBeInTheDocument()
  })
})
