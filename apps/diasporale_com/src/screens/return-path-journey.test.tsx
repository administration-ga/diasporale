// @vitest-environment jsdom
import { DataSourceProvider } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Gate } from "@/components/gate"
import { RETURN_PATH_KEY, peekReturnPath } from "@/lib/return-path"
import { routes } from "@/lib/routes"

import { CodeScreen } from "./enter-screens"

/**
 * UX-02 et MO-03, de bout en bout, au fournisseur de démonstration : un lien reçu ouvert hors
 * session mène à la porte, le code est saisi, puis la page demandée s'affiche — sans que
 * l'adresse ait jamais porté la destination. Données fictives seulement.
 */

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => navigation }))

const t = getFixedT("fr")
const EVENT = routes.associationEvent("amicale-lyon", "evt-42")

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  window.sessionStorage.clear()
  window.history.replaceState(null, "", "/")
})

function mount(store: DemoStore, children: ReactNode) {
  return render(
    <I18nProvider locale="fr">
      <DataSourceProvider source={createDemoDataSource(store)}>{children}</DataSourceProvider>
    </I18nProvider>,
  )
}

/** La page d'un évènement : une page de membre, telle que la garde la protège. */
const EventPage = () => <Gate require="member">{() => <p data-testid="evenement">évènement</p>}</Gate>

describe("Un lien reçu, la porte, le code, puis la page demandée (UX-02, MO-03)", () => {
  it("un membre ouvre hors session le lien d'un évènement, saisit son code, et arrive sur l'évènement", async () => {
    const store = new DemoStore(null, () => Date.UTC(2026, 10, 10, 12), 0)

    // 1. Le lien, ouvert sans session : la garde retient la page et renvoie à la porte.
    window.history.replaceState(null, "", `${EVENT}?jeton=secret`)
    mount(store, <EventPage />)
    await vi.waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(routes.enter()))
    expect(screen.queryByTestId("evenement")).toBeNull()
    expect(peekReturnPath()?.path).toBe(EVENT)
    cleanup()
    navigation.replace.mockClear()

    // 2. La porte : l'adresse ne porte aucune destination ; le code est saisi.
    window.history.replaceState(null, "", routes.enterCode())
    const user = userEvent.setup()
    mount(store, <CodeScreen />)
    await user.type(screen.getByRole("textbox", { name: t("code.emailLabel") }), "mireille@example.com")
    await user.click(screen.getByRole("button", { name: t("code.send") }))
    const code = await vi.waitFor(() => {
      const pending = store.getState().pendingCode?.code
      if (!pending) throw new Error("aucun code")
      return pending
    })
    await user.type(await screen.findByRole("textbox", { name: t("code.codeLabel") }), code)
    await user.click(screen.getByRole("button", { name: t("code.verify") }))

    // 3. La sortie de la porte mène à l'évènement, pas au fil.
    await vi.waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(EVENT))
    expect(navigation.replace).not.toHaveBeenCalledWith(routes.feed())
    expect(window.location.search).toBe("")
    cleanup()

    // 4. L'arrivée sur la page l'affiche et efface la page demandée : elle a servi une fois.
    window.history.replaceState(null, "", EVENT)
    mount(store, <EventPage />)
    expect(await screen.findByTestId("evenement")).toBeInTheDocument()
    expect(peekReturnPath()).toBeNull()
  })

  it("une valeur altérée dans l'onglet ne mène jamais dehors : la porte mène au fil", async () => {
    const store = new DemoStore(null, () => Date.UTC(2026, 10, 10, 12), 0)
    window.sessionStorage.setItem(RETURN_PATH_KEY, JSON.stringify({ path: "//exemple.test/piege", at: Date.now() }))
    window.history.replaceState(null, "", routes.enterCode())
    const user = userEvent.setup()
    mount(store, <CodeScreen />)
    await user.type(screen.getByRole("textbox", { name: t("code.emailLabel") }), "mireille@example.com")
    await user.click(screen.getByRole("button", { name: t("code.send") }))
    const code = await vi.waitFor(() => {
      const pending = store.getState().pendingCode?.code
      if (!pending) throw new Error("aucun code")
      return pending
    })
    await user.type(await screen.findByRole("textbox", { name: t("code.codeLabel") }), code)
    await user.click(screen.getByRole("button", { name: t("code.verify") }))

    await vi.waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(routes.feed()))
    expect(navigation.replace.mock.calls.flat().some((target) => String(target).includes("exemple.test"))).toBe(false)
  })
})
