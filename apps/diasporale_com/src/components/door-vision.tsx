"use client"

import { Button } from "@diasporale/features"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import {
  BadgeCheckIcon,
  BriefcaseIcon,
  GiftIcon,
  GlobeIcon,
  HandHeartIcon,
  LockIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"
import NextLink from "next/link"

import { routes } from "@/lib/routes"

import { OpenCountriesList, useHasOpenCountries } from "./open-countries"

/**
 * La vision de DIASPORALE, sous la porte de l'accueil et de /entrer : ce qu'est le
 * réseau, ce qu'on y trouve, ses principes de confiance et comment y entrer
 * (cahier des charges §1–2, étude 13, accueils 11). La porte reste la première
 * action : cette section vient APRÈS la carte d'accès, au téléphone comme au bureau.
 *
 * Communication publique : aucun chiffre, aucune promesse d'audit, d'hébergement ni
 * de disponibilité ; on décrit, sans annoncer de volume. Les clés sont citées en
 * entier (cliquet des clés i18n).
 */
type VisionItem = { readonly icon: LucideIcon; readonly title: string; readonly body: string }

const OFFER: readonly VisionItem[] = [
  { icon: GlobeIcon, title: "landing.vision.offer.country.title", body: "landing.vision.offer.country.body" },
  { icon: HandHeartIcon, title: "landing.vision.offer.settle.title", body: "landing.vision.offer.settle.body" },
  { icon: BriefcaseIcon, title: "landing.vision.offer.work.title", body: "landing.vision.offer.work.body" },
  { icon: UsersIcon, title: "landing.vision.offer.associations.title", body: "landing.vision.offer.associations.body" },
  { icon: MessageCircleIcon, title: "landing.vision.offer.contact.title", body: "landing.vision.offer.contact.body" },
]

const TRUST: readonly VisionItem[] = [
  { icon: LockIcon, title: "landing.vision.trust.closed.title", body: "landing.vision.trust.closed.body" },
  { icon: BadgeCheckIcon, title: "landing.vision.trust.speaker.title", body: "landing.vision.trust.speaker.body" },
  { icon: ShieldCheckIcon, title: "landing.vision.trust.verified.title", body: "landing.vision.trust.verified.body" },
  { icon: UserPlusIcon, title: "landing.vision.trust.sponsored.title", body: "landing.vision.trust.sponsored.body" },
  { icon: SlidersHorizontalIcon, title: "landing.vision.trust.data.title", body: "landing.vision.trust.data.body" },
  { icon: GiftIcon, title: "landing.vision.trust.free.title", body: "landing.vision.trust.free.body" },
]

const STEPS = ["landing.vision.steps.account", "landing.vision.steps.residence", "landing.vision.steps.publish"] as const

/** `showJoin` : l'appel à rejoindre, sauf sur la carte d'inscription elle-même. */
export function DoorVision(props: { showJoin: boolean }) {
  const { t } = useDiasporaleT()
  const hasCountries = useHasOpenCountries()
  return (
    <section aria-labelledby="vision-titre" className="border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-[1060px] flex-col gap-10 px-5 py-12 min-[960px]:gap-12 min-[960px]:py-16">
        <header className="max-w-[640px]">
          <h2 id="vision-titre" className="text-2xl font-semibold tracking-tight min-[960px]:text-3xl">
            {t("landing.vision.title")}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground min-[960px]:text-lg">{t("landing.vision.lead")}</p>
        </header>

        <VisionGroup id="vision-offre" title={t("landing.vision.offerTitle")} items={OFFER} />

        {/* Au bureau, la vitrine montre déjà les pays ouverts ; au téléphone, ils sont ici. */}
        {hasCountries ? (
          <section aria-labelledby="vision-pays" className="flex flex-col gap-3 min-[960px]:hidden">
            <h3 id="vision-pays" className="text-lg font-semibold">
              {t("landing.vision.countriesTitle")}
            </h3>
            <OpenCountriesList />
          </section>
        ) : null}

        <VisionGroup id="vision-confiance" title={t("landing.vision.trustTitle")} items={TRUST} />

        <section aria-labelledby="vision-etapes" className="flex flex-col gap-4">
          <h3 id="vision-etapes" className="text-lg font-semibold">
            {t("landing.vision.stepsTitle")}
          </h3>
          <ol className="flex flex-col gap-3">
            {STEPS.map((key, index) => (
              <li key={key} className="flex items-start gap-3">
                <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground">
                  {index + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{t(key)}</span>
              </li>
            ))}
          </ol>
          {props.showJoin ? (
            <div>
              <Button asChild size="lg" variant="outline" className="text-primary">
                <NextLink href={routes.register()}>{t("landing.vision.join")}</NextLink>
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </section>
  )
}

function VisionGroup(props: { id: string; title: string; items: readonly VisionItem[] }) {
  const { t } = useDiasporaleT()
  return (
    <section aria-labelledby={props.id} className="flex flex-col gap-4">
      <h3 id={props.id} className="text-lg font-semibold">
        {props.title}
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2 min-[960px]:grid-cols-3">
        {props.items.map((item) => (
          <li key={item.title} className="flex gap-3 rounded-xl border border-border bg-background p-4">
            <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
              <item.icon className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-snug">{t(item.title)}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(item.body)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
