"use client"

import {
  appendCursorPage,
  initialCursorPages,
  mergedCursorRows,
  nextCursor,
  recordCursorPage,
  type CursorPageMount,
  type CursorPageSnapshot,
  type CursorPagesState,
} from "@antsia/social-features/reseau-personnel"
import type { CountryCode } from "@diasporale/domain"
import { Avatar, Button, Card, CountrySwitch, CountryTag, EmptyState, FilterBar, Input, Skeleton, TrustBadge, countryName } from "@diasporale/features"
import {
  ASSOCIATION_TYPES,
  COMPANY_SECTORS,
  ERROR_CODES,
  PAGE_DIRECTORY_QUERY_MIN_LENGTH,
  useOptionalDataSource,
  type AssociationType,
  type CompanySector,
  type DiasporaleDataSource,
  type ErrorCode,
  type PageDirectoryEntry,
  type PageDirectoryPage,
  type PagesCapability,
  type PagesRetry,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowRightIcon, Building2Icon, ListFilterIcon, SearchIcon } from "lucide-react"
import NextLink from "next/link"
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { routes } from "@/lib/routes"

/** Attente après la dernière frappe : une recherche par intention, pas par lettre. */
const SEARCH_DEBOUNCE_MS = 250

type CountryFilter = "all" | CountryCode
type KindFilter = "all" | "association" | "company"

export interface PageDirectoryFilters {
  readonly query: string
  readonly country: CountryCode | null
  readonly ownerKind: "association" | "company" | null
  readonly associationType?: AssociationType | null
  readonly sector?: CompanySector | null
}

interface PageDirectoryProps {
  readonly country?: CountryCode
  readonly ownerKind?: "association" | "company"
  readonly associationType?: AssociationType | null
  readonly sector?: CompanySector | null
  readonly query?: string
  readonly followedOnly?: boolean
  readonly onFiltersChange?: (filters: PageDirectoryFilters) => void
}

interface DirectoryFiltersState {
  readonly query: string
  readonly country: CountryCode | null
  readonly kind: KindFilter
  readonly associationType: AssociationType | null
  readonly sector: CompanySector | null
}

function incomingFilters(props: PageDirectoryProps, supportsCategories: boolean): DirectoryFiltersState {
  return {
    query: props.query ?? "",
    country: props.country ?? null,
    kind: props.ownerKind ?? "all",
    associationType: supportsCategories && props.ownerKind === "association" ? props.associationType ?? null : null,
    sector: supportsCategories && props.ownerKind === "company" ? props.sector ?? null : null,
  }
}

function filtersSignature(filters: DirectoryFiltersState): string {
  return JSON.stringify([filters.query.trim(), filters.country, filters.kind, filters.associationType, filters.sector])
}

/**
 * L'annuaire des pages du réseau (associations, entreprises, médias,
 * institutions), monté dans « Explorer » (DG-007). PROPRIÉTAIRE : chantier
 * « pages ». La signature `PageDirectory({ country? })` est figée : le pays
 * donné est le filtre de départ ; on peut l'ôter ou en choisir un autre.
 *
 * Recherche sans accents dès deux caractères (sinon l'ordre de l'annuaire :
 * confiance, puis récence), pages lues par fenêtres bornées (« Afficher plus »),
 * chaque carte avec son badge calculé et le lien vers la fiche. Aucune
 * coordonnée : le contact passe par la fiche et la messagerie.
 */
export function PageDirectory(props: PageDirectoryProps) {
  const source = useOptionalDataSource()
  const capability = source?.pages ?? null
  if (!source || !capability || (props.followedOnly && !capability.useFollowedPages)) return <DirectoryUnavailable />
  return <Directory source={source} capability={capability} {...props} />
}

function DirectoryUnavailable() {
  const { t } = useDiasporaleT()
  return <EmptyState icon={<Building2Icon />} title={t("page.directory.unavailable")} />
}

function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}

