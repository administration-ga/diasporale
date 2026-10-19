"use client"

/**
 * iCom dans diasporale.com (PD7, point 3) : la messagerie, les appels et la
 * présence du MOTEUR, montés tels quels — aucune surface n'est recopiée ici.
 *
 * - `EngineIcom` (mode moteur seulement) dit si la session y a droit : un membre
 *   de DIASPORALE qui peut écrire (`canPublish`) ; il monte UNE fois, à la racine,
 *   la couche de communication du moteur (hôte d'appel, présence, stockage par
 *   réseau), qui persiste d'une page à l'autre : un appel ne se coupe pas en
 *   naviguant.
 * - `IcomIsland` pose, autour de chaque surface du moteur (dock, messagerie,
 *   statuts, boutons d'appel), l'adaptateur de routage et le réseau courant
 *   (`NetworkProvider`, simple contexte) : l'arbre des pages n'est jamais
 *   remonté quand la session se résout.
 * - En démonstration, iCom est fermé (`useIcomState()` : `off`, raison `demo`).
 */
import { NetworkProvider } from "@antsia/api/network"
import { NextRouterAdapter } from "@antsia/api/routing/next"
import { conversationHref, dockStore, draftKey } from "@antsia/social-features/messagerie"
import { CommunicationShell } from "@antsia/social-features/shell"
import { useIsReseauMobile } from "@antsia/ui/overlay"
import { api } from "@convex/_generated/api"
import { DIASPORALE_NETWORK_SLUG } from "@diasporale/domain"
import { useSession } from "@diasporale/features/data"
import { useQuery } from "convex/react"
import { useRouter } from "next/navigation"
import { createContext, type ReactNode, useCallback, useContext, useMemo } from "react"

import { engineRoutes } from "@/lib/engine-routes"
import { ICOM_DEMO, resolveIcomState, type IcomNetwork, type IcomState } from "@/lib/icom-state"
import { routes } from "@/lib/routes"

export type { IcomNetwork, IcomOffReason, IcomState } from "@/lib/icom-state"

/** La charte de DIASPORALE, redéclarée par les surfaces portalisées du moteur (carte iCom, appel, statuts). */
const ICOM_CHARTE = "diasporale"

/** Le palier `xl` où la coque montre son rail droit, donc la carte iCom ancrée (`xl:flex` d'`AppShell`). */
const RAIL_VISIBLE_QUERY = "(min-width: 80rem)"

const IcomStateContext = createContext<IcomState>(ICOM_DEMO)
const EngineNetworkContext = createContext<IcomNetwork | null>(null)

/** Réseau de lecture du membre, y compris en attente ; la démonstration n'en fournit pas. */
export function useEngineNetwork(): IcomNetwork | null {
  return useContext(EngineNetworkContext)
}

export function useIcomState(): IcomState {
  return useContext(IcomStateContext)
}

/** Le réseau iCom de la session, ou `null` tant qu'iCom n'est pas ouvert. */
export function useIcomNetwork(): IcomNetwork | null {
  const state = useIcomState()
  return state.status === "on" ? state.network : null
}

/** Un îlot des surfaces du moteur : routage de Next et réseau courant, là où la surface est montée. */
export function IcomIsland(props: { network: IcomNetwork; children: ReactNode }) {
  return (
    <NextRouterAdapter>
      <NetworkProvider
        networkId={props.network.networkId}
        slug={props.network.slug}
        personId={props.network.personId}
        charte={ICOM_CHARTE}
        routes={engineRoutes}
      >
        {props.children}
      </NetworkProvider>
    </NextRouterAdapter>
  )
}

/** Mode moteur : le droit à iCom, et la couche de communication montée une fois, à côté de l'arbre des pages. */
export function EngineIcom(props: { children: ReactNode }) {
  const session = useSession()
  const network = useQuery(api.modules.networks.networks.getBySlug, { slug: DIASPORALE_NETWORK_SLUG })
  const membership = session.status === "ready" && session.data.status === "signed_in" ? session.data.membership : null
  const sessionReady = session.status !== "loading"
  const personId = membership?.canPublish ? membership.personId : null
  const networkId = network === undefined ? undefined : (network?._id ?? null)
  const state = useMemo(() => resolveIcomState({ sessionReady, personId, networkId }), [sessionReady, personId, networkId])
  const readablePersonId = membership && membership.status !== "partie" && membership.status !== "suspendue" ? membership.personId : null
  const readableNetwork = useMemo<IcomNetwork | null>(
    () => networkId && readablePersonId
      ? { networkId, slug: DIASPORALE_NETWORK_SLUG, personId: readablePersonId as IcomNetwork["personId"] }
      : null,
    [networkId, readablePersonId],
  )
  return (
    <EngineNetworkContext.Provider value={readableNetwork}>
      <IcomStateContext.Provider value={state}>
        {props.children}
        {state.status === "on" ? (
          <IcomIsland network={state.network}>
            <CommunicationShell />
          </IcomIsland>
        ) : null}
      </IcomStateContext.Provider>
    </EngineNetworkContext.Provider>
  )
}

/**
 * « Écrire » à une personne (même geste que la fiche profil du moteur) : un
 * BROUILLON par identifiant, dans le magasin du moteur — le fil naît au premier
 * envoi. Au téléphone, la page de conversation s'ouvre sur lui ; au bureau, la
 * carte iCom le montre, détachée quand le rail droit est retiré (sous 1 280 px).
 */
export function useWriteTo(): (handle: string) => void {
  const router = useRouter()
  const isMobile = useIsReseauMobile()
  return useCallback(
    (handle: string) => {
      dockStore.openDraft(handle)
      if (isMobile === true) {
        const href = conversationHref(draftKey(handle), routes.messages())
        if (href !== null) router.push(href)
        return
      }
      if (!window.matchMedia(RAIL_VISIBLE_QUERY).matches) dockStore.detach()
    },
    [isMobile, router],
  )
}
