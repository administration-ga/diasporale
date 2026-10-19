"use client"

/**
 * Adaptateur moteur de la capacité « conversations de mise en relation » (CC-6).
 * PROPRIÉTAIRE : chantier « conversations contextuelles ».
 *
 * Fonctions du moteur EXISTANTES (`contextualMessaging/threads`, CC-2b, ADR-0025) :
 *   · `findForObject` (`networkQuery`) : le fil d'un objet, relu en entier pour le
 *     lecteur ; `null` pour qui n'en est pas partie, ou pour un objet sans fil ;
 *   · `openForObject` (`networkMutation`, seau `contextual.open`) : l'ouverture
 *     idempotente par une partie actuelle d'un objet déjà en phase ouverte.
 *
 * L'écran de l'objet ne lit que l'ENTRÉE (le fil, ouvert ou en lecture seule, et
 * un message non lu) ; la conversation se lit et s'écrit dans la messagerie du
 * moteur. Un refus indistinct (`not_found`) se lit `null`, la même réponse qu'un
 * objet sans fil.
 */
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { ConversationObjectRef, ConversationsCapability, ObjectConversationView } from "@diasporale/features/data"
import type { FunctionArgs, FunctionReturnType } from "convex/server"

import { attemptAction, failed, LOADING, memberReadError, ready, Refusal, resolveDiasporaleNetworkId, useEngineMember, useLoaded, type EngineSourceDeps } from "./engine-kit"

const FIND_FOR_OBJECT = api.modules.contextualMessaging.threads.findForObject
const OPEN_FOR_OBJECT = api.modules.contextualMessaging.threads.openForObject

type EngineContext = FunctionArgs<typeof FIND_FOR_OBJECT>["context"]
type EngineThread = NonNullable<FunctionReturnType<typeof FIND_FOR_OBJECT>>

/** L'objet dans le vocabulaire du moteur ; un identifiant vide n'est jamais envoyé. */
export function toEngineContext(object: ConversationObjectRef): EngineContext | null {
  const id = object.id.trim()
  if (id.length === 0) return null
  switch (object.kind) {
    case "diasporaServiceRequest":
      return { kind: object.kind, id: id as Id<"serviceRequests"> }
    case "diasporaMentoring":
      return { kind: object.kind, id: id as Id<"mentoringRequests"> }
    case "diasporaJobApplication":
      return { kind: object.kind, id: id as Id<"jobApplications"> }
  }
}

/** Le fil vu de moi : écriture ouverte ou lecture seule, et un message d'en face non lu. */
export function toObjectConversationView(thread: EngineThread): ObjectConversationView {
  return { threadId: thread.threadId, writable: thread.state.kind === "open", unread: thread.unread }
}

export function createEngineConversations(deps: EngineSourceDeps): ConversationsCapability {
  return {
    useThreadFor(object) {
      const member = useEngineMember()
      const refusal = memberReadError(member)
      const networkId = member.networkId.state === "ready" ? member.networkId.value : null
      const context = toEngineContext(object)
      const canRead = refusal === null && member.auth.isAuthenticated && member.membership.state === "ready" && member.membership.value !== null && networkId !== null && context !== null
      const thread = useLoaded(FIND_FOR_OBJECT, canRead && networkId !== null && context !== null ? { networkId, context } : "skip")
      if (refusal !== null) return failed(refusal)
      if (context === null) return ready(null)
      if (!canRead || thread.state === "loading") return LOADING
      if (thread.state === "error") return thread.code === "not_found" ? ready(null) : failed(thread.code)
      return ready(thread.value === null ? null : toObjectConversationView(thread.value))
    },

    open: (object) => attemptAction(async () => {
      const context = toEngineContext(object)
      if (context === null) throw new Refusal("not_found")
      const networkId = await resolveDiasporaleNetworkId(deps.convex)
      const result = await deps.convex.mutation(OPEN_FOR_OBJECT, { networkId, context })
      return { threadId: result.threadId }
    }),
  }
}
