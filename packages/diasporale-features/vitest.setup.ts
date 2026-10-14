import "@testing-library/jest-dom/vitest"

import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

afterEach(() => {
  cleanup()
  // Le fournisseur de démonstration persiste dans le stockage local : chaque
  // test part d'un état vierge.
  // (Node expose parfois son propre `localStorage` sans méthodes : on vérifie avant d'appeler.)
  if (typeof window !== "undefined" && typeof window.localStorage?.clear === "function") window.localStorage.clear()
})
