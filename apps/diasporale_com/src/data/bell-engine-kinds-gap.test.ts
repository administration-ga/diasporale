// @vitest-environment node
import { existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { COMMERCE_NOTIFICATION_KINDS } from "@antsia/social-domain/commerceNotifications"
import { NOTIFICATION_KINDS as ENGINE_COMMON_KINDS } from "@antsia/social-domain/notifications"
import { NOTIFICATION_KINDS } from "@diasporale/features/data"
import { describe, expect, it } from "vitest"

/**
 * L'écart entre les genres d'avis du MOTEUR et ceux que DIASPORALE nomme (NP-04) — mesuré, JAMAIS
 * bloquant : un genre ajouté au moteur ne doit pas faire échouer la vérification commune avant que
 * notre ligne puisse exister, et la cloche a un repli sûr (« Nouvelle activité »). Ce test écrit la
 * liste dans sa sortie ; le test bloquant est celui de notre propre liste
 * (`packages/diasporale-features/src/components/notification-bell-completeness.test.tsx`).
 *
 * Les genres du moteur : ceux du domaine commun et du commerce (listes du paquet de domaine), puis
 * les listes que `notificationKindValidator` assemble dans la table des avis, lues comme TEXTE (aucun
 * module du backend n'est importé à l'exécution).
 */
const ENGINE_TABLES = fileURLToPath(new URL("../../../../../ANTSIA/convex/modules/notifications/tables.ts", import.meta.url))

/** Les listes que le domaine fournit déjà à l'exécution, par le nom que la table leur donne. */
const DOMAIN_LISTS: Readonly<Record<string, readonly string[]>> = {
  NOTIFICATION_KINDS: ENGINE_COMMON_KINDS,
  COMMERCE_NOTIFICATION_KINDS,
}

/** Les chaînes d'une liste `export const NOM = [ … ] as const` d'un source, ou `null` si elle n'y est pas. */
export function declaredList(source: string, name: string): string[] | null {
  const found = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\] as const`).exec(source)
  if (!found) return null
  return [...(found[1] ?? "").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").matchAll(/"([a-z][a-z0-9_]*)"/g)].map((match) => match[1]!)
}

/** Les noms des listes que le validateur des genres assemble (`literals([...A, ...B] as const)`). */
export function validatorLists(source: string): string[] | null {
  const found = /notificationKindValidator = literals\(\[([^\]]*)\]/.exec(source)
  if (!found) return null
  return [...(found[1] ?? "").matchAll(/\.\.\.([A-Z][A-Z0-9_]*)/g)].map((match) => match[1]!)
}

/** Les genres du moteur, et ce qui n'a pas pu être lu (dit dans la sortie, jamais bloquant). */
export function engineKinds(source: string | null): { readonly kinds: readonly string[]; readonly unread: readonly string[] } {
  const kinds = new Set<string>([...ENGINE_COMMON_KINDS, ...COMMERCE_NOTIFICATION_KINDS])
  const unread: string[] = []
  if (source === null) return { kinds: [...kinds], unread: ["table des avis du moteur introuvable"] }
  const lists = validatorLists(source)
  if (lists === null) return { kinds: [...kinds], unread: ["validateur des genres illisible"] }
  for (const name of lists) {
    const list = DOMAIN_LISTS[name] ?? declaredList(source, name)
    if (list === null) unread.push(name)
    else for (const kind of list) kinds.add(kind)
  }
  return { kinds: [...kinds], unread }
}

describe("cloche — écart avec les genres du moteur (mesuré, non bloquant)", () => {
  it("écrit les genres du moteur que DIASPORALE ne nomme pas, sans jamais échouer", () => {
    const source = existsSync(ENGINE_TABLES) ? readFileSync(ENGINE_TABLES, "utf8") : null
    const { kinds, unread } = engineKinds(source)
    const ours = new Set<string>(NOTIFICATION_KINDS)
    const missing = kinds.filter((kind) => !ours.has(kind)).sort()
    console.info(`genres du moteur non nommés par DIASPORALE (${missing.length}, dits « Nouvelle activité ») : ${missing.length > 0 ? missing.join(", ") : "aucun"}`)
    if (unread.length > 0) console.info(`listes du moteur non lues : ${unread.join(", ")}`)
    // Mesure seulement : aucune assertion sur l'écart lui-même.
    expect(missing.length).toBeGreaterThanOrEqual(0)
  })
})

describe("cloche — lecture des listes du moteur (outil de la mesure)", () => {
  const SAMPLE = [
    "export const DIASPORA_SERVICE_NOTIFICATION_KINDS = [",
    "  /** Équipe de la page : « une demande » arrivée. */",
    "  \"service_request_received\",",
    "  // commentaire \"pas_un_genre\"",
    "  \"service_review_replied\",",
    "] as const",
    "export const notificationKindValidator = literals([...NOTIFICATION_KINDS, ...DIASPORA_SERVICE_NOTIFICATION_KINDS, ...AUTRE_LISTE] as const)",
  ].join("\n")

  it("lit une liste déclarée, sans ses commentaires", () => {
    expect(declaredList(SAMPLE, "DIASPORA_SERVICE_NOTIFICATION_KINDS")).toEqual(["service_request_received", "service_review_replied"])
    expect(declaredList(SAMPLE, "ABSENTE")).toBeNull()
  })

  it("assemble les listes du validateur et dit celles qu'il n'a pas pu lire", () => {
    expect(validatorLists(SAMPLE)).toEqual(["NOTIFICATION_KINDS", "DIASPORA_SERVICE_NOTIFICATION_KINDS", "AUTRE_LISTE"])
    const { kinds, unread } = engineKinds(SAMPLE)
    expect(kinds).toContain("service_review_replied")
    expect(kinds).toContain("post_reaction")
    expect(unread).toEqual(["AUTRE_LISTE"])
    expect(engineKinds(null).unread).toEqual(["table des avis du moteur introuvable"])
  })
})
