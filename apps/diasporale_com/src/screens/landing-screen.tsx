"use client"

import { Button, CountryTag, ScopeTag, Skeleton, TrustBadges, cn, countryName, formatNumber } from "@diasporale/features"
import { useOpenCountries, type OpenCountryView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, BadgeCheckIcon, IdCardIcon, MailIcon, MessageSquareTextIcon } from "lucide-react"
import NextLink from "next/link"
import type { ReactNode } from "react"

import { PublicShell } from "@/components/site-chrome"
import { anchors, routes } from "@/lib/routes"

/**
 * Vitrine publique (`/`). La thèse : la diaspora, pays par pays. Le « tableau
 * des pays ouverts » est la pièce maîtresse : il lit les pays ouverts et leurs
 * compteurs MATÉRIALISÉS (jamais un chiffre en dur ; en démonstration, ils
 * sont étiquetés comme tels).
 */
export function LandingScreen() {
  const { t } = useDiasporaleT()
  return (
    <PublicShell>
      <section aria-labelledby="vitrine-titre">
        <div aria-hidden className="h-0.5 w-full bg-[image:var(--dg-stripe)]" />
        <div className="mx-auto grid w-full max-w-[1120px] items-start gap-10 px-4 pb-14 pt-10 md:grid-cols-[1.1fr_0.9fr] md:pt-16">
          <div>
            <h1 id="vitrine-titre" className="font-display text-[44px] font-bold leading-[0.95] tracking-[-0.01em] md:text-[64px]">
              {t("landing.title")}
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">{t("landing.lead")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <NextLink href={routes.enter()}>
                  {t("landing.ctaEnter")}
                  <ArrowRightIcon aria-hidden />
                </NextLink>
              </Button>
              <Button asChild size="lg" variant="ghost">
                <a href={anchors.howToEnter}>{t("landing.ctaHow")}</a>
              </Button>
            </div>
            <p className="mt-6 text-[13px] text-muted-foreground">{t("landing.free")}</p>
          </div>
          <OpenCountriesBoard />
        </div>
      </section>

      <section aria-labelledby="principes-titre" className="border-y border-border bg-card">
        <div className="mx-auto w-full max-w-[1120px] px-4 py-12">
          <h2 id="principes-titre" className="font-display text-3xl font-bold">
            {t("landing.principlesTitle")}
          </h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            <Principle title={t("landing.principleCountryTitle")} body={t("landing.principleCountryBody")}>
              <div className="flex flex-wrap gap-2">
                <CountryTag country="FR" city={t("landing.sampleCity")} size="md" />
                <ScopeTag size="md" />
              </div>
            </Principle>
            <Principle title={t("landing.principleTrustTitle")} body={t("landing.principleTrustBody")}>
              <TrustBadges badges={["official", "verified", "public_agent", "community"]} size="md" />
            </Principle>
            <Principle title={t("landing.principleContactTitle")} body={t("landing.principleContactBody")}>
              <span className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-[15px] font-medium text-primary-foreground">
                <MailIcon className="size-4" aria-hidden />
                {t("contact.write")}
              </span>
            </Principle>
          </div>
        </div>
      </section>

      <section id={anchors.howToEnter.slice(1)} aria-labelledby="entrer-titre" className="mx-auto w-full max-w-[1120px] scroll-mt-6 px-4 py-14">
        <h2 id="entrer-titre" className="font-display text-3xl font-bold">
          {t("landing.howTitle")}
        </h2>
        <p className="mt-2 max-w-[42rem] text-muted-foreground">{t("landing.howLead")}</p>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <Door
            icon={<IdCardIcon aria-hidden />}
            title={t("landing.doorIdnTitle")}
            body={t("landing.doorIdnBody")}
            note={t("landing.doorIdnNote")}
            emphasis
          />
          <Door icon={<MessageSquareTextIcon aria-hidden />} title={t("landing.doorCodeTitle")} body={t("landing.doorCodeBody")} note={t("landing.doorCodeNote")} />
        </div>
        <h3 className="mt-12 font-display text-2xl font-bold">{t("landing.stepsTitle")}</h3>
        <ol className="mt-5 grid gap-4 md:grid-cols-3">
          {(["landing.step1", "landing.step2", "landing.step3"] as const).map((key, index) => (
            <li key={key} className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
              <span aria-hidden className="font-mono text-3xl font-semibold leading-none text-tag-code">
                {index + 1}
              </span>
              <p className="text-[15px] leading-snug">{t(key)}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex items-start gap-3 rounded-xl bg-published px-4 py-3 text-published-foreground">
          <BadgeCheckIcon className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="text-[15px] leading-snug">{t("landing.verifyNote")}</p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1120px] px-4">
        <div className="flex flex-col items-start gap-5 rounded-2xl bg-[var(--ink-900)] px-6 py-10 text-[var(--ink-0)] md:flex-row md:items-center md:justify-between md:px-10">
          <p className="max-w-[36rem] font-display text-3xl font-bold leading-tight">{t("landing.closing")}</p>
          <Button asChild size="lg" className="bg-[var(--ink-0)] text-[var(--ink-900)] hover:bg-[var(--ink-100)]">
            <NextLink href={routes.enter()}>{t("landing.ctaEnter")}</NextLink>
          </Button>
        </div>
      </section>
    </PublicShell>
  )
}

function Principle(props: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-display text-xl font-bold">{props.title}</h3>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{props.body}</p>
      <div className="mt-1">{props.children}</div>
    </div>
  )
}

function Door(props: { icon: ReactNode; title: string; body: string; note: string; emphasis?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-card", props.emphasis ? "border-primary" : "border-border")}>
      <span aria-hidden className="grid size-11 place-items-center rounded-xl bg-tag text-tag-code [&_svg]:size-5">
        {props.icon}
      </span>
      <h3 className="font-display text-xl font-bold">{props.title}</h3>
      <p className="text-[15px] leading-relaxed">{props.body}</p>
      <p className="text-[13px] text-muted-foreground">{props.note}</p>
    </div>
  )
}

/**
 * Le tableau des pays ouverts — un panneau d'aéroport en encre : la diaspora
 * vit entre deux pays. Il ne montre QUE des données (pays ouverts, compteurs
 * matérialisés) ; un pays fermé n'y est jamais annoncé.
 */
function OpenCountriesBoard() {
  const { t } = useDiasporaleT()
  const open = useOpenCountries()
  return (
    <section
      aria-labelledby="tableau-titre"
      className="overflow-hidden rounded-2xl bg-[var(--ink-900)] text-[var(--ink-0)] shadow-lg"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--ink-0)_18%,transparent)] px-5 py-3">
        <h2 id="tableau-titre" className="font-mono text-xs font-semibold uppercase tracking-[0.12em]">
          {t("landing.boardTitle")}
        </h2>
        {open.status === "ready" && open.data.some((item) => item.countersSource === "demo") ? (
          <span className="rounded-[var(--radius-xs)] bg-demo px-1.5 py-0.5 text-[11px] font-semibold text-demo-foreground">
            {t("demo.tag")}
          </span>
        ) : null}
      </div>
      {open.status !== "ready" ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-14 w-full bg-[color-mix(in_srgb,var(--ink-0)_12%,transparent)]" />
        </div>
      ) : (
        <ul className="divide-y divide-[color-mix(in_srgb,var(--ink-0)_14%,transparent)]">
          {open.data.map((item) => (
            <BoardRow key={item.country} item={item} />
          ))}
        </ul>
      )}
      <p className="border-t border-[color-mix(in_srgb,var(--ink-0)_18%,transparent)] px-5 py-4 text-[13px] leading-snug opacity-85">
        {t("landing.boardFooter")}
      </p>
    </section>
  )
}

function BoardRow(props: { item: OpenCountryView }) {
  const { t, locale } = useDiasporaleT()
  const { item } = props
  const counters = item.counters
  const value = (presentation: (typeof counters)["associations"]) =>
    presentation.kind === "value" ? formatNumber(presentation.value, locale) : t("hub.belowThreshold", { threshold: presentation.threshold })
  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-4">
        <span aria-hidden className="font-mono text-4xl font-semibold leading-none tracking-[-0.03em]">
          {item.country}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-xl font-bold">{countryName(item.country, locale)}</p>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] opacity-80">{t("landing.boardOpen")}</p>
        </div>
      </div>
      {counters.dormant ? (
        <p className="mt-3 text-[13px] opacity-85">{t("hub.soon")}</p>
      ) : (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
          {(
            [
              ["hub.counters.members", counters.members],
              ["hub.counters.associations", counters.associations],
              ["hub.counters.companies", counters.companies],
              ["hub.counters.events", counters.upcomingEvents],
            ] as const
          ).map(([key, presentation]) => (
            <div key={key} className="flex flex-col">
              <dt className="opacity-75">{t(key)}</dt>
              <dd className="font-mono font-semibold">{value(presentation)}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}
