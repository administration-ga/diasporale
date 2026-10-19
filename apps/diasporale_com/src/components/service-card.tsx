"use client"

import { Card, TrustBadge, countryName } from "@diasporale/features"
import type { ServiceOfferCardView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ClockIcon, LanguagesIcon, MapPinIcon } from "lucide-react"
import NextLink from "next/link"

import { routes } from "@/lib/routes"

import { formatServiceDuration, formatServicePrice, languageList } from "./service-format"

/**
 * La carte d'une offre du catalogue (DG-011/012) : ce qui est proposé, par qui
 * (la PAGE et son badge calculé, jamais un signataire), où, comment, et le
 * tarif ANNONCÉ. Aucune coordonnée, aucune note ni avis : le contact passe par
 * la fiche de l'offre et sa demande structurée.
 */
export function ServiceCard(props: { readonly offer: ServiceOfferCardView; readonly showProvider?: boolean }) {
  const { t, locale } = useDiasporaleT()
  const { offer } = props
  const fit = offer.budgetFit
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4">
      <p className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <span className="rounded-[var(--radius-xs)] bg-[var(--esp-neutral-chip)] px-2 py-0.5 font-medium text-foreground">{t(`services.category.${offer.category}`)}</span>
        <span>{t(`services.delivery.${offer.delivery}`)}</span>
      </p>
      <h3 className="break-words text-base font-semibold leading-snug">
        <NextLink href={routes.serviceOffer(offer.id)} className="rounded-sm hover:underline focus-visible:shadow-focus">
          {offer.title}
        </NextLink>
      </h3>
      {props.showProvider === false ? null : (
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
          <span className="min-w-0 break-words">{t("services.card.by", { name: offer.provider.name })}</span>
          <TrustBadge badge={offer.provider.badge} />
        </p>
      )}
      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
        <p className="flex min-w-0 items-start gap-1.5">
          <MapPinIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{t("services.card.zone", { city: offer.city, country: countryName(offer.country, locale) })}</span>
        </p>
        <p className="flex min-w-0 items-start gap-1.5">
          <LanguagesIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 break-words">{languageList(offer.languages, locale)}</span>
        </p>
        {offer.durationMinutes !== null ? (
          <p className="flex min-w-0 items-start gap-1.5">
            <ClockIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            <span>{t("services.card.duration", { duration: formatServiceDuration(offer.durationMinutes, t) })}</span>
          </p>
        ) : null}
      </div>
      <p className="font-semibold">{formatServicePrice(offer.pricing, locale, t)}</p>
      {fit === "within" || fit === "quote" || fit === "other_currency" ? (
        <p className="text-[13px] text-muted-foreground">{t(`services.budgetFit.${fit}`)}</p>
      ) : null}
    </Card>
  )
}
