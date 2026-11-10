"use client"

/**
 * HB-05 : comprendre un hub. Sous les compteurs, de quand ils datent et ce que
 * compte « Membres visibles » ; sous l'en-tête, un bloc repliable « À propos » :
 * ce que veut dire le statut du pays, la règle d'ouverture telle qu'elle
 * s'applique aujourd'hui, les règles de la communauté et le signalement.
 *
 * Rien n'y est inventé : la date est celle du passage qui a compté (aucune avant
 * le premier passage) ; la condition d'ouverture est lue dans le domaine
 * (`COUNTRY_OPENING_REQUIREMENTS`), et l'écran dit qu'elle n'est pas encore
 * vérifiée par l'application (un administrateur de la plateforme ouvre un pays
 * depuis la console) ; la date d'ouverture du pays n'existe pas encore (HB-08) et
 * ne s'affiche pas ; aucun nom de modérateur, l'équipe est nommée collectivement
 * (décision 12 du plan 06).
 */
import { COUNTRY_OPENING_REQUIREMENTS } from "@diasporale/domain"
import { Card, formatDate } from "@diasporale/features"
import type { CountryHubView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, InfoIcon } from "lucide-react"
import NextLink from "next/link"

import { routes } from "@/lib/routes"

/**
 * Les compteurs du hub se montrent-ils ? Ceux de la démonstration, toujours
 * signalés comme tels ; ceux du moteur, seulement datés par un passage. Un
 * compteur sans date de passage ne s'affiche pas comme mesuré (règle d'EV-02).
 */
export function hubCountersMeasured(hub: Pick<CountryHubView, "countersSource" | "countersComputedAt">): boolean {
  return hub.countersSource === "demo" || hub.countersComputedAt !== null
}

/** Sous les compteurs : la date du passage, jamais avant le premier, et ce que comptent les membres visibles. */
export function HubCountersNote(props: { readonly computedAt: number | null }) {
  const { t, locale } = useDiasporaleT()
  return (
    <div className="col-span-full flex flex-col gap-0.5 text-[11px] text-muted-foreground">
      {props.computedAt !== null ? <p>{t("hubAbout.countedOn", { date: formatDate(props.computedAt, locale) })}</p> : null}
      <p>{t("hubAbout.visibleMembers")}</p>
    </div>
  )
}

const LINK_CLASS = "inline-flex min-h-10 items-center gap-1 self-start rounded-md text-sm font-semibold text-primary hover:underline focus-visible:shadow-focus"

/** Le bloc « À propos » du hub, replié par défaut. */
export function HubAbout(props: { readonly open: boolean; readonly countryLabel: string }) {
  const { t } = useDiasporaleT()
  return (
    <Card className="p-0">
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-semibold focus-visible:shadow-focus">
          <InfoIcon aria-hidden className="size-4 shrink-0" />
          {t("hubAbout.summary", { country: props.countryLabel })}
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4 text-sm leading-relaxed">
          <dl className="flex flex-col gap-3">
            <div>
              <dt className="font-semibold">{t("hubAbout.statusLabel")}</dt>
              <dd className="mt-0.5 text-muted-foreground">{props.open ? t("hubAbout.statusOpen") : t("hubAbout.statusNotOpen")}</dd>
            </div>
            <div>
              <dt className="font-semibold">{t("hubAbout.openingLabel")}</dt>
              <dd className="mt-0.5 text-muted-foreground">
                {t("hubAbout.openingRule", {
                  relays: COUNTRY_OPENING_REQUIREMENTS.relayAssociations,
                  moderators: COUNTRY_OPENING_REQUIREMENTS.activeModerators,
                })}
              </dd>
            </div>
            <div>
              <dt className="font-semibold">{t("hubAbout.moderationLabel")}</dt>
              <dd className="mt-0.5 flex flex-col gap-1 text-muted-foreground">
                <span>{t("hubAbout.reportReminder")}</span>
                <NextLink href={routes.settingsReports()} className={LINK_CLASS}>
                  {t("hubAbout.reportsLink")}
                  <ArrowRightIcon aria-hidden className="size-4" />
                </NextLink>
              </dd>
            </div>
          </dl>
          <NextLink href={routes.communityRules()} className={LINK_CLASS}>
            {t("hubAbout.rulesLink")}
            <ArrowRightIcon aria-hidden className="size-4" />
          </NextLink>
        </div>
      </details>
    </Card>
  )
}
