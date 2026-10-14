import type { NextConfig } from "next"

/**
 * Configuration Next.js 16 PROVISOIRE de diasporale.com (avant le câblage PD0).
 * Au câblage, elle devient `createEngineNextConfig({ appDir: process.cwd() })`
 * du moteur (`@antia/api/next-config` : racine ECOSYSTEMES, sortie standalone,
 * paquets du moteur en sources, CSP, déploiement Convex lu dans ANTIA/.env.local) ;
 * seules les réécritures propres à DIASPORALE restent ici.
 */
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
