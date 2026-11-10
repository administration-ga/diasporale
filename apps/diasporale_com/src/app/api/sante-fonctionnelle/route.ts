import { currentFunctionalHealth, healthHttpStatus } from "@/lib/functional-health"

// Jamais de rendu statique : une santé figée à la construction décrit la machine de
// construction, pas le service qui répond.
export const dynamic = "force-dynamic"

/**
 * Sonde de santé fonctionnelle (LX-01) : état, version construite, source de données
 * servie et, avec la source `engine`, moteur joint. 503 si le moteur manque ou ne
 * répond pas. Ni adresse de déploiement, ni secret, ni donnée personnelle.
 */
export async function GET() {
  const report = await currentFunctionalHealth()
  return Response.json(report, { status: healthHttpStatus(report), headers: { "Cache-Control": "no-store" } })
}
