// @vitest-environment jsdom
import { useDataSource } from "@diasporale/features/data"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen } from "@testing-library/react"
import { getFunctionName, type FunctionReference } from "convex/server"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EngineDataProviders } from "./engine-providers"

interface ProviderProps {
  children: ReactNode
  convexUrl: string
  authClient: unknown
  ensurePerson: FunctionReference<"mutation">
  isSessionActive: FunctionReference<"query">
  labels: { loading: string; failed: string; retry: string }
}

const mocks = vi.hoisted(() => ({
  convexUrl: "http://127.0.0.1:3210" as string | null,
  convex: { client: "convex-fictif" },
  authClient: { client: "auth-fictif" },
  useConvex: vi.fn(),
  provider: vi.fn<(props: ProviderProps) => void>(),
  source: vi.fn(),
  icom: vi.fn(),
}))

vi.mock("@antsia/api/next-provider", () => ({
  EngineConvexProvider: (props: ProviderProps) => {
    mocks.provider(props)
    return <>{props.children}</>
  },
}))
vi.mock("convex/react", () => ({ useConvex: mocks.useConvex }))
vi.mock("@/lib/auth-client", () => ({ authClient: mocks.authClient }))
vi.mock("@/lib/env", () => ({ publicEnv: { get convexUrl() { return mocks.convexUrl } } }))
vi.mock("./engine-source", () => ({ createEngineDataSource: mocks.source }))
vi.mock("@/components/icom", () => ({
  EngineIcom: (props: { children: ReactNode }) => {
    mocks.icom()
    return <>{props.children}</>
  },
}))

function SourceProbe() {
  return <p>{useDataSource().kind}</p>
}

function tree() {
  return <I18nProvider locale="fr"><EngineDataProviders><SourceProbe /></EngineDataProviders></I18nProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.convexUrl = "http://127.0.0.1:3210"
  mocks.useConvex.mockReturnValue(mocks.convex)
  mocks.source.mockReturnValue({ kind: "engine" })
})

afterEach(cleanup)

describe("EngineDataProviders — contrat de session du moteur", () => {
  it("transmet la session réactive et la création de personne au fournisseur commun, puis expose la source moteur", () => {
    const view = render(tree())
    const props = mocks.provider.mock.lastCall?.[0]
    expect(props).toBeDefined()
    expect(getFunctionName(props!.isSessionActive)).toBe("modules/platform/authentication:mySession")
    expect(getFunctionName(props!.ensurePerson)).toBe("modules/people/persons:ensureMyPerson")
    expect(props).toMatchObject({
      convexUrl: mocks.convexUrl,
      authClient: mocks.authClient,
      labels: { loading: "Ouverture de votre session…", failed: "Votre session n'a pas pu s'ouvrir.", retry: "Réessayer" },
    })
    expect(mocks.source).toHaveBeenCalledExactlyOnceWith({ convex: mocks.convex, authClient: mocks.authClient })
    expect(screen.getByText("engine")).toBeInTheDocument()
    expect(mocks.icom).toHaveBeenCalledOnce()

    view.rerender(tree())
    expect(mocks.source).toHaveBeenCalledOnce()
  })

  it("ferme l'arbre moteur et traduit l'avertissement si le backend n'est pas configuré", () => {
    mocks.convexUrl = null
    render(tree())

    expect(screen.getByRole("alert")).toHaveTextContent("Le service n'est pas configuré sur cet environnement.")
    expect(screen.queryByText("engine")).not.toBeInTheDocument()
    expect(mocks.provider).not.toHaveBeenCalled()
    expect(mocks.useConvex).not.toHaveBeenCalled()
    expect(mocks.source).not.toHaveBeenCalled()
    expect(mocks.icom).not.toHaveBeenCalled()
  })
})
