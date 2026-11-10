// @vitest-environment jsdom
import { getFixedT, type Locale } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NETWORK_RESTORED_NOTICE_MS, NetworkStatusNotice } from "./network-status"

/** MO-05 : la coque suit l'état du réseau et le dit, sans masquer ce qui est déjà affiché. */

let online = true

function tree(locale: Locale = "fr") {
  return (
    <I18nProvider locale={locale}>
      <NetworkStatusNotice />
      <article>Publication déjà affichée</article>
    </I18nProvider>
  )
}

function go(state: "online" | "offline") {
  online = state === "online"
  act(() => { window.dispatchEvent(new Event(state)) })
}

beforeEach(() => {
  online = true
  vi.spyOn(window.navigator, "onLine", "get").mockImplementation(() => online)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("état du réseau dans la coque", () => {
  it("en ligne, rien ne s'affiche ; la région d'annonce est déjà là, vide", () => {
    const { container } = render(tree())
    expect(screen.getByRole("status").textContent).toBe("")
    expect(container.querySelector("[data-network-state]")).toBeNull()
  })

  it.each(["fr", "en"] as const)("hors ligne, l'annonce et l'avis le disent en %s, et le contenu reste", (locale) => {
    const { container } = render(tree(locale))
    go("offline")
    const text = getFixedT(locale)("installableApp.network.offline")
    // Texte exact (espaces insécables comprises) : la normalisation de `toHaveTextContent` les écrase.
    expect(screen.getByRole("status").textContent).toBe(text)
    const notice = container.querySelector("[data-network-state='offline']")
    expect(notice?.textContent).toBe(text)
    // L'avis visible n'est pas lu une seconde fois.
    expect(notice).toHaveAttribute("aria-hidden", "true")
    expect(screen.getByText("Publication déjà affichée")).toBeVisible()
  })

  it("au retour du réseau, le dit un instant puis s'efface", () => {
    vi.useFakeTimers()
    const { container } = render(tree())
    go("offline")
    go("online")
    expect(screen.getByRole("status").textContent).toBe(getFixedT("fr")("installableApp.network.restored"))
    expect(container.querySelector("[data-network-state='restored']")).not.toBeNull()
    act(() => { vi.advanceTimersByTime(NETWORK_RESTORED_NOTICE_MS) })
    expect(screen.getByRole("status").textContent).toBe("")
    expect(container.querySelector("[data-network-state]")).toBeNull()
  })

  it("une nouvelle coupure pendant l'avis de retour reprend l'avis hors ligne", () => {
    vi.useFakeTimers()
    render(tree())
    go("offline")
    go("online")
    go("offline")
    act(() => { vi.advanceTimersByTime(NETWORK_RESTORED_NOTICE_MS) })
    expect(screen.getByRole("status").textContent).toBe(getFixedT("fr")("installableApp.network.offline"))
  })
})
