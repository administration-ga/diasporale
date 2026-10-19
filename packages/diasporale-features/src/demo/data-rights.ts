/**
 * Démonstration de la capacité « droits personnels » (DG-026). PROPRIÉTAIRE :
 * chantier « droits personnels ».
 *
 * EXPLICITEMENT FICTIVE, et cohérente avec le magasin de démonstration :
 *   · l'export rend le fichier du magasin (`exportMyData`, marqué
 *     `demonstration: true`), données fictives de ce navigateur seulement ;
 *   · la demande d'effacement suit la grâce du moteur (30 jours,
 *     `ERASURE_GRACE_MS`), rejouée à l'identique et annulable tant qu'elle
 *     court ; elle vit dans la mémoire de la page, liée au jeu de démonstration
 *     en cours (une remise à zéro l'efface) ; à l'échéance, l'effacement est
 *     celui du magasin (`deleteMyAccount`), réglé seulement quand la personne
 *     concernée est celle de la session — le magasin efface la session, jamais
 *     une autre personne ;
 *   · la démonstration ne prend aucune décision de modération : la liste est
 *     vide et un recours rend `not_found`, comme un dossier introuvable du moteur.
 * Aucune lecture d'adhésion : les mêmes gestes valent pour un membre suspendu.
 */
import { useEffect, useMemo, useSyncExternalStore } from "react"

import {
  ERASURE_GRACE_MS,
  type DataRightsCapability,
  type DecisionsQuery,
  type ErasureView,
  type LastExportView,
  type ModerationDecisionsPage,
} from "../data/data-rights-port"
import type { ActionErrorCode } from "../data/errors"
import type { ActionResult } from "../data/port"
import type { Loadable } from "../data/types"
import type { DemoStore } from "./store"

interface PendingErasure {
  /** Le jeu de démonstration de la demande (`createdAt` de l'état) : une remise à zéro la rend caduque. */
  readonly world: number
  readonly requestedAt: number
  readonly dueAt: number
}

const LOADING = { status: "loading" } as const
const OK: ActionResult = { ok: true, value: null }
const NO_DECISIONS: ModerationDecisionsPage = { items: [], continueCursor: null, isDone: true }
const fail = (code: ActionErrorCode): ActionResult<never> => ({ ok: false, code })

export function createDemoDataRights(store: DemoStore): DataRightsCapability {
  const erasures = new Map<string, PendingErasure>()
  const exports = new Map<string, { readonly world: number; readonly view: LastExportView }>()
  const listeners = new Set<() => void>()
  const settling = new Set<string>()
  let revision = 0

  const world = () => store.getState().createdAt
  const emit = () => {
    revision += 1
    for (const listener of listeners) listener()
  }
  const subscribe = (listener: () => void) => {
    listeners.add(listener)
    const unsubscribe = store.subscribe(listener)
    return () => {
      listeners.delete(listener)
      unsubscribe()
    }
  }
  const snapshot = () => `${store.getVersion()}:${revision}`
  /** `null` au rendu serveur : la démonstration ne se lit qu'au navigateur. */
  const useSnapshot = () => useSyncExternalStore(subscribe, snapshot, () => null)

  /** Seule la personne de la session exerce ses droits ; une autre personne : `not_found`. */
  const viewerRefusal = (personId: string): ActionErrorCode | null => {
    const viewer = store.getState().session.personId
    if (viewer === null) return "not_signed_in"
    return viewer === personId ? null : "not_found"
  }

  const pendingOf = (personId: string): PendingErasure | null => {
    const pending = erasures.get(personId)
    return pending && pending.world === world() ? pending : null
  }

  /** L'échéance passée : l'effacement du magasin, pour la personne de la session seulement. */
  async function settle(personId: string): Promise<void> {
    const pending = pendingOf(personId)
    if (!pending || store.now() < pending.dueAt || settling.has(personId) || viewerRefusal(personId) !== null) return
    settling.add(personId)
    try {
      const erased = await store.deleteMyAccount()
      if (erased.ok) erasures.delete(personId)
    } finally {
      settling.delete(personId)
      emit()
    }
  }

  return {
    useErasure(personId: string): Loadable<ErasureView> {
      const version = useSnapshot()
      let view: Loadable<ErasureView> = LOADING
      if (version !== null) {
        const refusal = viewerRefusal(personId)
        const pending = refusal === null ? pendingOf(personId) : null
        view = refusal !== null
          ? { status: "error", code: refusal }
          : pending === null
            ? { status: "ready", data: { state: "none" } }
            : { status: "ready", data: { state: store.now() < pending.dueAt ? "grace" : "processing", requestedAt: pending.requestedAt, dueAt: pending.dueAt } }
      }
      const due = view.status === "ready" && view.data.state === "processing"
      useEffect(() => {
        if (due) void settle(personId)
      }, [due, personId])
      return view
    },

    async requestErasure(personId) {
      const refusal = viewerRefusal(personId)
      if (refusal) return fail(refusal)
      const existing = pendingOf(personId)
      if (existing) return { ok: true, value: { dueAt: existing.dueAt } }
      const requestedAt = store.now()
      const dueAt = requestedAt + ERASURE_GRACE_MS
      erasures.set(personId, { world: world(), requestedAt, dueAt })
      emit()
      return { ok: true, value: { dueAt } }
    },

    async cancelErasure(personId) {
      const refusal = viewerRefusal(personId)
      if (refusal) return fail(refusal)
      const pending = pendingOf(personId)
      if (!pending) return OK
      if (store.now() >= pending.dueAt) return fail("erasure_not_cancellable")
      erasures.delete(personId)
      emit()
      return OK
    },

    async prepareExport(personId, options) {
      if (options?.signal?.aborted) return fail("export_cancelled")
      const refusal = viewerRefusal(personId)
      if (refusal) return fail(refusal)
      options?.onProgress?.({ done: 0, total: 1 })
      const exported = await store.exportMyData()
      if (!exported.ok) return exported
      if (options?.signal?.aborted) return fail("export_cancelled")
      // Le magasin exporte la personne de la session : une session changée pendant l'attente ne rend rien.
      if (viewerRefusal(personId) !== null) return fail("not_found")
      options?.onProgress?.({ done: 1, total: 1 })
      const exportedAt = store.now()
      exports.set(personId, { world: world(), view: { exportedAt } })
      emit()
      return { ok: true, value: { json: exported.value, exportedAt } }
    },

    useLastExport(personId: string): LastExportView | null {
      useSnapshot()
      const last = exports.get(personId)
      return last && last.world === world() && viewerRefusal(personId) === null ? last.view : null
    },

    useDecisions({ personId }): DecisionsQuery {
      const version = useSnapshot()
      return useMemo((): DecisionsQuery => {
        if (version === null) return LOADING
        const refusal = viewerRefusal(personId)
        return refusal !== null ? { status: "error", code: refusal } : { status: "ready", data: NO_DECISIONS }
      }, [version, personId])
    },

    async fileAppeal({ personId }) {
      return fail(viewerRefusal(personId) ?? "not_found")
    },
  }
}
