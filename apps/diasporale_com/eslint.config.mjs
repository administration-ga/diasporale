// Preset Next partagé du moteur (@antsia/eslint-config/next : Next officiel, jsx-a11y,
// imports inter-produits interdits), resserré pour DIASPORALE : `any` et l'autofocus
// sont des erreurs, pas des avertissements.
import next from "@antsia/eslint-config/next"
import { defineConfig } from "eslint/config"

export default defineConfig([
  ...next,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "jsx-a11y/no-autofocus": "error",
    },
  },
])
