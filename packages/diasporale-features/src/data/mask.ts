/**
 * L'adresse d'un compte léger, MASQUÉE pour l'affichage (« a…@exemple.test »,
 * « …1234 ») : l'écran rappelle la porte d'entrée sans jamais exposer une
 * coordonnée (invariant 6). Partagé par la démonstration et le moteur.
 */
export function maskDestination(kind: "email" | "phone", value: string): string {
  if (kind === "phone") return `…${value.replace(/\D/g, "").slice(-4)}`
  const [local = "", domain = ""] = value.split("@")
  return `${local.slice(0, 1)}…@${domain}`
}
