/**
 * La source de données de l'application (`NEXT_PUBLIC_DIASPORALE_DATA_SOURCE`) :
 * `engine` (le moteur ANTSIA) ou `demo` (données fictives, dans ce navigateur).
 * Une seule lecture pour tout le site : le choix des fournisseurs (`env.ts`), la
 * sonde de santé et la garde de construction s'appuient sur ces deux fonctions.
 * Aucun import de Node ici : le module est aussi lu dans le navigateur.
 */
export type DataSourceKind = "demo" | "engine"

/** Le nom de la variable, pour les messages de la garde de construction. */
export const DATA_SOURCE_VARIABLE = "NEXT_PUBLIC_DIASPORALE_DATA_SOURCE"

/** La source déclarée, ou `null` si la variable est absente ou d'une valeur inconnue. */
export function parseDataSource(raw: string | undefined): DataSourceKind | null {
  return raw === "engine" || raw === "demo" ? raw : null
}

/**
 * La source réellement servie. Sans déclaration, la démonstration : ce repli ne
 * vaut qu'en développement, car toute construction de production doit déclarer
 * sa source (garde `production-build-guard.ts`, appelée par `next.config.ts`).
 */
export function resolveDataSource(raw: string | undefined): DataSourceKind {
  return parseDataSource(raw) ?? "demo"
}
