"use client"

import { Avatar, Button, Card, CountryTag, EmptyState, FilterBar, Input, MemberSuggestions, Skeleton, TrustBadges, countryName } from "@diasporale/features"
import { MEMBER_SEARCH_MIN_LENGTH, useMemberSearch, type MemberHitView, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { SearchIcon, UsersRoundIcon } from "lucide-react"
import NextLink from "next/link"
import { useEffect, useId, useState } from "react"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { useEngineNetwork } from "@/components/icom"
import { routes } from "@/lib/routes"

// ═══════════════════════════════════════════════════════════════
// Membres — l'annuaire opt-in (EXF-DG-19, EXF-DG-46)
// ═══════════════════════════════════════════════════════════════

/** Attente après la dernière frappe : une recherche par intention, pas par lettre. */
const SEARCH_DEBOUNCE_MS = 250

const SEARCH_REACHES = ["network", "country"] as const
type SearchReach = (typeof SEARCH_REACHES)[number]

/** `/membres` — chercher un membre parmi ceux qui ont choisi d'être trouvés ; le contact passe par la messagerie. */
export function MembersScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Members membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

function Members(props: { membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const network = useEngineNetwork()
  const ids = useId()
  const [query, setQuery] = useState("")
  const [reach, setReach] = useState<SearchReach>("network")
  const settled = useSettled(query.trim(), SEARCH_DEBOUNCE_MS)
  const country = props.membership.facet.countryOfResidence
  const results = useMemberSearch({ query: settled, ...(reach === "country" ? { country } : {}) })
  const searching = settled.length >= MEMBER_SEARCH_MIN_LENGTH
  const level = props.membership.directoryVisibility

  return (
    <>
      <div>
        <h1 className="font-display text-3xl font-bold">{t("members.title")}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("members.lead")}</p>
        {network ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="outline"><NextLink href={routes.relations()}>{t("nav.relations")}</NextLink></Button>
            <Button asChild variant="outline"><NextLink href={routes.relations("dismissed")}>{t("relations.dismissedTab")}</NextLink></Button>
          </div>
        ) : null}
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <div role="search" className="relative">
          <label htmlFor={`${ids}-q`} className="sr-only">
            {t("members.searchLabel")}
          </label>
          <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${ids}-q`}
            type="search"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={t("members.searchPlaceholder")}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <FilterBar
          label={t("members.reachLabel")}
          options={SEARCH_REACHES.map((id) => ({ id, label: id === "network" ? t("members.reachNetwork") : countryName(country, locale) }))}
          selected={[reach]}
          onToggle={setReach}
        />
      </Card>

      {searching ? null : <MemberSuggestions headingId={`${ids}-suggestions`} />}

      <section aria-labelledby={`${ids}-results`} aria-busy={searching && results.status === "loading"}>
        <h2 id={`${ids}-results`} className="sr-only">
          {t("members.resultsLabel")}
        </h2>
        <Results results={results} searching={searching} query={settled} />
      </section>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4 text-[14px]">
        <p>{t("members.mine", { level: t(`settings.directoryLevel.${level}`) })}</p>
        <NextLink href={`${routes.settings()}#annuaire`} className="font-semibold text-[var(--esp-accent-deep)] underline-offset-2 hover:underline focus-visible:shadow-focus">
          {t("members.mineAction")}
        </NextLink>
      </Card>
    </>
  )
}

function Results(props: { results: ReturnType<typeof useMemberSearch>; searching: boolean; query: string }) {
  const { t } = useDiasporaleT()
  const { results } = props
  if (!props.searching) {
    return <EmptyState icon={<UsersRoundIcon />} title={t("members.idleTitle")} description={t("members.idleBody")} />
  }
  if (results.status === "loading") {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-[72px] w-full rounded-xl" />
        <Skeleton className="h-[72px] w-full rounded-xl" />
      </div>
    )
  }
  if (results.status === "error") {
    return (
      <p role="alert" className="rounded-xl bg-card p-4 text-[15px] shadow-card">
        {t(`errors.${results.code}`)}
      </p>
    )
  }
  const hits = results.data
  return (
    <>
      <p role="status" className="sr-only">
        {t("members.count", { count: hits.length })}
      </p>
      {hits.length === 0 ? (
        <EmptyState icon={<SearchIcon />} title={t("members.emptyTitle", { query: props.query })} description={t("members.emptyBody")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {hits.map((hit) => (
            <MemberRow key={hit.personId} hit={hit} />
          ))}
        </ul>
      )}
    </>
  )
}

function MemberRow(props: { hit: MemberHitView }) {
  const { hit } = props
  return (
    <li>
      <NextLink
        href={routes.profile(hit.handle)}
        className="flex items-center gap-3 rounded-xl bg-card p-4 text-card-foreground shadow-card transition-colors hover:bg-muted focus-visible:shadow-focus"
      >
        <Avatar id={hit.personId} name={hit.displayName} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{hit.displayName}</span>
            <TrustBadges badges={hit.badges} size="sm" />
          </span>
          <span className="block truncate text-[13px] text-muted-foreground">
            @{hit.handle}
            {hit.headline ? ` · ${hit.headline}` : null}
          </span>
          {/* Au téléphone, le pays passe sous le nom ; au bureau, il se range à droite. */}
          {hit.facet.countryOfResidence ? (
            <CountryTag country={hit.facet.countryOfResidence} city={hit.facet.city} size="sm" className="mt-1.5 sm:hidden" />
          ) : null}
        </span>
        {hit.facet.countryOfResidence ? (
          <CountryTag country={hit.facet.countryOfResidence} city={hit.facet.city} size="sm" className="hidden sm:inline-flex" />
        ) : null}
      </NextLink>
    </li>
  )
}
