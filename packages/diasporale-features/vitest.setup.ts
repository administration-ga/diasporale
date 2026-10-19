import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

/**
 * Node 25 expose un `localStorage` expérimental sans méthodes, qui masque celui de jsdom :
 * on pose alors un stockage en mémoire conforme (rien ne change sous Node 22).
 */
function memoryStorage(): Storage {
  const entries = new Map<string, string>()
  return {
    get length() {
      return entries.size
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => {
      entries.delete(key)
    },
    setItem: (key, value) => {
      entries.set(key, String(value))
    },
  }
}
for (const target of new Set<object>([globalThis, ...(typeof window === "undefined" ? [] : [window])])) {
  const current = (target as { localStorage?: Partial<Storage> }).localStorage
  if (current !== undefined && typeof current.clear !== "function") {
    Object.defineProperty(target, "localStorage", { configurable: true, value: memoryStorage() })
  }
}

afterEach(() => {
  cleanup()
  // Le fournisseur de démonstration persiste dans le stockage local : chaque
  // test part d'un état vierge.
  // (Node expose parfois son propre `localStorage` sans méthodes : on vérifie avant d'appeler.)
  if (typeof window !== "undefined" && typeof window.localStorage?.clear === "function") window.localStorage.clear()
})
