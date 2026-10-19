"use client"

import { Card, EmptyState } from "@diasporale/features"
import { usePageDecisions, type Loadable, type ModerationDecisionsPage, type PageDecisionsCapability } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ScaleIcon } from "lucide-react"
import { useId } from "react"

import { DecisionResults, useDecisionNavigation } from "./moderation-decisions"

/**
 * L'onglet « Décisions de modération » de la gestion d'une page (P16 · G9) : les
 * décisions qui ont retiré un contenu porté par la page (mission bénévole, offre
 * d'emploi, ressource du kit de la page, réponse à un avis, évènement), et le
 * recours de la page. Tout signataire vivant lit la liste et conteste ; le moteur
 * relit ce droit à chaque lecture et à chaque recours. Ni déclarant, ni contenu,
 * ni modérateur : la fiche d'une décision est celle de « Mes données ».
 */
export function PageDecisionsPanel(props: { readonly pageId: string }) {
  const { t } = useDiasporaleT()
  const capability = usePageDecisions()
  if (capability === null) {
    return <EmptyState icon={<ScaleIcon />} title={t("pageDecisions.unavailableTitle")} description={t("pageDecisions.unavailableBody")} />
  }
  // Une autre page : la pagination et les recours en cours repartent de zéro.
  return <PageDecisionsList key={props.pageId} capability={capability} pageId={props.pageId} />
}

function PageDecisionsList(props: { readonly capability: PageDecisionsCapability; readonly pageId: string }) {
  const { t } = useDiasporaleT()
  const titleId = useId()
  const navigation = useDecisionNavigation()
  const query = props.capability.useDecisions({ pageId: props.pageId, cursor: navigation.cursor })
  // `null` : je ne signe plus pour cette page (rôle retiré à l'instant) — la liste se ferme.
  const lost = query.status === "ready" && query.data === null
  const results: Loadable<ModerationDecisionsPage> = query.status !== "ready"
    ? query
    : query.data === null ? { status: "loading" } : { status: "ready", data: query.data }

  return (
    <Card className="flex min-w-0 flex-col gap-4 p-5">
      <section aria-labelledby={titleId} className="flex min-w-0 flex-col gap-4">
        <div>
          <h2 id={titleId} className="font-display text-xl font-bold">{t("pageDecisions.title")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("pageDecisions.lead")}</p>
        </div>
        {lost ? (
          <p role="status" className="rounded-xl bg-muted p-4 text-sm">{t("pageDecisions.lost")}</p>
        ) : (
          <DecisionResults
            query={results}
            navigation={navigation}
            appeal={(input) => props.capability.fileAppeal({ pageId: props.pageId, ...input })}
            copy={{ empty: "pageDecisions.empty", emptyPage: "pageDecisions.emptyPage", loadError: "pageDecisions.loadError" }}
          />
        )}
      </section>
    </Card>
  )
}