function Directory(props: PageDirectoryProps & { source: DiasporaleDataSource; capability: PagesCapability }) {
  const { t, locale } = useDiasporaleT()
  const ids = useId()
  const open = props.source.useOpenCountries()
  const session = props.source.useSession()
  const readerId = session.status === "ready" && session.data.status === "signed_in" ? session.data.membership?.personId ?? null : null
  const supportsCategories = props.capability.supportsDirectoryCategories === true && !props.followedOnly
  const incoming = incomingFilters(props, supportsCategories)
  const incomingFilterSignature = filtersSignature(incoming)
  const incomingSignature = JSON.stringify([incomingFilterSignature, supportsCategories, props.followedOnly === true])
  const [filterState, setFilterState] = useState(() => ({
    incomingSignature,
    filters: incoming,
    lastCountry: props.country ?? null,
  }))
  const emittedSignatures = useRef<string[]>([])
  const previousIncoming = useRef(incomingSignature)
  // Un retour de router.replace ne doit pas effacer une frappe plus récente.
  // Une autre adresse remplace tous les filtres ensemble, avant les effets de persistance.
  if (filterState.incomingSignature !== incomingSignature) {
    const ownEcho = emittedSignatures.current.includes(incomingFilterSignature)
    setFilterState({
      incomingSignature,
      filters: ownEcho ? filterState.filters : incoming,
      lastCountry: ownEcho ? filterState.lastCountry : incoming.country ?? filterState.lastCountry,
    })
  }
  useLayoutEffect(() => {
    if (previousIncoming.current === incomingSignature) return
    previousIncoming.current = incomingSignature
    const echoedAt = emittedSignatures.current.indexOf(incomingFilterSignature)
    emittedSignatures.current = echoedAt < 0 ? [] : emittedSignatures.current.slice(echoedAt + 1)
  }, [incomingSignature, incomingFilterSignature])
  const { query, country, kind } = filterState.filters
  const { lastCountry } = filterState
  const associationType = supportsCategories && kind === "association" ? filterState.filters.associationType : null
  const sector = supportsCategories && kind === "company" ? filterState.filters.sector : null
  const settled = useSettled(query.trim(), SEARCH_DEBOUNCE_MS)
  const onFiltersChange = props.onFiltersChange
  useEffect(() => {
    if (props.followedOnly || !onFiltersChange || settled !== query.trim()) return
    const signature = filtersSignature({ query: settled, country, kind, associationType, sector })
    if (signature === incomingFilterSignature || emittedSignatures.current.includes(signature)) return
    emittedSignatures.current.push(signature)
    onFiltersChange({
      query: settled,
      country,
      ownerKind: kind === "all" ? null : kind,
      ...(associationType ? { associationType } : {}),
      ...(sector ? { sector } : {}),
    })
  }, [settled, query, country, kind, associationType, sector, incomingFilterSignature, props.followedOnly, onFiltersChange])
  const updateFilters = (filters: Partial<DirectoryFiltersState>) => setFilterState((current) => ({ ...current, filters: { ...current.filters, ...filters } }))
  const chooseKind = (next: KindFilter) => setFilterState((current) => ({
    ...current,
    filters: {
      ...current.filters,
      kind: next,
      associationType: next === "association" ? current.filters.associationType : null,
      sector: next === "company" ? current.filters.sector : null,
    },
  }))
  const choose = (code: CountryCode) => {
    setFilterState((current) => ({ ...current, filters: { ...current.filters, country: code }, lastCountry: code }))
  }
  const resetFilters = () => setFilterState((current) => ({
    ...current,
    filters: { query: "", country: null, kind: "all", associationType: null, sector: null },
  }))
  const filtersActive = query.trim() !== "" || country !== null || kind !== "all" || associationType !== null || sector !== null
  const options: { id: CountryFilter; label: string }[] = [
    { id: "all", label: t("page.directory.allCountries") },
    ...(lastCountry ? [{ id: lastCountry, label: countryName(lastCountry, locale) }] : []),
  ]

  return (
    <section aria-labelledby={`${ids}-titre`} className="flex min-w-0 flex-col gap-4">
      <div>
        <h2 id={`${ids}-titre`} className="font-display text-xl font-bold">
          {props.followedOnly ? t("pageBrowsing.followedTitle") : t("page.directory.title")}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{props.followedOnly ? t("pageBrowsing.followedLead") : t("page.directory.lead")}</p>
      </div>
      {!props.followedOnly ? <Card className="flex flex-col gap-3 p-4">
        <FilterBar<KindFilter>
          label={t("pageBrowsing.kindLabel")}
          options={[
            { id: "all", label: t("pageBrowsing.allKinds") },
            { id: "association", label: t("pageBrowsing.associations") },
            { id: "company", label: t("pageBrowsing.companies") },
          ]}
          selected={[kind]}
          onToggle={chooseKind}
        />
        {supportsCategories && kind === "association" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-association`} className="text-sm font-semibold">{t("pageDirectoryCategories.associationLabel")}</label>
            <select
              id={`${ids}-association`}
              value={associationType ?? ""}
              onChange={(event) => updateFilters({ associationType: ASSOCIATION_TYPES.find((value) => value === event.target.value) ?? null })}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus"
            >
              <option value="">{t("pageDirectoryCategories.allAssociations")}</option>
              {ASSOCIATION_TYPES.map((value) => <option key={value} value={value}>{t(`association.type.${value}`)}</option>)}
            </select>
          </div>
        ) : supportsCategories && kind === "company" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${ids}-secteur`} className="text-sm font-semibold">{t("pageDirectoryCategories.sectorLabel")}</label>
            <select
              id={`${ids}-secteur`}
              value={sector ?? ""}
              onChange={(event) => updateFilters({ sector: COMPANY_SECTORS.find((value) => value === event.target.value) ?? null })}
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-[15px] focus-visible:shadow-focus"
            >
              <option value="">{t("pageDirectoryCategories.allSectors")}</option>
              {COMPANY_SECTORS.map((value) => <option key={value} value={value}>{t(`company.sector.${value}`)}</option>)}
            </select>
          </div>
        ) : null}
        <div role="search" className="relative">
          <label htmlFor={`${ids}-q`} className="sr-only">
            {t("page.directory.searchLabel")}
          </label>
          <SearchIcon aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={`${ids}-q`}
            type="search"
            maxLength={200}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="search"
            placeholder={t("page.directory.searchPlaceholder")}
            aria-describedby={`${ids}-aide`}
            value={query}
            onChange={(event) => updateFilters({ query: event.target.value })}
            className="pl-9"
          />
        </div>
        <p id={`${ids}-aide`} className="text-[13px] text-muted-foreground">
          {t("page.directory.searchHint", { min: PAGE_DIRECTORY_QUERY_MIN_LENGTH })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <FilterBar
            className="min-w-0 flex-1"
            label={t("page.directory.countryLabel")}
            options={options}
            selected={[country ?? "all"]}
            onToggle={(id) => updateFilters({ country: id === "all" ? null : id })}
          />
          <CountrySwitch
            value={country}
            onChange={choose}
            openCountries={open.status === "ready" ? open.data.map((item) => item.country) : []}
            title={t("page.directory.chooseCountryTitle")}
            description={t("page.directory.chooseCountryDescription")}
            rememberKey="diasporale:pages:recents"
            trigger={
              <Button variant="ghost">
                <ListFilterIcon aria-hidden />
                {t("page.directory.chooseCountry")}
              </Button>
            }
          />
        </div>
        {filtersActive ? <Button variant="ghost" className="self-start" onClick={resetFilters}>{t("pageDirectoryCategories.reset")}</Button> : null}
      </Card> : null}
      {/* Une recherche neuve repart de la première fenêtre : aucun curseur d'une autre recherche. */}
      <DirectoryPages key={JSON.stringify([props.source.kind, readerId, props.followedOnly, settled, country, kind, associationType, sector])}
        capability={props.capability} query={props.followedOnly ? "" : settled} country={props.followedOnly ? null : country}
        ownerKind={props.followedOnly || kind === "all" ? null : kind} followedOnly={props.followedOnly === true}
        associationType={associationType} sector={sector} onResetFilters={resetFilters} />
    </section>
  )
}

