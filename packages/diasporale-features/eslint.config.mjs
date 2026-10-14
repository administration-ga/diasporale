// Config ESLint PROVISOIRE (avant PD0) — calquée sur @antia/eslint-config/next du moteur,
// qui la remplacera au câblage : preset Next officiel (core-web-vitals + typescript, jsx-a11y
// inclus) + interdits d'imports inter-produits (étanchéité, règle 4 de duplication).
import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export const crossProductRestrictions = {
  paths: [
    {
      name: "react-markdown",
      message: "Import direct interdit (XSS) : passer par le rendu Markdown assaini du moteur.",
    },
  ],
  patterns: [
    {
      group: ["@workspace/*"],
      message: "Aucun paquet du socle administration.ga : on copie le code, on ne l'importe pas.",
    },
    {
      group: ["**/ADMINISTRATION_GA/**", "**/GABON_DIPLOMATIE/**", "**/gabon-diplomatie/**", "**/_generated/**"],
      message: "Aucun import d'un autre dépôt du programme ni d'un _generated étranger (étanchéité).",
    },
  ],
}

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: { next: { rootDir: ["../../apps/diasporale_com/"] } },
    rules: {
      "no-restricted-imports": ["error", crossProductRestrictions],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@next/next/no-html-link-for-pages": "off",
      "jsx-a11y/no-autofocus": "error",
      // Mêmes réglages que le preset du moteur (socle « pipeline vert ») : l'heure
      // courante sert au temps relatif, et un effet peut synchroniser un champ.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores(["coverage/**", "dist/**"]),
])
