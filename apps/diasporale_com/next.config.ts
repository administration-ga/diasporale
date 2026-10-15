import { createEngineNextConfig } from "@antia/api/next-config"
import type { NextConfig } from "next"

/**
 * Configuration Next.js 16 de diasporale.com — celle du moteur ANTIA
 * (`@antia/api/next-config`) : racine ECOSYSTEMES, sortie standalone, paquets du
 * moteur en sources, en-têtes de sécurité et CSP dérivée du déploiement Convex
 * (lu dans `ANTIA/.env.local` en développement, dans les ARG du Dockerfile en
 * production). Seuls les paquets et les réécritures propres à DIASPORALE sont ici.
 */
const engine = createEngineNextConfig({
  appDir: process.cwd(),
  transpilePackages: ["@diasporale/domain", "@diasporale/features"],
})

const config: NextConfig = {
  ...engine,
  async rewrites() {
    // `/@prenom.nom` (cahier §10.1) : un dossier `@…` est un emplacement parallèle
    // pour le routeur de Next ; l'adresse publique se réécrit vers `/profil/…`.
    return [{ source: "/@:handle", destination: "/profil/:handle" }]
  },
}

export default config
