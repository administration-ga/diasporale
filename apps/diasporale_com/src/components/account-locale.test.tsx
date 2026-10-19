// @vitest-environment jsdom
import { DataSourceProvider } from "@diasporale/features/data"
import { createDemoDataSource, DemoStore } from "@diasporale/features/demo"
import { I18nProvider, useDiasporaleT } from "@diasporale/features/i18n/client"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AccountLocale } from "./account-locale"
import { LanguageSwitch } from "./preferences"

const refresh = vi.fn()
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn() }) }))

const NOW = Date.UTC(2026, 9, 19, 12)

/** Une démonstration en mémoire, sans latence : le compte fictif tient lieu de compte du moteur. */
function demoStore() {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  }
  return new DemoStore(storage, () => NOW, 0)
}

/** Un écran client quelconque : son libellé doit changer de langue sans être remonté. */
function Probe() {
  const { t } = useDiasporaleT()
  return <p data-testid="probe">{t("nav.feed")}</p>
}

function mount(store: DemoStore, locale: "fr" | "en" = "fr") {
  return render(
    <I18nProvider locale={locale}>
      <DataSourceProvider source={createDemoDataSource(store)}>
        <AccountLocale>
          <LanguageSwitch />
          <Probe />
        </AccountLocale>
      </DataSourceProvider>
    </I18nProvider>,
  )
}

const button = (name: string) => screen.getByRole("button", { name })
const cookieLocale = () => /(?:^|; )diasporale-langue=([^;]*)/.exec(document.cookie)?.[1]

beforeEach(() => {
  refresh.mockClear()
  document.cookie = "diasporale-langue=; path=/; max-age=0"
  document.documentElement.lang = "fr"
})

afterEach(() => cleanup())

describe("bascule de langue — tout de suite, sans rechargement", () => {
  it("hors session : English traduit l'écran sur place, garde le choix sur l'appareil et rafraîchit le serveur", async () => {
    const store = demoStore()
    await act(async () => {
      mount(store)
    })
    expect(screen.getByTestId("probe").textContent).toBe("Fil")
    await act(async () => button("English").click())
    expect(screen.getByTestId("probe").textContent).toBe("Feed")
    expect(button("English").getAttribute("aria-pressed")).toBe("true")
    expect(button("Français").getAttribute("aria-pressed")).toBe("false")
    expect(cookieLocale()).toBe("en")
    expect(document.documentElement.lang).toBe("en")
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("la langue déjà choisie ne rafraîchit rien", async () => {
    const store = demoStore()
    await act(async () => {
      mount(store)
    })
    await act(async () => button("Français").click())
    expect(refresh).not.toHaveBeenCalled()
  })

  it("le fournisseur rejoint la langue que le rendu serveur apporte", async () => {
    const store = demoStore()
    const view = mount(store)
    expect(screen.getByTestId("probe").textContent).toBe("Fil")
    await act(async () => {
      view.rerender(
        <I18nProvider locale="en">
          <DataSourceProvider source={createDemoDataSource(store)}>
            <AccountLocale>
              <LanguageSwitch />
              <Probe />
            </AccountLocale>
          </DataSourceProvider>
        </I18nProvider>,
      )
    })
    expect(screen.getByTestId("probe").textContent).toBe("Feed")
  })
})

describe("AccountLocale — la langue suit le compte en session", () => {
  it("en session, choisir English l'enregistre sur le compte", async () => {
    const store = demoStore()
    await store.switchTo("p-mireille")
    await act(async () => {
      mount(store)
    })
    await act(async () => button("English").click())
    expect(screen.getByTestId("probe").textContent).toBe("Feed")
    expect(store.getState().persons["p-mireille"]?.locale).toBe("en")
  })

  it("à la connexion, la langue du compte s'applique à l'appareil", async () => {
    const store = demoStore()
    await store.switchTo("p-mireille")
    await store.saveAccountLocale("en")
    await act(async () => {
      mount(store, "fr")
    })
    expect(screen.getByTestId("probe").textContent).toBe("Feed")
    expect(cookieLocale()).toBe("en")
    expect(document.documentElement.lang).toBe("en")
  })

  it("sans langue sur le compte, l'appareil garde la sienne", async () => {
    const store = demoStore()
    await store.switchTo("p-mireille")
    await act(async () => {
      mount(store, "en")
    })
    expect(screen.getByTestId("probe").textContent).toBe("Feed")
    expect(store.getState().persons["p-mireille"]?.locale).toBeUndefined()
  })
})
