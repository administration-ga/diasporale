import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Les sources que relisent les cliquets : l'application ET le paquet de
 * surfaces `@diasporale/features` (le produit, sans ses tests ni ses locales).
 */
export const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url))

const ROOTS = ["apps/diasporale_com/src", "packages/diasporale-features/src"] as const

export interface SourceFile {
  /** Chemin relatif au dépôt, pour des messages d'échec lisibles. */
  readonly path: string
  readonly text: string
}

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const full = join(directory, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

export function productSources(extensions: readonly string[]): SourceFile[] {
  return ROOTS.flatMap((root) => walk(join(REPO_ROOT, root)))
    .filter((file) => extensions.some((extension) => file.endsWith(extension)))
    .filter((file) => !/\.test\.tsx?$|test-utils\.tsx?$|\/ratchets\//.test(file))
    .map((file) => ({ path: relative(REPO_ROOT, file), text: readFileSync(file, "utf8") }))
}

/** Une locale du paquet de surfaces, relue telle qu'elle est sur le disque. */
export function readLocale(locale: "fr" | "en"): unknown {
  return JSON.parse(readFileSync(join(REPO_ROOT, `packages/diasporale-features/src/i18n/locales/${locale}/diasporale.json`), "utf8"))
}
