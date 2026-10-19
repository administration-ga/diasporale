/** Les brouillons du composeur, par personne ; aucune autre préférence locale. */
const DRAFT_KEY_PREFIX = "diasporale:brouillon:"

type DraftStorage = Pick<Storage, "length" | "key" | "removeItem">

/**
 * Nettoyage local de DIASPORALE après déconnexion. Les valeurs ne sont jamais
 * lues. Une panne n'empêche pas les autres clés et stockages d'être traités,
 * puis remonte sans détail pour signaler un nettoyage incomplet au moteur.
 */
export function clearDiasporaleDrafts(storages?: readonly DraftStorage[]): void {
  if (typeof window === "undefined") return
  let failed = false
  const targets: DraftStorage[] = []
  if (storages !== undefined) targets.push(...storages)
  else {
    for (const name of ["localStorage", "sessionStorage"] as const) {
      try {
        targets.push(window[name])
      } catch {
        failed = true
      }
    }
  }

  for (const storage of targets) {
    let length: number
    try {
      length = storage.length
    } catch {
      failed = true
      continue
    }
    // La suppression décale les indices : figer les clés avant tout retrait.
    const keys: string[] = []
    for (let index = 0; index < length; index += 1) {
      try {
        const key = storage.key(index)
        if (key?.startsWith(DRAFT_KEY_PREFIX)) keys.push(key)
      } catch {
        failed = true
      }
    }
    for (const key of keys) {
      try {
        storage.removeItem(key)
      } catch {
        failed = true
      }
    }
  }

  if (failed) throw new Error("Le nettoyage local des brouillons est incomplet.")
}
