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
    // 15 s par test au lieu des 5 s par défaut, comme dans l'application : sous une machine très chargée,
    // un test jsdom qui passe en moins d'une seconde seul a dépassé le délai à l'assemblage du 10/11.
    testTimeout: 15_000,
  },
})
