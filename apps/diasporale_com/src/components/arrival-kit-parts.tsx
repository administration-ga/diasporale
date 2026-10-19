"use client"

/**
 * Briques communes des surfaces « kit d'arrivée » (DG-024 b) : la carte d'une
 * ressource, sa rubrique, son état (« à revoir » toujours visible), qui la porte
 * (page au badge calculé, ou personne au nom publié), et la garde d'un lien externe.
 * PROPRIÉTAIRE : chantier « kit d'arrivée ».
 *
 * L'autorité reste au fournisseur (moteur ou démonstration) : ces briques disent ce
 * qu'il a jugé — l'état effectif, la cause d'un « à revoir », le badge d'une page —,
 * elles ne le recalculent pas.
 */
import type { ArrivalKitCategory, ArrivalKitStatus } from "@diasporale/domain"
import { cn, EmptyState, TrustBadge, formatDate } from "@diasporale/features"
import type { ArrivalKitCarrierView, ArrivalKitPersonLabel, ArrivalKitResourceCardView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { LandmarkIcon, MapIcon, TriangleAlertIcon, UsersIcon } from "lucide-react"
import NextLink from "next/link"
import type { ReactNode } from "react"

import { routes } from "@/lib/routes"

export const kitLinkClass = "break-words font-semibold text-primary underline-offset-4 hover:underline focus-visible:shadow-focus"
const chipClass = "inline-flex items-center gap-1 rounded-[var(--radius-xs)] px-2 py-0.5 text-[13px] font-medium [&_svg]:size-3.5"

/**
 * Un lien EXTERNE n'est proposé que vers une adresse https sans identifiants de
 * connexion (le domaine l'a déjà exigé ; l'écran ne fait pas confiance pour autant).
 */
export function isSafeExternalUrl(url: string | null): url is string {
  if (url === null) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === "https:" && parsed.username === "" && parsed.password === ""
  } catch {
    return false
  }
}

export function ArrivalKitUnavailable() {
  const { t } = useDiasporaleT()
  return <EmptyState icon={<MapIcon />} title={t("arrivalKit.unavailable.title")} description={t("arrivalKit.unavailable.body")} />
}

export function ArrivalKitCategoryChip(props: { readonly category: ArrivalKitCategory }) {
  const { t } = useDiasporaleT()
  return <span className={cn(chipClass, "bg-[var(--esp-neutral-chip)] text-foreground")}>{t(`arrivalKit.category.${props.category}`)}</span>
}

/**
 * L'état d'une ressource : « à revoir » se dit TOUJOURS (icône et libellé, jamais la
 * seule couleur) ; les autres états seulement là où ils renseignent (`always`).
 */
export function ArrivalKitStatusBadge(props: { readonly status: ArrivalKitStatus; readonly always?: boolean }) {
  const { t } = useDiasporaleT()
  if (props.status === "needs_review") {
    return (
      <span className={cn(chipClass, "bg-[var(--warning-50)] text-[var(--warning-600)]")}>
        <TriangleAlertIcon aria-hidden />
        {t("arrivalKit.status.needs_review")}
      </span>
    )
  }
  if (props.status === "published" || props.always !== true) return null
  return <span className={cn(chipClass, "bg-muted text-foreground")}>{t(`arrivalKit.status.${props.status}`)}</span>
}

/** Officielle seulement si la page qui la porte a le badge « Officiel » calculé ; communautaire sinon. */
export function ArrivalKitTrustChip(props: { readonly official: boolean }) {
  const { t } = useDiasporaleT()
  return props.official ? (
    <span className={cn(chipClass, "bg-official text-official-foreground")}>
      <LandmarkIcon aria-hidden />
      {t("arrivalKit.card.official")}
    </span>
  ) : (
    <span className={cn(chipClass, "bg-muted text-muted-foreground")}>
      <UsersIcon aria-hidden />
      {t("arrivalKit.card.community")}
    </span>
  )
}

/** Une personne citée : son nom publié (lien vers son profil), ou le nom neutre. */
export function ArrivalKitPersonName(props: { readonly person: ArrivalKitPersonLabel }) {
  const { t } = useDiasporaleT()
  const { person } = props
  if (person.displayName === null) return <span className="font-semibold">{t("arrivalKit.detail.neutralPerson")}</span>
  return person.handle === null
    ? <span className="font-semibold">{person.displayName}</span>
    : <NextLink href={routes.profile(person.handle)} className={kitLinkClass}>{person.displayName}</NextLink>
}

/** Qui porte la ressource : la page (lien et badge calculé), ou la personne (nom publié). */
export function ArrivalKitCarrier(props: { readonly carrier: ArrivalKitCarrierView }) {
  const { carrier } = props
  if (carrier.kind === "person") return <ArrivalKitPersonName person={carrier.person} />
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      <NextLink href={routes.page(carrier.page.handle)} className={kitLinkClass}>{carrier.page.name}</NextLink>
      <TrustBadge badge={carrier.page.badge} />
    </span>
  )
}

/**
 * La carte d'une ressource : rubrique, état, confiance, titre (lien vers la fiche),
 * résumé, ville ou tout le pays, date de vérification, et la page qui la porte.
 */
export function ArrivalKitResourceCard(props: { readonly resource: ArrivalKitResourceCardView; readonly showStatus?: boolean; readonly children?: ReactNode }) {
  const { t, locale } = useDiasporaleT()
  const { resource } = props
  const titleId = `ressource-${resource.id}`
  return (
    <article aria-labelledby={titleId} className="flex h-full min-w-0 flex-col gap-2 rounded-xl bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <ArrivalKitCategoryChip category={resource.category} />
        <ArrivalKitStatusBadge status={resource.status} always={props.showStatus === true} />
        <ArrivalKitTrustChip official={resource.official} />
      </div>
      <h3 id={titleId} className="break-words text-base font-semibold leading-snug">
        <NextLink href={routes.arrivalKitResource(resource.id)} className={kitLinkClass}>{resource.title}</NextLink>
      </h3>
      <p className="break-words text-sm text-muted-foreground">{resource.summary}</p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
        <span className="break-words">{resource.city ?? t("arrivalKit.card.wholeCountry")}</span>
        <span aria-hidden>·</span>
        <span>{t("arrivalKit.card.verifiedOn", { date: formatDate(resource.lastVerifiedAt, locale) })}</span>
      </p>
      {resource.reviewCause !== null ? <p className="text-[13px] text-[var(--warning-600)]">{t(`arrivalKit.reviewCause.${resource.reviewCause}`)}</p> : null}
      {resource.carrier.kind === "page" ? (
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">{t("arrivalKit.card.byPage")}</span>
          <ArrivalKitCarrier carrier={resource.carrier} />
        </p>
      ) : null}
      {props.children}
    </article>
  )
}
