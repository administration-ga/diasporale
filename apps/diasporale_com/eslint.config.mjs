// Config ESLint PROVISOIRE (avant PD0), identique à celle de @diasporale/features ; au câblage :
// `export { default } from "@antia/eslint-config/next"` (preset partagé du moteur).
import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

const crossProductRestrictions = {
  paths: [{ name: "react-markdown", message: "Import direct interdit (XSS) : rendu Markdown assaini du moteur." }],
  patterns: [
    { group: ["@workspace/*"], message: "Aucun paquet du socle administration.ga (étanchéité)." },
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
    rules: {
      "no-restricted-imports": ["error", crossProductRestrictions],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "jsx-a11y/no-autofocus": "error",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "coverage/**", "next-env.d.ts"]),
])
