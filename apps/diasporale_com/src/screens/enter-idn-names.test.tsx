// @vitest-environment jsdom
import type { Loadable, SessionView } from "@diasporale/features/data"
import { DEMO_IDN_IDENTITIES } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { IdnScreen } from "./enter-screens"
import { WelcomeScreen } from "./welcome-screen"

const mocks = vi.hoisted(() => ({
  source: { kind: "demo" as "demo" | "engine" },
  session: { status: "ready", data: { status: "anonymous" } } as Loadable<SessionView>,
  router: { push: vi.fn(), replace: vi.fn() },
  signInWithIdn: vi.fn(),
  suggestions: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }))
vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useDataSource: () => mocks.source,
  useSession: () => mocks.session,
  useActions: () => ({ signInWithIdn: mocks.signInWithIdn }),
  useOpenCountries: () => ({ status: "ready", data: [{ country: "FR" }] }),
  useHandleSuggestions: (displayName: string) => {
    mocks.suggestions(displayName)
    return ["alias.libre"]
  },
}))
vi.mock("@/components/site-chrome", () => ({
  PublicShell: (props: { children: ReactNode }) => <main>{props.children}</main>,
}))
vi.mock("@/components/entry-door", () => ({
  EntryDoor: (props: { children: ReactNode }) => <main>{props.children}</main>,
  EntryCard: (props: { children: ReactNode }) => <section>{props.children}</section>,
}))
vi.mock("@/components/gate", () => ({ Gate: (props: { children: () => ReactNode }) => props.children() }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const t = getFixedT("fr")
function tree(children: ReactNode = <IdnScreen />) {
  return <I18nProvider locale="fr">{children}</I18nProvider>
}
function chooseCustom() {
  fireEvent.click(screen.getByRole("radio", { name: new RegExp(t("idn.customTitle")) }))
  return {
    firstName: screen.getByRole("textbox", { name: t("idn.firstName") }),
    lastName: screen.getByRole("textbox", { name: t("idn.lastName") }),
  }
}
function consent() {
  fireEvent.click(screen.getByRole("checkbox", { name: t("idn.consent") }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.source = { kind: "demo" }
  mocks.session = { status: "ready", data: { status: "anonymous" } }
  mocks.signInWithIdn.mockReset().mockResolvedValue({ ok: true, value: null })
})
afterEach(cleanup)

describe("IDN de démonstration — présentation des noms civils", () => {
  it("laisse la composition intacte puis affiche les champs canoniques au blur et soumet ces noms", async () => {
    render(tree())
    const { firstName, lastName } = chooseCustom()
    fireEvent.compositionStart(firstName)
    fireEvent.change(firstName, { target: { value: "  jean-rÉMY   éLOÏSE  " } })
    expect(firstName).toHaveValue("  jean-rÉMY   éLOÏSE  ")
    fireEvent.compositionEnd(firstName)
    fireEvent.change(lastName, { target: { value: "  ndong   mba  " } })
    expect(lastName).toHaveValue("  ndong   mba  ")
    fireEvent.blur(firstName)
    fireEvent.blur(lastName)

    await waitFor(() => {
      expect(firstName).toHaveValue("Jean-Rémy Éloïse")
      expect(lastName).toHaveValue("NDONG MBA")
    })
    consent()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("idn.submit") })) })
    expect(mocks.signInWithIdn).toHaveBeenCalledExactlyOnceWith({
      firstName: "Jean-Rémy Éloïse", lastName: "NDONG MBA", loa: 2, gaboneseNationality: true,
    })
    expect(mocks.router.push).toHaveBeenCalledExactlyOnceWith(routes.welcome())
    expect(mocks.error).not.toHaveBeenCalled()
  })

  it("normalise aussi une soumission sans blur en préservant accents, apostrophe et tiret", async () => {
    render(tree())
    const { firstName, lastName } = chooseCustom()
    consent()
    fireEvent.change(firstName, { target: { value: "  élOÏse   jean-rÉmy  " } })
    fireEvent.change(lastName, { target: { value: "  n’dong   mba-éba  " } })
    expect(firstName).toHaveValue("  élOÏse   jean-rÉmy  ")
    expect(lastName).toHaveValue("  n’dong   mba-éba  ")
    const form = screen.getByRole("button", { name: t("idn.submit") }).closest("form")!
    await act(async () => { fireEvent.submit(form) })

    expect(mocks.signInWithIdn).toHaveBeenCalledExactlyOnceWith({
      firstName: "Éloïse Jean-Rémy", lastName: "N’DONG MBA-ÉBA", loa: 2, gaboneseNationality: true,
    })
  })

  it("présente les patronymes des presets en majuscules et transmet le preset choisi sans perdre ses attributs", async () => {
    render(tree())
    for (const preset of DEMO_IDN_IDENTITIES) {
      expect(screen.getByRole("radio", { name: new RegExp(`${preset.firstName} ${preset.lastName.toLocaleUpperCase("fr")}`) })).toBeInTheDocument()
    }
    const preset = DEMO_IDN_IDENTITIES[0]!
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`${preset.firstName} ${preset.lastName.toLocaleUpperCase("fr")}`) }))
    consent()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("idn.submit") })) })

    expect(mocks.signInWithIdn).toHaveBeenCalledExactlyOnceWith({
      firstName: preset.firstName, lastName: preset.lastName.toLocaleUpperCase("fr"), loa: preset.loa, gaboneseNationality: preset.gaboneseNationality,
    })
    expect(screen.queryByRole("textbox", { name: t("idn.firstName") })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: t("idn.lastName") })).not.toBeInTheDocument()
  })

  it("conserve l'alias social libre lors de sa saisie et de son blur, sans en déduire un nom civil", async () => {
    const user = userEvent.setup()
    render(tree(<WelcomeScreen />))
    await user.click(screen.getByRole("combobox", { name: t("welcome.countryLabel") }))
    await user.type(screen.getByRole("searchbox"), "France")
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /France/ }))
    await user.click(screen.getByRole("button", { name: new RegExp(t("common.next")) }))
    const displayName = await screen.findByRole("textbox", { name: t("welcome.displayNameLabel") })
    const alias = "l’Atelier éCHO-Monde"
    await user.type(displayName, alias)
    await user.tab()

    expect(displayName).toHaveValue(alias)
    expect(mocks.suggestions).toHaveBeenLastCalledWith(alias)
    expect(mocks.signInWithIdn).not.toHaveBeenCalled()
  })

  it("ne monte aucune simulation de nom civil avec la source moteur", () => {
    mocks.source = { kind: "engine" }
    const { container } = render(tree())

    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    expect(mocks.signInWithIdn).not.toHaveBeenCalled()
    expect(mocks.router.push).not.toHaveBeenCalled()
  })
})
