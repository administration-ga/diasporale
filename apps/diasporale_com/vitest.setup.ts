import "@testing-library/jest-dom/vitest"

/**
 * jsdom n'implémente pas `ResizeObserver`, que Radix utilise pour mesurer ses
 * groupes de boutons radio : un observateur muet suffit aux tests d'écran.
 */
class SilentResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = SilentResizeObserver as unknown as typeof ResizeObserver
}
