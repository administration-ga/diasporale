"use client"

import type { MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowLeftIcon } from "lucide-react"
import NextLink from "next/link"

import { DataRightsSettings } from "@/components/data-rights-settings"
import { Gate } from "@/components/gate"
import { PublicShell } from "@/components/site-chrome"
import { routes } from "@/lib/routes"

/**
 * `/mes-donnees` — les droits personnels HORS de la coque de membre (NP-02, EA-05) :
 * exporter ses données, demander puis annuler l'effacement, lire ses décisions de
 * modération et former un recours, suivre ses signalements.
 *
 * Ouverte à toute personne connectée, adhésion facultative (garde `person`) : qui n'est
 * jamais entré dans DIASPORALE, qui l'a quitté, qui est suspendu, et le membre. Les portes
 * du moteur appelées ne lisent aucune adhésion ; la page n'en lit que pour choisir le
 * retour (réglages ou accueil) et pour proposer « Quitter DIASPORALE » à qui peut encore
 * partir. Aucune surface sociale n'y est montée : ni coque de membre, ni cloche, ni fil.
 */
export function MyDataScreen() {
  return (
    <PublicShell hideEnter>
      <Gate require="person">{(session) => <MyData personId={session.account.id} membership={session.membership} />}</Gate>
    </PublicShell>
  )
}

function MyData(props: { personId: string; membership: MembershipView | null }) {
  const { t } = useDiasporaleT()
  const member = props.membership !== null && props.membership.status !== "partie"
  return (
    <div className="mx-auto flex w-full max-w-[792px] flex-col gap-4 px-4 pb-10 pt-6 md:pt-10">
      <NextLink
        href={member ? routes.settings() : routes.welcome()}
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t(member ? "myData.backToSettings" : "myData.backToWelcome")}
      </NextLink>
      <DataRightsSettings
        key={props.personId}
        heading="h1"
        person={{ personId: props.personId, handle: props.membership?.handle ?? null, canLeave: member }}
      />
    </div>
  )
}
