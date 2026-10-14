/** Sonde de santé fonctionnelle (PD0) : l'application répond, sans dépendre du moteur. */
export function GET() {
  return Response.json({ service: "diasporale-com", status: "ok" }, { headers: { "Cache-Control": "no-store" } })
}
