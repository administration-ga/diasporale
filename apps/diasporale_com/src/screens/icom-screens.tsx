"use client"

import { MessagesRoute } from "@antsia/social-features/messagerie"
import { StoriesViewerPage } from "@antsia/social-features/stories"
import { EmptyState } from "@diasporale/features"
import type { MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { MessageCircleOffIcon } from "lucide-react"
import { Suspense, type ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { Gate, GateSkeleton } from "@/components/gate"
import { IcomIsland, useIcomState, type IcomOffReason } from "@/components/icom"
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
          <MessagesRoute {...props.route} />
        </Suspense>
      </main>
    </IcomPage>
  )
}

/** `/actus` — le lecteur plein écran des statuts ; sur `…/nouvelle`, le composeur ouvert. */
export function StoriesScreen(props: { openCreate: boolean }) {
  return (
    <IcomPage titleKey="stories.title">
      {/* Le lecteur mobile du moteur mesure 100 % de son parent : une hauteur
          définie est requise, sinon la story chargée a une hauteur nulle. */}
      <main id="contenu" className="h-dvh overflow-hidden bg-background">
        <StoriesViewerPage openCreate={props.openCreate} />
      </main>
    </IcomPage>
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
