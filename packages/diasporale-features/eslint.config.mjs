// Preset React partagé du moteur (@antia/eslint-config/react : Next officiel, jsx-a11y,
// imports inter-produits interdits), resserré pour DIASPORALE : `any` et l'autofocus
// sont des erreurs, pas des avertissements.
import react from "@antia/eslint-config/react"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  ...react,
  {
    settings: { next: { rootDir: ["../../apps/diasporale_com/"] } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "jsx-a11y/no-autofocus": "error",
    },
  },
  globalIgnores(["coverage/**", "dist/**"]),
])
