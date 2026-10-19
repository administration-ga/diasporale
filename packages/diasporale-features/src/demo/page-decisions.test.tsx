// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { demoPageAdminContext } from "./page-admin"
import { createDemoPageDecisions } from "./page-decisions"
import { createDemoSeed, type DemoState } from "./state"
import { DemoStore } from "./store"

/**
 * Décisions de page de démonstration (P16 · G9) : aucune décision prise, liste vide
 * pour un signataire vivant, `null` pour toute autre personne, recours introuvable.
 */
const NOW = Date.UTC(2026, 9, 19, 12)
const LYON = "page-asso-lyon"
const SIGNATORY = "p-steeve"
const OUTSIDER = "p-prisca"
const REASON = "Le contexte a été mal lu."

function setup(viewer: string | null) {
  const state: DemoState = { ...createDemoSeed(NOW), session: { personId: viewer } }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
  return { store, decisions: createDemoPageDecisions(store, demoPageAdminContext(store)) }
}

afterEach(cleanup)

describe("Décisions de page de démonstration", () => {
  it("un signataire vivant lit une liste vide : la démonstration ne prend aucune décision", () => {
    const { store, decisions } = setup(SIGNATORY)
    expect(demoPageAdminContext(store).isSignatory(LYON, SIGNATORY)).toBe(true)
    const { result } = renderHook(() => decisions.useDecisions({ pageId: LYON, cursor: null }))
    expect(result.current).toEqual({ status: "ready", data: { items: [], continueCursor: null, isDone: true } })
  })

  it("une personne qui ne signe pas pour la page lit null, comme une page introuvable", () => {
    const { decisions } = setup(OUTSIDER)
    expect(renderHook(() => decisions.useDecisions({ pageId: LYON, cursor: null })).result.current).toEqual({ status: "ready", data: null })
    expect(renderHook(() => decisions.useDecisions({ pageId: "page-inconnue", cursor: null })).result.current).toEqual({ status: "ready", data: null })
  })

  it("sans session : not_signed_in ; un recours rend not_found, comme un dossier introuvable du moteur", async () => {
    const anonymous = setup(null)
    expect(renderHook(() => anonymous.decisions.useDecisions({ pageId: LYON, cursor: null })).result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(await anonymous.decisions.fileAppeal({ pageId: LYON, reportId: "report-1", reason: REASON })).toEqual({ ok: false, code: "not_signed_in" })
    const signed = setup(SIGNATORY)
    expect(await signed.decisions.fileAppeal({ pageId: LYON, reportId: "report-1", reason: REASON })).toEqual({ ok: false, code: "not_found" })
  })
})
