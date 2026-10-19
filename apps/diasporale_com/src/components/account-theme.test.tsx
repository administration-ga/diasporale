// @vitest-environment jsdom
import { AppearanceProvider } from "@antsia/social-features/shell/appearance"
import { DataSourceProvider } from "@diasporale/features/data"
import { createDemoDataSource, DemoStore } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { APPEARANCE, DEFAULT_CHARTE } from "@/lib/appearance"

import { AccountTheme } from "./account-theme"
import { ThemePicker } from "./theme-picker"

const THEME_KEY = "antsia:diasporale:theme"
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

function mount(store: DemoStore) {
  return render(
    <I18nProvider locale="fr">
      <AppearanceProvider storagePrefix={APPEARANCE.storagePrefix} themes={APPEARANCE.themes}>
        <DataSourceProvider source={createDemoDataSource(store)}>
          <AccountTheme>
            <ThemePicker />
          </AccountTheme>
        </DataSourceProvider>
      </AppearanceProvider>
    </I18nProvider>,
  )
}

const radio = (id: string) => within(screen.getByRole("radiogroup")).getAllByRole("radio").find((candidate) => candidate.getAttribute("value") === id)!
const accountTheme = (store: DemoStore, personId: string) => store.getState().persons[personId]?.theme

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.dataset.charte = DEFAULT_CHARTE
})

afterEach(() => cleanup())

describe("AccountTheme — le thème suit le compte en session", () => {
  it("en session, choisir Gaboma l'applique tout de suite et l'enregistre sur le compte", async () => {
    const store = demoStore()
    await store.switchTo("p-mireille")
    await act(async () => {
      mount(store)
    })
    await act(async () => radio("gaboma").click())
    expect(document.documentElement.dataset.charte).toBe("diasporale-gaboma")
    expect(accountTheme(store, "p-mireille")).toBe("gaboma")
  })

  it("le thème du compte l'emporte sur celui de l'appareil", async () => {
    window.localStorage.setItem(THEME_KEY, "gaboma")
    const store = demoStore()
    await store.switchTo("p-mireille")
    await store.saveAccountTheme("sable")
    await act(async () => {
      mount(store)
    })
    expect(radio("sable").getAttribute("aria-checked")).toBe("true")
    expect(document.documentElement.dataset.charte).toBe("diasporale")
  })

  it("un thème du compte que DIASPORALE n'a pas (Soleil d'antsia.ga) laisse le choix de l'appareil", async () => {
    window.localStorage.setItem(THEME_KEY, "gaboma")
    const store = demoStore()
    await store.switchTo("p-mireille")
    await store.saveAccountTheme("soleil")
    await act(async () => {
      mount(store)
    })
    expect(radio("gaboma").getAttribute("aria-checked")).toBe("true")
    expect(document.documentElement.dataset.charte).toBe("diasporale-gaboma")
    expect(accountTheme(store, "p-mireille")).toBe("soleil")
  })

  it("hors session, le choix reste sur l'appareil et rien ne s'enregistre", async () => {
    const store = demoStore()
    await act(async () => {
      mount(store)
    })
    await act(async () => radio("gaboma").click())
    expect(window.localStorage.getItem(THEME_KEY)).toBe("gaboma")
    expect(Object.values(store.getState().persons).some((person) => person.theme !== undefined)).toBe(false)
  })
})
