// @vitest-environment jsdom
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"
import { OFFLINE_CACHE_PREFIX, offlineCacheName } from "@/lib/service-worker"

import { SignOutSettings } from "./sign-out-settings"

const mocks = vi.hoisted(() => ({
  kind: "engine" as "engine" | "demo",
  signOut: vi.fn<() => Promise<void>>(),
  assign: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("@diasporale/features/data", () => ({
  useActions: () => ({ signOutEverywhere: mocks.signOut }),
  useDataSource: () => ({ kind: mocks.kind }),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}))

const t = getFixedT("fr")

function tree(locale: "fr" | "en" = "fr") {
  return <I18nProvider locale={locale}><SignOutSettings /></I18nProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.kind = "engine"
  mocks.signOut.mockReset().mockResolvedValue(undefined)
  vi.stubGlobal("window", new Proxy(window, {
    get(target, property) {
      return property === "location" ? { assign: mocks.assign } : Reflect.get(target, property, target)
    },
  }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("SignOutSettings — navigation conservée par la source", () => {
  it("présente la session et une seule commande nommée", () => {
    const { container } = render(tree())

    expect(screen.getByRole("region", { name: t("settings.session") })).toHaveAttribute("id", "session")
    expect(screen.getByRole("heading", { level: 2, name: t("settings.session") })).toBeInTheDocument()
    expect(screen.getByText(t("settings.sessionLead"))).toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("settings.signOutEverywhere") })).toBeEnabled()
    expect(screen.getAllByRole("button")).toHaveLength(1)
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it.each([
    { locale: "fr" as const, pendingLabel: "Déconnexion…" },
    { locale: "en" as const, pendingLabel: "Signing out…" },
  ])("bloque deux gestes dans le même rendu et traduit l'attente en $locale", async ({ locale, pendingLabel }) => {
    let finish: () => void = () => {}
    const pending = new Promise<void>((resolve) => { finish = resolve })
    mocks.signOut.mockReturnValueOnce(pending)
    render(tree(locale))
    const button = screen.getByRole("button", { name: getFixedT(locale)("settings.signOutEverywhere") })

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(mocks.signOut).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: pendingLabel })).toBeDisabled()
    expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "true")
    expect(mocks.assign).not.toHaveBeenCalled()

    await act(async () => { finish(); await pending })
    expect(screen.getByRole("button", { name: pendingLabel })).toBeDisabled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("ne navigue pas lui-même après la résolution de la source moteur", async () => {
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("settings.signOutEverywhere") })) })

    expect(mocks.signOut).toHaveBeenCalledOnce()
    expect(mocks.assign).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("préserve la destination du moteur signalant une révocation incomplète", async () => {
    const destination = routes.enterAfterSignOut(true)
    mocks.signOut.mockImplementationOnce(async () => { window.location.assign(destination) })
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("settings.signOutEverywhere") })) })

    expect(mocks.assign).toHaveBeenCalledExactlyOnceWith(destination)
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it("attend la déconnexion de démonstration puis recharge l'accueil une seule fois", async () => {
    mocks.kind = "demo"
    let finish: () => void = () => {}
    const pending = new Promise<void>((resolve) => { finish = resolve })
    mocks.signOut.mockReturnValueOnce(pending)
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("settings.signOutEverywhere") }))

    expect(mocks.signOut).toHaveBeenCalledOnce()
    expect(mocks.assign).not.toHaveBeenCalled()
    await act(async () => { finish(); await pending })
    expect(mocks.assign).toHaveBeenCalledExactlyOnceWith(routes.home())
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })

  it.each(["engine", "demo"] as const)("rend un échec générique et permet une nouvelle tentative en mode %s", async (kind) => {
    mocks.kind = kind
    mocks.signOut.mockRejectedValueOnce(new Error("diagnostic privé de la révocation"))
    render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("settings.signOutEverywhere") }))

    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.unknown"))
    expect(screen.queryByText(/diagnostic privé/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("settings.signOutEverywhere") })).toBeEnabled()
    expect(screen.getByRole("region")).toHaveAttribute("aria-busy", "false")
    expect(mocks.assign).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: t("settings.signOutEverywhere") }))
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    if (kind === "demo") await waitFor(() => expect(mocks.assign).toHaveBeenCalledExactlyOnceWith(routes.home()))
    else expect(mocks.assign).not.toHaveBeenCalled()
  })
})

describe("SignOutSettings — la sortie partout vide les réserves du script de fond (MO-05)", () => {
  function reserves(names: string[]) {
    const kept = [...names]
    const order: string[] = []
    const remove = vi.fn(async (name: string) => {
      order.push(`purge:${name}`)
      kept.splice(kept.indexOf(name), 1)
      return true
    })
    vi.stubGlobal("caches", { keys: async () => [...kept], delete: remove })
    return { kept, order, remove }
  }

  it.each(["engine", "demo"] as const)("efface ses seules réserves avant la sortie de la source (%s)", async (kind) => {
    mocks.kind = kind
    const storage = reserves([offlineCacheName(), `${OFFLINE_CACHE_PREFIX}0`, "autre-reserve"])
    mocks.signOut.mockImplementationOnce(async () => { storage.order.push("sortie") })
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("settings.signOutEverywhere") })) })

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce())
    expect(storage.kept).toEqual(["autre-reserve"])
    expect(storage.order.at(-1)).toBe("sortie")
    expect(storage.order.filter((step) => step.startsWith("purge:"))).toHaveLength(2)
  })

  it("une purge en échec n'empêche pas la sortie", async () => {
    vi.stubGlobal("caches", { keys: async () => { throw new Error("stockage indisponible") }, delete: vi.fn() })
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("settings.signOutEverywhere") })) })

    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledOnce())
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
