"use client"

import { EmptyState, FolderTabsNav } from "@diasporale/features"
import type { MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { UsersRoundIcon } from "lucide-react"
import NextLink from "next/link"
import { useSearchParams } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { Gate, GateSkeleton } from "@/components/gate"
import { IcomIsland, useEngineNetwork, useIcomState } from "@/components/icom"
import { EnginePersonalConnections } from "@/components/personal-connections"
import { routes } from "@/lib/routes"

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
  const kind = params.get("onglet") === "demandes" ? "received" : "accepted"

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">{t("relations.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("relations.lead")}</p>
      </div>
      {network ? (
        <>
          <FolderTabsNav
            label={t("relations.tabsLabel")}
            items={[
              { id: "accepted", label: t("relations.acceptedTab"), href: routes.relations(), active: kind === "accepted" },
              { id: "received", label: t("relations.receivedTab"), href: routes.relations("received"), active: kind === "received" },
            ]}
            renderLink={(item, className, children) => (
              <NextLink key={item.id} href={item.href} className={className} aria-current={item.active ? "page" : undefined} scroll={false}>
                {children}
              </NextLink>
            )}
          />
          <IcomIsland key={`${network.networkId}:${network.personId}:${kind}`} network={network}>
            <EnginePersonalConnections kind={kind} canRespond={props.membership.canPublish} />
          </IcomIsland>
        </>
      ) : icom.status === "loading" ? <GateSkeleton /> : (
        <EmptyState icon={<UsersRoundIcon />} title={t("relations.unavailableTitle")} description={t("relations.unavailableBody")} />
      )}
    </>
  )
}
