import { createEngineNextConfig } from "@antsia/api/next-config"
import type { NextConfig } from "next"
import { PHASE_PRODUCTION_BUILD } from "next/constants"

import { serializeInstallPalette } from "./src/lib/install-palette"
import { readInstallPalette } from "./src/lib/install-palette-files"
import { assertProductionBuild } from "./src/lib/production-build-guard"

/**
 * Configuration Next.js 16 de diasporale.com — celle du moteur ANTSIA
 * (`@antsia/api/next-config`) : racine ECOSYSTEMES, sortie standalone, paquets du
 * moteur en sources, en-têtes de sécurité et CSP dérivée du déploiement Convex
 * (lu dans `ANTSIA/.env.local` en développement, dans les ARG du Dockerfile en
 * production). Seuls les paquets et les réécritures propres à DIASPORALE sont ici.
 */
const engine = createEngineNextConfig({
  appDir: process.cwd(),
  transpilePackages: ["@diasporale/domain", "@diasporale/features"],
})

const config: NextConfig = {
  ...engine,
  env: {
    ...engine.env,
    // Application installable (MO-02, MO-05) : les couleurs du manifeste, des icônes et de la page
    // hors-ligne, LUES dans les jetons de la charte ici, une fois, puis inscrites dans le code
    // construit. Aucun fichier de charte n'est relu au service ; un jeton illisible fait échouer
    // la construction plutôt que d'inventer une couleur.
    DIASPORALE_CHARTE_PALETTE: serializeInstallPalette(readInstallPalette(process.cwd())),
  },
  async rewrites() {
    // `/@prenom.nom` (cahier §10.1) : un dossier `@…` est un emplacement parallèle
    // pour le routeur de Next ; l'adresse publique se réécrit vers `/profil/…`.
    return [
      { source: "/@:handle/albums/:albumId", destination: "/profil/:handle/albums/:albumId" },
      { source: "/@:handle", destination: "/profil/:handle" },
    ]
  },
}

/**
 * À la construction (`next build`), la garde de la source de données (LX-01) : une
 * construction sans source déclarée, ou qui servirait la démonstration sur un domaine
 * public, échoue ici au lieu de servir en silence les données fictives. Références
 * LITTÉRALES des variables (cliquet `deploy-catalog` du moteur).
 */
export default function diasporaleNextConfig(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD) {
    assertProductionBuild({
      dataSource: process.env.NEXT_PUBLIC_DIASPORALE_DATA_SOURCE,
      convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      buildSha: process.env.NEXT_PUBLIC_BUILD_SHA,
    })
  }
  return config
}
