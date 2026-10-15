import path from "node:path"

import type { NextConfig } from "next"

/**
 * Configuration Next.js 16 de diasporale.com, espace de travail externe du
 * moteur ANTIA (installation unique dans `ANTIA/`, PD0).
 *
 * Racine de résolution et de traçage = ECOSYSTEMES : les dépendances vivent
 * dans `ANTIA/node_modules`, hors du dossier de l'application, et l'image se
 * construit dans ce même contexte (Dockerfile à côté). Étape suivante de PD0 :
 * `createEngineNextConfig({ appDir: process.cwd() })` de `@antia/api/next-config`
 * (CSP et déploiement Convex communs) ; seules les réécritures propres à
 * DIASPORALE restent alors ici.
 */
const ecosystemsRoot = path.resolve(process.cwd(), "../../..")

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
]

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone",
  outputFileTracingRoot: ecosystemsRoot,
  turbopack: { root: ecosystemsRoot },
  transpilePackages: ["@diasporale/domain", "@diasporale/features"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }]
  },
  async rewrites() {
    // `/@prenom.nom` (cahier §10.1) : un dossier `@…` est un emplacement parallèle
    // pour le routeur de Next ; l'adresse publique se réécrit vers `/profil/…`.
    return [{ source: "/@:handle", destination: "/profil/:handle" }]
  },
}

export default config
