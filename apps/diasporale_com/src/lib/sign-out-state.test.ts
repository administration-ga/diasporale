import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { clearDiasporaleDrafts } from "./sign-out-state"

const ERROR_MESSAGE = "Le nettoyage local des brouillons est incomplet."

function storage(initial: readonly string[]) {
  const entries = new Map(initial.map((key) => [key, `contenu privé de ${key}`]))
  const api = {
    get length() { return entries.size },
    key: vi.fn((index: number) => [...entries.keys()][index] ?? null),
    removeItem: vi.fn((key: string) => { entries.delete(key) }),
    getItem: vi.fn(() => { throw new Error("Les valeurs des brouillons ne doivent pas être lues") }),
  }
  return { api, entries }
}

beforeEach(() => {
  vi.stubGlobal("window", {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("clearDiasporaleDrafts — déconnexion locale ciblée", () => {
  it("retire les brouillons de plusieurs personnes dans les deux stockages en conservant toutes les autres clés", () => {
    const preferences = [
      "diasporale:demonstration:v1", "diasporale:hubs:recents", "diasporale:carte:statut:declaree",
      "theme", "diasporale:langue", "antsia:antia:auth", "autre-produit:brouillon:awa",
      "diasporale:brouillon", "diasporale:brouillon_autre:awa", "autre:diasporale:brouillon:awa",
    ]
    const local = storage(["diasporale:brouillon:awa", ...preferences, "diasporale:brouillon:prisca"])
    const session = storage(["diasporale:brouillon:awa", "session:autre", "diasporale:brouillon:steeve"])

    clearDiasporaleDrafts([local.api, session.api])

    expect([...local.entries.keys()]).toEqual(preferences)
    expect([...session.entries.keys()]).toEqual(["session:autre"])
    expect(local.api.getItem).not.toHaveBeenCalled()
    expect(session.api.getItem).not.toHaveBeenCalled()
  })

  it("utilise localStorage et sessionStorage du navigateur par défaut", () => {
    const local = storage(["diasporale:brouillon:awa", "theme"])
    const session = storage(["diasporale:brouillon:prisca", "langue"])
    vi.stubGlobal("window", { localStorage: local.api, sessionStorage: session.api })

    clearDiasporaleDrafts()

    expect([...local.entries.keys()]).toEqual(["theme"])
    expect([...session.entries.keys()]).toEqual(["langue"])
  })

  it("fige les clés avant suppression pour ne pas sauter des brouillons consécutifs", () => {
    const local = storage(["diasporale:brouillon:awa", "diasporale:brouillon:prisca", "diasporale:brouillon:steeve"])
    local.api.removeItem.mockImplementation((key) => {
      expect(local.api.key).toHaveBeenCalledTimes(3)
      local.entries.delete(key)
    })

    clearDiasporaleDrafts([local.api])

    expect(local.entries.size).toBe(0)
    expect(local.api.removeItem).toHaveBeenCalledTimes(3)
  })

  it("poursuit les autres clés et l'autre stockage quand un retrait échoue, puis lève une erreur sans contenu privé", () => {
    const failedKey = "diasporale:brouillon:personne-privee"
    const local = storage([failedKey, "diasporale:brouillon:prisca", "theme"])
    const session = storage(["diasporale:brouillon:steeve"])
    local.api.removeItem.mockImplementation((key) => {
      if (key === failedKey) throw new Error(`Erreur de stockage confidentielle : ${local.entries.get(key)}`)
      local.entries.delete(key)
    })
    let failure: unknown
    try { clearDiasporaleDrafts([local.api, session.api]) } catch (error) { failure = error }

    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe(ERROR_MESSAGE)
    expect((failure as Error).message).not.toContain(failedKey)
    expect((failure as Error).message).not.toContain("contenu privé")
    expect([...local.entries.keys()]).toEqual([failedKey, "theme"])
    expect(session.entries.size).toBe(0)
  })

  it("continue l'énumération quand une clé est illisible", () => {
    const local = storage(["diasporale:brouillon:awa", "diasporale:brouillon:prisca", "diasporale:brouillon:steeve"])
    const initial = [...local.entries.keys()]
    local.api.key.mockImplementation((index) => {
      if (index === 1) throw new Error("Accès refusé à une clé")
      return initial[index] ?? null
    })
    const session = storage(["diasporale:brouillon:autre"])

    expect(() => clearDiasporaleDrafts([local.api, session.api])).toThrow(ERROR_MESSAGE)

    expect([...local.entries.keys()]).toEqual(["diasporale:brouillon:prisca"])
    expect(session.entries.size).toBe(0)
  })

  it("traite l'autre stockage même quand le navigateur refuse l'accès au premier", () => {
    const session = storage(["diasporale:brouillon:awa", "theme"])
    vi.stubGlobal("window", { get localStorage() { throw new Error("Stockage bloqué") }, sessionStorage: session.api })

    expect(() => clearDiasporaleDrafts()).toThrow(ERROR_MESSAGE)

    expect([...session.entries.keys()]).toEqual(["theme"])
  })

  it("poursuit avec l'autre stockage quand la taille du premier est illisible", () => {
    const local = storage(["diasporale:brouillon:awa"])
    const session = storage(["diasporale:brouillon:prisca"])
    Object.defineProperty(local.api, "length", { get() { throw new Error("Énumération refusée") } })

    expect(() => clearDiasporaleDrafts([local.api, session.api])).toThrow(ERROR_MESSAGE)

    expect(session.entries.size).toBe(0)
    expect(local.api.removeItem).not.toHaveBeenCalled()
  })

  it("ne fait rien côté serveur, même avec un stockage injecté", () => {
    vi.stubGlobal("window", undefined)
    const local = storage(["diasporale:brouillon:awa"])

    expect(() => clearDiasporaleDrafts([local.api])).not.toThrow()
    expect(() => clearDiasporaleDrafts()).not.toThrow()

    expect(local.api.key).not.toHaveBeenCalled()
    expect(local.api.removeItem).not.toHaveBeenCalled()
    expect(local.api.getItem).not.toHaveBeenCalled()
  })
})
