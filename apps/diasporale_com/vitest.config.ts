import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Le backend du moteur ANTIA (même alias que tsconfig) : seul `_generated/api` s'importe à l'exécution.
      "@convex": fileURLToPath(new URL("../../../ANTIA/convex", import.meta.url)),
    },
  },
  test: {
    name: "diasporale-com",
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
})
