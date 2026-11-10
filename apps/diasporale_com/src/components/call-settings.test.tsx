// @vitest-environment jsdom
import {
  DataSourceProvider,
  DEFAULT_CALL_SETTINGS,
  type ActionResult,
  type CallSettingsCapability,
  type CallSettingsView,
  type DiasporaleDataSource,
  type Loadable,
  type MembershipView,
} from "@diasporale/features/data"
import { createDemoDataSource, createDemoSeed, DEMO_STORAGE_KEY, DemoStore, type DemoState } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { CallSettings } from "./call-settings"

const mocks = vi.hoisted(() => ({ callsOpen: false, success: vi.fn(), error: vi.fn() }))
vi.mock("@/lib/calls", () => ({ callsAreOpen: () => mocks.callsOpen }))
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }))

const t = getFixedT("fr")
const HOUR = 60 * 60 * 1000
const NOW = Date.UTC(2026, 10, 10, 12)
/** Le texte tel que Testing Library le lit dans le DOM (espaces insécables normalisées). */
const text = (key: string, options?: Record<string, unknown>) => String(t(key, options)).replace(/\s+/g, " ")

const membership = { personId: "person_awa", handle: "awa.demo", displayName: "Awa OGOOUÉ" } as MembershipView

function fakeCapability(initial: Loadable<CallSettingsView> = { status: "ready", data: DEFAULT_CALL_SETTINGS }) {
  const state = { current: initial }
  const capability = {
    useMine: vi.fn<CallSettingsCapability["useMine"]>(() => state.current),
    update: vi.fn<CallSettingsCapability["update"]>().mockResolvedValue({ ok: true, value: null }),
    setDoNotDisturb: vi.fn<CallSettingsCapability["setDoNotDisturb"]>(async (_personId, until) => ({ ok: true, value: { dndUntil: until } }) as ActionResult<{ dndUntil: number | null }>),
  } satisfies CallSettingsCapability
  return { capability, state }
}

function mount(capability: CallSettingsCapability | undefined, kind: DiasporaleDataSource["kind"] = "engine", locale: "fr" | "en" = "fr") {
  const source = { kind, callSettings: capability } as unknown as DiasporaleDataSource
  return render(
    <I18nProvider locale={locale}>
      <DataSourceProvider source={source}>
        <CallSettings membership={membership} />
      </DataSourceProvider>
    </I18nProvider>,
  )
}

const region = () => within(screen.getByRole("region", { name: t("settings.calls.title") }))
const save = () => region().getByRole("button", { name: t("common.save") })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.callsOpen = false
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("« Messages et appels » — ce que la rubrique dit (IM-02)", () => {
  it("dit que ces réglages valent aussi dans ANTSIA et, appels fermés, qu'aucun appel n'est proposé depuis un profil", () => {
    mount(fakeCapability().capability)
    expect(region().getByText(text("settings.calls.lead"))).toBeInTheDocument()
    expect(t("settings.calls.lead")).toMatch(/ANTSIA/)
    expect(region().getByText(text("settings.calls.notOffered"))).toBeInTheDocument()
    expect(region().queryByText(text("settings.calls.demoNotice"))).toBeNull()
  })

  it("appels ouverts, la mise en garde disparaît ; aucun bouton d'appel n'est jamais proposé ici", () => {
    mocks.callsOpen = true
    mount(fakeCapability().capability)
    expect(region().queryByText(text("settings.calls.notOffered"))).toBeNull()
    expect(region().queryByRole("button", { name: /appeler/i })).toBeNull()
  })

  it("en démonstration, dit que les réglages sont fictifs", () => {
    mount(fakeCapability().capability, "demo")
    expect(region().getByText(text("settings.calls.demoNotice"))).toBeInTheDocument()
  })

  it("sans la capacité, la rubrique n'existe pas", () => {
    mount(undefined)
    expect(screen.queryByRole("region", { name: t("settings.calls.title") })).toBeNull()
  })

  it("montre les réglages du serveur, et seul un choix modifié ouvre « Enregistrer »", () => {
    const { capability } = fakeCapability({ status: "ready", data: { ...DEFAULT_CALL_SETTINGS, outsideRelationsCalls: "silent", sharePresence: false } })
    mount(capability)
    expect(region().getByRole("radio", { name: t("settings.calls.outside.silent") })).toBeChecked()
    expect(region().getByRole("switch", { name: t("settings.calls.presence") })).not.toBeChecked()
    expect(region().getByRole("switch", { name: t("settings.calls.voicemail") })).toBeChecked()
    expect(save()).toBeDisabled()
    expect(capability.useMine).toHaveBeenCalledWith(membership.personId)
  })

  it("dit le chargement, puis un refus du serveur dans sa phrase fermée", () => {
    const { capability, state } = fakeCapability({ status: "loading" })
    const view = mount(capability)
    expect(region().queryByRole("switch")).toBeNull()
    state.current = { status: "error", code: "not_signed_in" }
    view.rerender(
      <I18nProvider locale="fr">
        <DataSourceProvider source={{ kind: "engine", callSettings: capability } as unknown as DiasporaleDataSource}>
          <CallSettings membership={membership} />
        </DataSourceProvider>
      </I18nProvider>,
    )
    expect(region().getByRole("alert")).toHaveTextContent(text("errors.not_signed_in"))
  })
})

