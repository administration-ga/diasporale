import { defineConfig } from "vitest/config"

/**
 * Tests du paquet : composants montés en jsdom (Testing Library), cliquets qui
 * relisent les sources (couleurs, chaînes, jetons) en environnement node via
 * `// @vitest-environment node` en tête de fichier.
 */
export default defineConfig({
  test: {
    name: "diasporale-features",
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
})