/** Un code reçu qui n'est pas fermé se dit « erreur inconnue », jamais tel quel. */
function closedCode(code: string): ErrorCode {
  return ERROR_CODES.has(code as ErrorCode) ? (code as ErrorCode) : "unknown"
}

interface MountError {
  readonly code: ErrorCode
  readonly retry?: PagesRetry
}

function DirectoryPages(props: {
  capability: PagesCapability
  query: string
  country: CountryCode | null
  ownerKind: "association" | "company" | null
  associationType: AssociationType | null
  sector: CompanySector | null
  followedOnly: boolean
  onResetFilters: () => void
}) {
  const { t } = useDiasporaleT()
  const ids = useId()
  const [pages, setPages] = useState<CursorPagesState<PageDirectoryEntry>>(() => initialCursorPages<PageDirectoryEntry>())
  const [errors, setErrors] = useState<Readonly<Record<number, MountError | null>>>({})
  const [retrying, setRetrying] = useState(false)
  const active = useRef(false)
  useLayoutEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const report = useCallback((mount: CursorPageMount, snapshot: CursorPageSnapshot<PageDirectoryEntry>, error: MountError | null) => {
    setPages((current) => recordCursorPage(current, mount, snapshot))
    setErrors((current) => (current[mount.id] === error ? current : { ...current, [mount.id]: error }))
  }, [])

  const items = mergedCursorRows(pages, (row) => row.id)
  const error = pages.mounts.map((mount) => errors[mount.id] ?? null).find((value) => value !== null) ?? null
  const last = pages.mounts[pages.mounts.length - 1]
  const current = last ? pages.pages[last.id] : undefined
  const initialLoading = pages.pages[0]?.data === undefined && error === null
  const loadingMore = pages.mounts.length > 1 && (!current?.data || current.isPending) && !current?.isError
  const hasMore = nextCursor(pages) !== null
  const searching = props.query.length >= PAGE_DIRECTORY_QUERY_MIN_LENGTH
  const empty = items.length === 0 && !initialLoading && error === null && !hasMore && !loadingMore

  const retry = async () => {
    const again = error?.retry
    if (!again || retrying) return
    setRetrying(true)
    try {
      await again()
    } catch {
      // La fenêtre garde son erreur traduite.
    } finally {
      if (active.current) setRetrying(false)
    }
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={initialLoading || loadingMore}>
      {pages.mounts.map((mount) => (
        <DirectoryQueryPage key={mount.id} mount={mount} capability={props.capability} query={props.query} country={props.country} ownerKind={props.ownerKind}
          associationType={props.associationType} sector={props.sector} followedOnly={props.followedOnly} report={report} />
      ))}
      <h3 id={`${ids}-resultats`} className="sr-only">
        {t("page.directory.resultsLabel")}
      </h3>
      {initialLoading ? (
        <div role="status" className="grid gap-3 sm:grid-cols-2">
          <span className="sr-only">{t("common.pleaseWait")}</span>
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      ) : null}
      {error !== null ? (
        <Card role="alert" className="flex flex-col items-start gap-3 p-4">
          <div>
            <p className="font-semibold">{t("page.directory.errorTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t(`errors.${error.code}`)}</p>
          </div>
          {error.retry ? (
            <Button variant="outline" disabled={retrying} aria-busy={retrying} onClick={() => void retry()}>
              {t("page.directory.retry")}
            </Button>
          ) : null}
        </Card>
      ) : null}
      {empty ? (
        props.followedOnly ? (
          <EmptyState icon={<Building2Icon />} title={t("pageBrowsing.followedEmptyTitle")} description={t("pageBrowsing.followedEmptyBody")}
            action={<Button asChild variant="outline"><NextLink href={routes.pages()}>{t("pageBrowsing.browse")}</NextLink></Button>} />
        ) : props.associationType !== null || props.sector !== null ? (
          <EmptyState icon={<Building2Icon />} title={t("pageDirectoryCategories.emptyTitle")} description={t("pageDirectoryCategories.emptyBody")}
            action={<Button variant="outline" onClick={props.onResetFilters}>{t("pageDirectoryCategories.reset")}</Button>} />
        ) : searching ? (
          <EmptyState icon={<SearchIcon />} title={t("page.directory.noMatchTitle", { query: props.query })} description={t("page.directory.noMatchBody")} />
        ) : (
          <EmptyState icon={<Building2Icon />} title={t("page.directory.emptyTitle")} description={t("page.directory.emptyBody")} />
        )
      ) : null}
      {items.length > 0 ? (
        <>
          <p role="status" className="sr-only">
            {t("page.directory.count", { count: items.length })}
          </p>
          <ul aria-labelledby={`${ids}-resultats`} className="grid gap-3 sm:grid-cols-2">
            {items.map((page) => (
              <DirectoryCard key={page.id} page={page} {...(props.followedOnly ? { followingCapability: props.capability } : {})} />
            ))}
          </ul>
        </>
      ) : null}
      {hasMore || loadingMore ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={loadingMore || error !== null}
          aria-busy={loadingMore}
          onClick={() => setPages((state) => appendCursorPage(state))}
        >
          {t(loadingMore ? "page.directory.loadingMore" : "page.directory.loadMore")}
        </Button>
      ) : null}
    </div>
  )
}

/** Une fenêtre de l'annuaire : elle lit, puis rend compte à la chaîne des fenêtres. */
function DirectoryQueryPage(props: {
  mount: CursorPageMount
  capability: PagesCapability
  query: string
  country: CountryCode | null
  ownerKind: "association" | "company" | null
  associationType: AssociationType | null
  sector: CompanySector | null
  followedOnly: boolean
  report: (mount: CursorPageMount, snapshot: CursorPageSnapshot<PageDirectoryEntry>, error: MountError | null) => void
}) {
  return props.followedOnly ? <FollowedQueryPage {...props} /> : <DiscoverQueryPage {...props} />
}

type QueryPageProps = Parameters<typeof DirectoryQueryPage>[0]

function FollowedQueryPage(props: QueryPageProps) {
  const useFollowedPages = props.capability.useFollowedPages
  if (!useFollowedPages) return null
  return <FollowedQueryRead {...props} read={useFollowedPages} />
}

function FollowedQueryRead(props: QueryPageProps & { read: NonNullable<PagesCapability["useFollowedPages"]> }) {
  const result = props.read({ cursor: props.mount.cursor })
  return <DirectoryQueryReport {...props} result={result} />
}

function DiscoverQueryPage(props: QueryPageProps) {
  const supportsCategories = props.capability.supportsDirectoryCategories === true
  const result = props.capability.useDirectory({
    query: props.query,
    cursor: props.mount.cursor,
    ...(props.country ? { country: props.country } : {}),
    ...(props.ownerKind ? { ownerKind: props.ownerKind } : {}),
    ...(supportsCategories && props.ownerKind === "association" && props.associationType ? { associationType: props.associationType } : {}),
    ...(supportsCategories && props.ownerKind === "company" && props.sector ? { sector: props.sector } : {}),
  })
  return <DirectoryQueryReport {...props} result={result} />
}

function DirectoryQueryReport(props: QueryPageProps & { result: ReturnType<PagesCapability["useDirectory"]> }) {
  const { mount, report } = props
  const { result } = props
  const ready = result.status === "ready" ? result.data : undefined
  // La fenêtre ne change que si son contenu change : un fournisseur qui rend un objet neuf
  // de même contenu à chaque rendu ne relance pas la chaîne des fenêtres.
  const content = ready === undefined ? null : JSON.stringify(ready)
  const data = useMemo(() => {
    if (content === null) return undefined
    const page = JSON.parse(content) as PageDirectoryPage
    return { page: page.items, isDone: page.isDone, continueCursor: page.continueCursor ?? "" }
  }, [content])
  const errorCode = result.status === "error" ? closedCode(result.code) : null
  // La reprise passe par une référence : une fonction neuve à chaque rendu ne relance pas la chaîne.
  const retryRef = useRef(result.retry)
  useLayoutEffect(() => {
    retryRef.current = result.retry
  })
  const hasRetry = result.retry !== undefined
  const retry = useCallback(() => retryRef.current?.(), [])
  const error = useMemo<MountError | null>(() => (errorCode === null ? null : { code: errorCode, ...(hasRetry ? { retry } : {}) }), [errorCode, hasRetry, retry])
  const isPending = result.status === "loading"
  useLayoutEffect(() => {
    report(mount, { data, isPending, isError: error !== null }, error)
  }, [mount, data, isPending, error, report])
  return null
}

function DirectoryCard(props: { page: PageDirectoryEntry; followingCapability?: PagesCapability }) {
  const { t } = useDiasporaleT()
  const { page } = props
  const kindLabel =
    page.ownerKind === "association" && page.associationType
      ? t(`association.type.${page.associationType}`)
      : page.ownerKind === "company" && page.sector
        ? t(`company.sector.${page.sector}`)
        : t(`page.kind.${page.ownerKind}`)
  return (
    <li className="min-w-0">
      <Card className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar id={page.id} name={page.name} shape={page.ownerKind === "association" ? "round" : "square"} size="lg" />
          <div className="min-w-0 flex-1">
            <h4 className="break-words font-semibold leading-snug text-foreground">{page.name}</h4>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-[var(--radius-xs)] bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{kindLabel}</span>
              <TrustBadge badge={page.badge} />
              {page.following ? (
                <span className="rounded-[var(--radius-xs)] bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-foreground">{t("page.directory.following")}</span>
              ) : null}
            </div>
          </div>
        </div>
        {page.description ? <p className="line-clamp-2 break-words text-[13px] leading-snug text-muted-foreground">{page.description}</p> : null}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          {page.country ? <CountryTag country={page.country} city={page.city ?? undefined} /> : <span />}
          <NextLink
            href={routes.page(page.handle)}
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm font-semibold text-primary hover:bg-muted focus-visible:shadow-focus"
          >
            {t("page.see")}
            <span className="sr-only">{page.name}</span>
            <ArrowRightIcon className="size-4" aria-hidden />
          </NextLink>
          {props.followingCapability ? <UnfollowPage page={page} capability={props.followingCapability} /> : null}
        </div>
      </Card>
    </li>
  )
}

function UnfollowPage(props: { page: PageDirectoryEntry; capability: PagesCapability }) {
  const { t } = useDiasporaleT()
  const [busy, setBusy] = useState(false)
  const locked = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const unfollow = async () => {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    try {
      const result = await props.capability.unfollow(props.page.handle)
      if (!mounted.current) return
      if (!result.ok) toast.error(t(`errors.${result.code}`))
      else toast.success(t("page.unfollowed", { name: props.page.name }))
    } catch {
      if (mounted.current) toast.error(t("errors.unknown"))
    } finally {
      locked.current = false
      if (mounted.current) setBusy(false)
    }
  }
  return <Button variant="ghost" size="sm" className="min-h-11" disabled={busy} aria-busy={busy} aria-label={t("pageBrowsing.unfollowLabel", { name: props.page.name })} onClick={() => void unfollow()}>{t("pageBrowsing.unfollow")}</Button>
}