describe("« Messages et appels » — un interrupteur, un appel à l'adaptateur", () => {
  it.each([
    ["messagerie vocale", "settings.calls.voicemail", { voicemailEnabled: false }],
    ["présence", "settings.calls.presence", { sharePresence: false }],
    ["double appel", "settings.calls.callWaiting", { callWaiting: false }],
  ] as const)("« %s » : basculé puis enregistré, seul ce réglage part à l'adaptateur", async (_label, key, patch) => {
    const user = userEvent.setup()
    const { capability } = fakeCapability()
    mount(capability)
    await user.click(region().getByRole("switch", { name: t(key) }))
    await user.click(save())
    await waitFor(() => expect(capability.update).toHaveBeenCalledOnce())
    expect(capability.update).toHaveBeenCalledWith(membership.personId, patch)
    expect(mocks.success).toHaveBeenCalledWith(t("settings.saved"))
  })

  it("« qui peut vous appeler » : « Mes relations seulement » part à l'adaptateur", async () => {
    const user = userEvent.setup()
    const { capability } = fakeCapability()
    mount(capability)
    await user.click(region().getByRole("radio", { name: t("settings.calls.outside.silent") }))
    await user.click(save())
    await waitFor(() => expect(capability.update).toHaveBeenCalledWith(membership.personId, { outsideRelationsCalls: "silent" }))
  })

  it("un refus du moteur se dit, sans annoncer d'enregistrement", async () => {
    const user = userEvent.setup()
    const { capability } = fakeCapability()
    capability.update.mockResolvedValue({ ok: false, code: "rate_limited" })
    mount(capability)
    await user.click(region().getByRole("switch", { name: t("settings.calls.callWaiting") }))
    await user.click(save())
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(t("errors.rate_limited")))
    expect(mocks.success).not.toHaveBeenCalled()
    // Le choix reste à enregistrer.
    expect(save()).toBeEnabled()
  })
})

describe("« Messages et appels » — « Ne pas déranger »", () => {
  it("pose un silence de la durée choisie, calculée au geste", async () => {
    const user = userEvent.setup()
    vi.spyOn(Date, "now").mockReturnValue(NOW)
    const { capability } = fakeCapability()
    mount(capability)
    await user.selectOptions(region().getByRole("combobox", { name: t("settings.calls.dnd.duration") }), "eightHours")
    await user.click(region().getByRole("button", { name: t("settings.calls.dnd.enable") }))
    await waitFor(() => expect(capability.setDoNotDisturb).toHaveBeenCalledWith(membership.personId, NOW + 8 * HOUR))
    expect(mocks.success).toHaveBeenCalledWith(t("settings.calls.dnd.enabled"))
  })

  it("un silence en cours se lit avec son échéance et se lève d'un geste", async () => {
    const user = userEvent.setup()
    const { capability } = fakeCapability({ status: "ready", data: { ...DEFAULT_CALL_SETTINGS, dndUntil: NOW + HOUR } })
    mount(capability)
    expect(region().getByRole("status")).toBeInTheDocument()
    expect(region().queryByRole("button", { name: t("settings.calls.dnd.enable") })).toBeNull()
    await user.click(region().getByRole("button", { name: t("settings.calls.dnd.disable") }))
    await waitFor(() => expect(capability.setDoNotDisturb).toHaveBeenCalledWith(membership.personId, null))
    expect(mocks.success).toHaveBeenCalledWith(t("settings.calls.dnd.disabled"))
  })

  it("un refus d'horloge se dit dans sa phrase fermée", async () => {
    const user = userEvent.setup()
    const { capability } = fakeCapability()
    capability.setDoNotDisturb.mockResolvedValue({ ok: false, code: "call_dnd_too_long" })
    mount(capability)
    await user.click(region().getByRole("button", { name: t("settings.calls.dnd.enable") }))
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(t("errors.call_dnd_too_long")))
  })

  it("parle anglais", () => {
    mount(fakeCapability().capability, "engine", "en")
    const english = within(screen.getByRole("region", { name: "Messages and calls" }))
    expect(english.getByRole("switch", { name: "Voicemail" })).toBeInTheDocument()
    expect(english.getByRole("radio", { name: "My connections only" })).toBeInTheDocument()
    expect(english.getByRole("button", { name: "Turn on" })).toBeInTheDocument()
  })
})

describe("« Messages et appels » — avec le fournisseur de démonstration", () => {
  it("un réglage enregistré est relu par la démonstration, pour le seul compte de la session", async () => {
    const user = userEvent.setup()
    const state: DemoState = { ...createDemoSeed(NOW), session: { personId: "p-prisca" } }
    const stored = new Map([[DEMO_STORAGE_KEY, JSON.stringify(state)]])
    const store = new DemoStore({ getItem: (key) => stored.get(key) ?? null, setItem: (key, value) => { stored.set(key, value) }, removeItem: (key) => { stored.delete(key) } }, () => NOW, 0)
    const source = createDemoDataSource(store)
    render(
      <I18nProvider locale="fr">
        <DataSourceProvider source={source}>
          <CallSettings membership={{ ...membership, personId: "p-prisca" }} />
        </DataSourceProvider>
      </I18nProvider>,
    )
    expect(region().getByText(text("settings.calls.demoNotice"))).toBeInTheDocument()
    await user.click(region().getByRole("switch", { name: t("settings.calls.callWaiting") }))
    await user.click(save())
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(t("settings.saved")))
    expect(region().getByRole("switch", { name: t("settings.calls.callWaiting") })).not.toBeChecked()
    expect(save()).toBeDisabled()
    // Un autre compte de démonstration ne se règle pas depuis cette session.
    expect(await source.callSettings?.update("p-nadia", { callWaiting: false })).toEqual({ ok: false, code: "not_found" })
  })
})
