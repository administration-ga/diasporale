/**
 * Comptes de démonstration — adaptateur MOTEUR de la capacité `demoAccounts`
 * (développement local seulement). Le catalogue et l'équipement vivent dans la
 * tranche `convex/modules/diaspora/demoAccounts` d'ANTSIA, sous la double garde
 * des outils de développement : ailleurs, le catalogue est vide et l'équipement
 * refusé. Le code à usage unique se relit par `devTools.latestOtp`, comme
 * l'écran de connexion le fait déjà en développement local.
 */
import { api } from "@convex/_generated/api"
import type { DemoAccountEntry, DemoAccountsCapability, Loadable } from "@diasporale/features/data"
import { useMemo } from "react"

import { attemptAction, failed, LOADING, ready, useLoaded, type EngineSourceDeps } from "./engine-kit"

/** Le code enregistré par l'envoi se relit aussitôt ; quelques essais couvrent le délai du backend local. */
const CODE_READS = 8
const CODE_READ_DELAY_MS = 250

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function createEngineDemoAccounts(deps: EngineSourceDeps): DemoAccountsCapability {
  const sleep = deps.sleep ?? wait
  return {
    useCatalogue(): Loadable<readonly DemoAccountEntry[]> {
      const loaded = useLoaded(api.modules.diaspora.demoAccounts.catalogue, {})
      const value = loaded.state === "ready" ? loaded.value : null
      const code = loaded.state === "error" ? loaded.code : null
      // Une projection mémorisée : un Loadable neuf à chaque rendu relancerait ses lecteurs sans fin.
      return useMemo<Loadable<readonly DemoAccountEntry[]>>(() => {
        if (code !== null) return failed(code)
        if (value === null) return LOADING
        return ready(value.map((entry) => ({ actor: entry.actor, email: entry.email })))
      }, [value, code])
    },
    async readLocalCode(email) {
      for (let read = 0; read < CODE_READS; read++) {
        const latest = await deps.convex.query(api.modules.platform.devTools.latestOtp, { email }).catch(() => null)
        if (latest) return latest.code
        if (read < CODE_READS - 1) await sleep(CODE_READ_DELAY_MS)
      }
      return null
    },
    equip: (actor) =>
      attemptAction(async () => {
        const equipped = await deps.convex.mutation(api.modules.diaspora.demoAccounts.equipMyDemoAccount, { actor })
        return { status: equipped.status, role: equipped.role, pageId: equipped.pageId, pageCreated: equipped.pageCreated }
      }),
  }
}
