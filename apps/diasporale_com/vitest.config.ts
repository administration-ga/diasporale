import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Le backend du moteur ANTSIA (même alias que tsconfig) : seul `_generated/api` s'importe à l'exécution.
      "@convex": fileURLToPath(new URL("../../../ANTSIA/convex", import.meta.url)),
    },
  },
  test: {
    name: "diasporale-com",
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
    // 15 s par test au lieu des 5 s par défaut : la suite compte plus de cent fichiers jsdom, et sur une
    // machine chargée le premier test d'un fichier paie le chargement des modules (deux dépassements
    // constatés le 10/11 sur des tests qui passent en moins d'une seconde joués seuls).
    testTimeout: 15_000,
  },
})
