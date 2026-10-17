"use client"

import { BlockedPeopleSection, FollowsSection, SentInvitationsSection } from "@antsia/social-features/reseau-personnel"
import { EmptyState, FolderTabsNav } from "@diasporale/features"
import type { MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { UsersRoundIcon } from "lucide-react"
import NextLink from "next/link"
import { useSearchParams } from "next/navigation"
import { useLayoutEffect, useRef } from "react"

import { AppShell } from "@/components/app-shell"
import { EngineDismissedSuggestions } from "@/components/dismissed-suggestions"
import { Gate, GateSkeleton } from "@/components/gate"
import { IcomIsland, useEngineNetwork, useIcomState } from "@/components/icom"
import { EnginePersonalConnections } from "@/components/personal-connections"
import { routes } from "@/lib/routes"

type RelationsView = "accepted" | "received" | "sent" | "following" | "blocked" | "dismissed"
const RELATIONS_VIEWS: ReadonlyMap<string, RelationsView> = new Map([
  ["demandes", "received"],
  ["envoyees", "sent"],
  ["abonnements", "following"],
  ["blocages", "blocked"],
  ["masquees", "dismissed"],
])

/** Mes liens dans DIASPORALE ; la découverte reste exclusivement dans l'annuaire opt-in. */
export function RelationsScreen() {
  return (
    <Gate require="member">
      {(session) => session.membership ? (
        <AppShell membership={session.membership}>
          <Relations membership={session.membership} />
        </AppShell>
      ) : null}
    </Gate>
  )
}

function Relations(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const params = useSearchParams()
  const network = useEngineNetwork()
  const icom = useIcomState()
  const tab = params.get("onglet")
  const kind = RELATIONS_VIEWS.get(tab ?? "") ?? "accepted"
  // Le contexte de lecture et l'adhésion peuvent se résoudre sur deux rendus.
  const resolvingReader = network !== null && network.personId !== props.membership.personId
  const tabsLabel = t("relations.tabsLabel")
  const selectedTab = useRef<HTMLAnchorElement>(null)
  useLayoutEffect(() => {
    const link = selectedTab.current
    const track = link?.parentElement
    if (!link || !track) return
    const revealSelected = () => {
      const item = link.getBoundingClientRect()
      const visible = track.getBoundingClientRect()
      // Déplacer seulement la piste : ni focus volé, ni défilement de la page.
      if (item.left < visible.left) track.scrollLeft -= visible.left - item.left
      else if (item.right > visible.right) track.scrollLeft += item.right - visible.right
    }
    revealSelected()
    window.addEventListener("resize", revealSelected)
    return () => window.removeEventListener("resize", revealSelected)
  }, [kind, network?.networkId, network?.personId, resolvingReader, tabsLabel])

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">{t("relations.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("relations.lead")}</p>
      </div>
      {resolvingReader ? <GateSkeleton /> : network ? (
        <>
          <FolderTabsNav
            label={tabsLabel}
            items={[
              { id: "accepted", label: t("relations.acceptedTab"), href: routes.relations(), active: kind === "accepted" },
              { id: "received", label: t("relations.receivedTab"), href: routes.relations("received"), active: kind === "received" },
              { id: "sent", label: t("relations.sentTab"), href: routes.relations("sent"), active: kind === "sent" },
              { id: "following", label: t("relations.followingTab"), href: routes.relations("following"), active: kind === "following" },
              { id: "blocked", label: t("relations.blockedTab"), href: routes.relations("blocked"), active: kind === "blocked" },
              { id: "dismissed", label: t("relations.dismissedTab"), href: routes.relations("dismissed"), active: kind === "dismissed" },
            ]}
            renderLink={(item, className, children) => (
              <NextLink key={item.id} ref={item.active ? selectedTab : undefined} href={item.href} className={className} aria-current={item.active ? "page" : undefined} scroll={false}>
                {children}
              </NextLink>
            )}
          />
          <IcomIsland key={`${network.networkId}:${network.personId}:${kind}`} network={network}>
            {kind === "following"
              ? <FollowsSection discover={{ href: routes.members(), label: t("relations.discover") }} />
              : kind === "sent"
                ? <SentInvitationsSection discover={{ href: routes.members(), label: t("relations.discover") }} />
                : kind === "blocked"
                  ? <BlockedPeopleSection />
                  : kind === "dismissed"
                    ? <EngineDismissedSuggestions />
                    : <EnginePersonalConnections kind={kind} canRespond={props.membership.canPublish} />}
          </IcomIsland>
        </>
      ) : icom.status === "loading" ? <GateSkeleton /> : (
        <EmptyState icon={<UsersRoundIcon />} title={t("relations.unavailableTitle")} description={t("relations.unavailableBody")} />
      )}
    </>
  )
}
