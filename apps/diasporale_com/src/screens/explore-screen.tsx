"use client"

import type { CountryCode } from "@diasporale/domain"
import { Button, Card, CountryTag, EmptyState, Skeleton, countryName } from "@diasporale/features"
import { useOpenCountries, type MembershipView, type OpenCountryView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, BriefcaseIcon, GlobeIcon, GraduationCapIcon, HandHeartIcon, MapIcon, SearchIcon, StoreIcon } from "lucide-react"
import NextLink from "next/link"
import { useId, type ReactNode } from "react"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { PageDirectory } from "@/components/page-directory"
import { routes } from "@/lib/routes"

// ═══════════════════════════════════════════════════════════════
// Explorer — le point d'entrée de la découverte (DG-005)
// ═══════════════════════════════════════════════════════════════

/**
 * `/explorer` — « Je cherche qui ou quoi ? » : les membres de l'annuaire opt-in
 * (la recherche vit dans `/membres`), les services, l'annuaire des pages et les
 * pays ouverts, chacun menant à son hub. Rien ici n'élargit ce qu'une personne a
 * choisi de montrer : chaque surface garde ses propres gardes.
 */
export function ExploreScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Explore membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function Explore(props: { membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const ids = useId()
  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">{t("explore.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("explore.lead")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Shortcut
          headingId={`${ids}-membres`}
          icon={<SearchIcon />}
          title={t("nav.members")}
          body={t("explore.membersBody")}
          href={routes.members()}
          action={t("explore.membersAction")}
        />
        <Shortcut
          headingId={`${ids}-services`}
          icon={<StoreIcon />}
          title={t("nav.services")}
          body={t("explore.servicesBody")}
          href={routes.services()}
          action={t("explore.servicesAction")}
        />
        {/* Vague H du plan global : les rubriques communautaires, filtrées au départ par le pays de résidence. */}
        <Shortcut
          headingId={`${ids}-entraide`}
          icon={<HandHeartIcon />}
          title={t("nav.community.mutualAid")}
          body={t("explore.mutualAidBody")}
          href={routes.mutualAid(props.membership.facet.countryOfResidence)}
          action={t("explore.mutualAidAction")}
        />
        <Shortcut
          headingId={`${ids}-kit`}
          icon={<MapIcon />}
          title={t("nav.community.arrivalKit")}
          body={t("explore.arrivalKitBody")}
          href={routes.arrivalKit(props.membership.facet.countryOfResidence)}
          action={t("explore.arrivalKitAction")}
        />
        <Shortcut
          headingId={`${ids}-mentorat`}
          icon={<GraduationCapIcon />}
          title={t("nav.community.mentoring")}
          body={t("explore.mentoringBody")}
          href={routes.mentoring(props.membership.facet.countryOfResidence)}
          action={t("explore.mentoringAction")}
        />
        <Shortcut
          headingId={`${ids}-emploi`}
          icon={<BriefcaseIcon />}
          title={t("nav.community.jobs")}
          body={t("explore.jobsBody")}
          href={routes.jobs(props.membership.facet.countryOfResidence)}
          action={t("explore.jobsAction")}
        />
      </div>

      <nav aria-label={t("pageBrowsing.views")} className="flex flex-wrap gap-2">
        <Button asChild variant="outline"><NextLink href={routes.pages({ ownerKind: "association", country: props.membership.facet.countryOfResidence })}>{t("pageBrowsing.associations")}</NextLink></Button>
        <Button asChild variant="outline"><NextLink href={routes.pages({ ownerKind: "company", country: props.membership.facet.countryOfResidence })}>{t("pageBrowsing.companies")}</NextLink></Button>
        <Button asChild variant="ghost"><NextLink href={routes.pages({ followed: true })}>{t("pageBrowsing.followedTitle")}</NextLink></Button>
      </nav>

      {/* L'annuaire des pages (surface du chantier « pages ») part du pays de résidence, filtre visible
          qu'on ôte ou qu'on change : le contexte pays est gardé, la résidence n'est jamais réécrite. */}
      <PageDirectory country={props.membership.facet.countryOfResidence} />

      <OpenCountries home={props.membership.facet.countryOfResidence} headingId={`${ids}-pays`} />
    </>
  )
}

/** Un raccourci de découverte : ce qu'on y trouve, et le geste qui y mène. */
function Shortcut(props: { headingId: string; icon: ReactNode; title: string; body: string; href: string; action: string }) {
  return (
    <section aria-labelledby={props.headingId} className="flex min-w-0 flex-col items-start gap-3 rounded-xl bg-card p-4 text-card-foreground shadow-card">
      <div className="flex min-w-0 items-center gap-2">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-4">
          {props.icon}
        </span>
        <h2 id={props.headingId} className="min-w-0 text-lg font-semibold">
          {props.title}
        </h2>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{props.body}</p>
      <Button asChild variant="outline" className="mt-auto">
        <NextLink href={props.href}>
          {props.action}
          <ArrowRightIcon aria-hidden />
        </NextLink>
      </Button>
    </section>
  )
}

/** Mon pays d'abord, puis l'ordre alphabétique dans la langue de la personne. */
function ordered(countries: readonly OpenCountryView[], home: CountryCode, locale: string): OpenCountryView[] {
  return [...countries].sort((a, b) => {
    if (a.country === home) return -1
    if (b.country === home) return 1
    return countryName(a.country, locale).localeCompare(countryName(b.country, locale), locale)
  })
}

/** Les pays ouverts, chacun menant à son hub : chargement, erreur et absence ont chacun leur état. */
function OpenCountries(props: { home: CountryCode; headingId: string }) {
  const { t, locale } = useDiasporaleT()
  const open = useOpenCountries()
  return (
    <section aria-labelledby={props.headingId} aria-busy={open.status === "loading"} className="flex flex-col gap-3">
      <div>
        <h2 id={props.headingId} className="text-xl font-semibold">
          {t("explore.countriesTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("explore.countriesLead")}</p>
      </div>
      {open.status === "loading" ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : open.status === "error" ? (
        <Card role="alert" className="flex flex-col items-start gap-3 p-4">
          <div>
            <h3 className="font-semibold">{t("explore.countriesErrorTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("explore.countriesErrorBody")}</p>
          </div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            {t("explore.reload")}
          </Button>
        </Card>
      ) : open.data.length === 0 ? (
        <EmptyState
          icon={<GlobeIcon />}
          title={t("explore.countriesEmptyTitle")}
          description={t("explore.countriesEmptyBody")}
          action={
            <Button asChild variant="outline">
              <NextLink href={routes.communities()}>{t("explore.myCommunity")}</NextLink>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ordered(open.data, props.home, locale).map((item) => (
            <li key={item.country} className="min-w-0">
              <NextLink
                href={routes.hub(item.country)}
                className="flex min-h-14 min-w-0 items-center gap-3 rounded-xl bg-card p-3 pr-4 text-card-foreground shadow-card transition-colors hover:bg-muted focus-visible:shadow-focus"
              >
                <CountryTag country={item.country} size="md" className="min-w-0 shrink" />
                <span className="min-w-0 flex-1" />
                {item.country === props.home ? <span className="shrink-0 text-[12px] text-muted-foreground">{t("country.homeTag")}</span> : null}
                <ArrowRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              </NextLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
