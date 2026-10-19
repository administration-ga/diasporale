"use client"

/** Les avis de prestations de la page ; mêmes preuves et actions que DG-016. */
import { Card, EmptyState, Skeleton } from "@diasporale/features"
import {
  useDataSource,
  useServiceReviews,
  useSession,
  type PageServiceReviewView,
  type ServiceReviewsCapability,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { MessageSquareTextIcon } from "lucide-react"
import NextLink from "next/link"
import { useId } from "react"

import { routes } from "@/lib/routes"

import { ServicePager } from "./service-pager"
import { ServiceReviewCard } from "./service-reviews-section"

export function PageServiceReviews(props: {
  readonly pageId: string
  readonly personId: string
  readonly mode?: "public" | "manage"
}) {
  const { t } = useDiasporaleT()
  const source = useDataSource()
  const capability = useServiceReviews()
  const session = useSession()
  if (session.status === "loading") return <Skeleton className="h-24 w-full rounded-xl" />
  if (session.status === "error") return <Card role="alert" className="p-4">{t(`errors.${session.code}`)}</Card>
  if (session.data.status !== "signed_in") return <Card role="alert" className="p-4">{t("errors.not_signed_in")}</Card>
  if (!session.data.membership || session.data.membership.personId !== props.personId) return <Card role="alert" className="p-4">{t("errors.not_member")}</Card>
  if (!capability?.usePageReviews) return <EmptyState icon={<MessageSquareTextIcon />} title={t("pageReviews.unavailableTitle")} description={t("pageReviews.unavailableBody")} />
  const key = JSON.stringify([source.kind, props.personId, props.pageId])
  return <PageReviewsList key={key} {...props} capability={capability} read={capability.usePageReviews} />
}

function PageReviewsList(props: {
  readonly pageId: string
  readonly personId: string
  readonly mode?: "public" | "manage"
  readonly capability: ServiceReviewsCapability
  readonly read: NonNullable<ServiceReviewsCapability["usePageReviews"]>
}) {
  const { t } = useDiasporaleT()
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-lg font-semibold">{t("pageReviews.title")}</h2>
      <p className="text-sm text-muted-foreground">{t(props.mode === "manage" ? "pageReviews.manageLead" : "pageReviews.lead")}</p>
      <ServicePager<PageServiceReviewView>
        read={(cursor) => props.read({ pageId: props.pageId, personId: props.personId, cursor })}
        keyOf={(review) => review.reviewId}
        empty={<p className="rounded-lg bg-muted p-4 text-sm">{t("pageReviews.empty")}</p>}
      >
        {(reviews) => <ul className="flex min-w-0 flex-col gap-4">{reviews.map((review) => (
          <li key={review.reviewId} className="flex min-w-0 flex-col gap-2">
            <NextLink href={routes.serviceOffer(review.offerId)} className="self-start break-words rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus">
              {t("pageReviews.openOffer", { title: review.offerTitle })}
            </NextLink>
            <ServiceReviewCard review={review} capability={props.capability} />
          </li>
        ))}</ul>}
      </ServicePager>
    </section>
  )
}
