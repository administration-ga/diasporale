import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"

import { mergeLocaleParts, type LocaleTree } from "@diasporale/features/i18n"

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

/**
 * Une locale du paquet de surfaces, relue telle qu'elle est sur le disque :
 * le fichier principal et TOUS les fragments de chantier du dossier, fusionnés
 * comme à l'exécution (une collision lève).
 */
export function readLocale(locale: "fr" | "en"): unknown {
  const directory = join(REPO_ROOT, `packages/diasporale-features/src/i18n/locales/${locale}`)
  const parts: Record<string, LocaleTree> = {}
  for (const name of readdirSync(directory).filter((file) => file.endsWith(".json")).sort()) {
    parts[name.slice(0, -".json".length)] = JSON.parse(readFileSync(join(directory, name), "utf8")) as LocaleTree
  }
  return mergeLocaleParts(parts)
}
