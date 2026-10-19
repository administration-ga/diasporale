/**
 * Démonstration de la capacité « décisions de page » (P16 · G9). PROPRIÉTAIRE :
 * chantier « confiance des surfaces ».
 *
 * EXPLICITEMENT FICTIVE, comme « Mes données » : la démonstration ne prend
 * aucune décision de modération. Un signataire vivant de la page lit une liste
 * vide ; toute autre personne lit `null`, la même réponse qu'une page
 * introuvable ; un recours rend `not_found`, comme un dossier introuvable du
 * moteur. Le rôle est relu à chaque lecture : un signataire retiré perd la liste
 * aussitôt.
 */
import { useMemo, useSyncExternalStore } from "react"

import type { ModerationDecisionsPage } from "../data/data-rights-port"
import type { ActionResult } from "../data/port"
import type { PageDecisionsCapability, PageDecisionsQuery } from "../data/page-decisions-port"
import type { DemoStore } from "./store"

const LOADING = { status: "loading" } as const
const NO_DECISIONS: ModerationDecisionsPage = { items: [], continueCursor: null, isDone: true }

/** L'équipe vivante des pages de démonstration (`demoPageAdminContext`). */
export interface DemoPageDecisionsTeams {
  readonly isSignatory: (pageId: string, personId: string) => boolean
  readonly subscribe: (listener: () => void) => () => void
  readonly getVersion: () => number
}

export function createDemoPageDecisions(store: DemoStore, teams: DemoPageDecisionsTeams): PageDecisionsCapability {
  const subscribe = (listener: () => void) => {
    const subscriptions = [store.subscribe(listener), teams.subscribe(listener)]
    return () => subscriptions.forEach((unsubscribe) => unsubscribe())
  }
  const snapshot = () => `${store.getVersion()}:${teams.getVersion()}`
  /** `null` au rendu serveur : la démonstration ne se lit qu'au navigateur. */
  const useSnapshot = () => useSyncExternalStore(subscribe, snapshot, () => null)

  return {
    useDecisions({ pageId }): PageDecisionsQuery {
      const version = useSnapshot()
      return useMemo((): PageDecisionsQuery => {
        if (version === null) return LOADING
        const personId = store.getState().session.personId
        if (personId === null) return { status: "error", code: "not_signed_in" }
        return { status: "ready", data: teams.isSignatory(pageId, personId) ? NO_DECISIONS : null }
      }, [version, pageId])
    },

    async fileAppeal(): Promise<ActionResult<{ readonly created: boolean }>> {
      return { ok: false, code: store.getState().session.personId === null ? "not_signed_in" : "not_found" }
    },
  }
}
