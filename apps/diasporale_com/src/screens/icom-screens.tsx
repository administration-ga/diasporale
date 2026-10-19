"use client"

import { MessagesRoute } from "@antsia/social-features/messagerie"
import { StoriesViewerPage } from "@antsia/social-features/stories"
import { EmptyState } from "@diasporale/features"
import type { MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { MessageCircleOffIcon } from "lucide-react"
import { Suspense, type ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { useDiasporaleContextualMessages } from "@/components/contextual-conversations"
import { Gate, GateSkeleton } from "@/components/gate"
import { IcomIsland, useEngineNetwork, useIcomState, type IcomOffReason } from "@/components/icom"
import type { MessagesRouteTarget } from "@/lib/messages-route"

// ═══════════════════════════════════════════════════════════════
// iCom en pages (PD7) — la messagerie et les statuts du moteur
// ═══════════════════════════════════════════════════════════════

/**
 * `/messages/…` — au téléphone, la messagerie plein écran du moteur (liste,
 * conversation, composeurs) ; au bureau, l'adresse ouvre la carte iCom
 * détachée sur le fil (`MessagesRoute` choisit).
 */
export function MessagesScreen(props: { route: MessagesRouteTarget }) {
  return (
    <IcomPage titleKey="messages.title">
      <main id="contenu" className="min-h-dvh bg-background">
        <Suspense fallback={null}>
          <ContextualMessagesRoute route={props.route} />
        </Suspense>
      </main>
    </IcomPage>
  )
}

/** CC-6 : la messagerie du moteur avec nos conversations de mise en relation (filtre « Mises en relation », conversation en page). */
function ContextualMessagesRoute(props: { route: MessagesRouteTarget }) {
  const contextual = useDiasporaleContextualMessages()
  return <MessagesRoute {...props.route} contextual={contextual} />
}

/** `/actus` — le lecteur plein écran des statuts ; sur `…/nouvelle`, le composeur ouvert. */
export function StoriesScreen(props: { openCreate: boolean }) {
  return (
    <Gate require="member">
      {(session) => session.membership ? (
        <StoriesPageBody membership={session.membership} openCreate={props.openCreate} />
      ) : null}
    </Gate>
  )
}

/** Lire les stories ne demande pas le droit de communiquer ni de publier. */
function StoriesPageBody(props: { membership: MembershipView; openCreate: boolean }) {
  const network = useEngineNetwork()
  const icom = useIcomState()
  if (network !== null && network.personId !== props.membership.personId) return <GateSkeleton />
  if (network === null || props.membership.status === "suspendue" || props.membership.status === "partie") {
    if (icom.status === "loading") return <GateSkeleton />
    return (
      <AppShell membership={props.membership}>
        <IcomUnavailable titleKey="stories.title" reason={icom.status === "off" ? icom.reason : "unavailable"} />
      </AppShell>
    )
  }
  const canCreate = props.membership.canPublish
  return (
    <IcomIsland key={`${network.networkId}:${network.personId}:${canCreate}`} network={network}>
      {/* Le lecteur mobile du moteur mesure 100 % de son parent : une hauteur
          définie est requise, sinon la story chargée a une hauteur nulle. */}
      <main id="contenu" className="h-dvh overflow-hidden bg-background">
        <StoriesViewerPage canCreate={canCreate} openCreate={props.openCreate && canCreate} />
      </main>
    </IcomIsland>
  )
}

/** Ce que la page dit quand iCom est fermé, selon la raison (clés citées en toutes lettres : cliquet i18n). */
const UNAVAILABLE_BODY: Record<IcomOffReason, string> = {
  demo: "icom.unavailable.demo",
  not_allowed: "relation.needsStatus",
  unavailable: "icom.unavailable.networkMissing",
}

/** Le passage commun des pages iCom : l'adhésion d'abord, puis iCom ouvert — sinon la page dit pourquoi. */
function IcomPage(props: { titleKey: string; children: ReactNode }) {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <IcomPageBody membership={session.membership} titleKey={props.titleKey}>
            {props.children}
          </IcomPageBody>
        ) : null
      }
    </Gate>
  )
}

function IcomPageBody(props: { membership: MembershipView; titleKey: string; children: ReactNode }) {
  const icom = useIcomState()
  if (icom.status === "loading") return <GateSkeleton />
  if (icom.status === "off") {
    return (
      <AppShell membership={props.membership}>
        <IcomUnavailable titleKey={props.titleKey} reason={icom.reason} />
      </AppShell>
    )
  }
  return <IcomIsland network={icom.network}>{props.children}</IcomIsland>
}

function IcomUnavailable(props: { titleKey: string; reason: IcomOffReason }) {
  const { t } = useDiasporaleT()
  return (
    <>
      <h1 className="font-display text-3xl font-bold">{t(props.titleKey)}</h1>
      <EmptyState icon={<MessageCircleOffIcon />} title={t("icom.unavailableTitle")} description={t(UNAVAILABLE_BODY[props.reason])} />
    </>
  )
}
