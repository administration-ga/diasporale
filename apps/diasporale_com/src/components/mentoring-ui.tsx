"use client"

/**
 * Briques d'écran du mentorat (DG-024, troisième tranche) : la carte d'un mentor
 * (carte C9 de la charte, badges de confiance, langues), l'état d'une demande,
 * l'état de modération montré à qui gère (G9), un créneau avec son fuseau, la
 * liste paginée et l'état « indisponible ». PROPRIÉTAIRE : chantier « mentorat ».
 *
 * Les heures sont toujours affichées avec le FUSEAU dans lequel elles ont été
 * pensées et, s'il diffère, avec l'heure du lecteur (règles des demandes de
 * service, `service-request-ui`).
 */
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
import type { MentoringRequestStatus, MentoringSlot } from "@diasporale/domain"
import { Button, Card, MentorCard, ModerationBanner, Skeleton, TrustBadges } from "@diasporale/features"
import {
  moderationBannerState,
  type ActionErrorCode,
  type Loadable,
  type ManagedModerationState,
  type MentorCardView,
  type MentoringPage,
  type MentorView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import NextLink from "next/link"
import { useCallback, useLayoutEffect, useState, type ReactNode } from "react"

import { languageList } from "@/components/service-format"
import { formatServiceSlot } from "@/components/service-request-ui"
import { routes } from "@/lib/routes"

/** La capacité n'est pas servie par ce fournisseur : l'écran le dit au lieu d'inventer. */
export function MentoringUnavailable() {
  const { t } = useDiasporaleT()
  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="font-semibold">{t("mentoring.unavailableTitle")}</p>
      <p className="text-sm text-muted-foreground">{t("mentoring.unavailableBody")}</p>
    </Card>
  )
}

/** Le rappel du bénévolat : aucun tarif, aucun paiement, aucune coordonnée. */
export function MentoringVolunteerNote() {
  const { t } = useDiasporaleT()
  return <p className="rounded-lg bg-muted px-3 py-2 text-[13px]">{t("mentoring.volunteer")}</p>
}

/** La carte C9 d'un mentor (badge « Mentor », domaines, pays et ville visibles), ses badges et ses langues. */
export function MentorSummary(props: { readonly mentor: MentorCardView }) {
  const { t, locale } = useDiasporaleT()
  const { mentor } = props
  const view: MentorView = {
    personId: mentor.personId,
    shortName: mentor.displayName,
    city: mentor.city,
    country: mentor.country,
    domains: mentor.domains,
    arrivedAt: mentor.arrivedAt,
  }
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <MentorCard mentor={view} />
      {mentor.badges.length > 0 || mentor.languages.length > 0 ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2 px-1">
          {mentor.badges.length > 0 ? <TrustBadges badges={mentor.badges} size="sm" /> : null}
          {mentor.languages.length > 0 ? (
            <span className="break-words text-[13px] text-muted-foreground">{t("mentoring.card.languages", { languages: languageList(mentor.languages, locale) })}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** Un mentor dans les résultats : sa carte, son état de disponibilité, le lien vers sa fiche. */
export function MentorResultCard(props: { readonly mentor: MentorCardView }) {
  const { t } = useDiasporaleT()
  const { mentor } = props
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <MentorSummary mentor={mentor} />
      <div className="flex min-w-0 flex-wrap items-center gap-2 px-1">
        {mentor.acceptsRequests ? null : <span className="text-[13px] font-medium">{t("mentoring.card.full")}</span>}
        <Button asChild variant="outline" size="sm" className="min-h-11">
          <NextLink href={routes.mentorProfile(mentor.mentorId)}>{t("mentoring.card.open", { name: mentor.displayName })}</NextLink>
        </Button>
      </div>
    </div>
  )
}

/**
 * L'état de modération d'un contenu du mentorat (G9), montré à qui le GÈRE : le mentor pour son
 * profil, le mentoré pour sa demande — le fournisseur ne le sert à personne d'autre. Publié, ou
 * état absent : rien. Retiré : l'avis, puis ce que le retrait change (`removed`, déjà traduit).
 */
export function MentoringModerationNotice(props: { readonly state: ManagedModerationState | undefined; readonly removed: string }) {
  const banner = moderationBannerState(props.state)
  if (banner === null) return null
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <ModerationBanner state={banner} />
      {banner === "rejected" ? <p className="text-[13px] text-muted-foreground">{props.removed}</p> : null}
    </div>
  )
}

export function MentoringStatusBadge(props: { readonly status: MentoringRequestStatus }) {
  const { t } = useDiasporaleT()
  return (
    <span data-status={props.status} className="inline-flex shrink-0 items-center rounded-full bg-muted px-2.5 py-0.5 text-[13px] font-medium text-foreground">
      {t(`mentoring.status.${props.status}`)}
    </span>
  )
}

/** Un créneau, son fuseau et, si le lecteur vit ailleurs, son heure à lui. */
export function MentoringSlotText(props: { readonly slot: MentoringSlot; readonly timeZone: string; readonly viewerTimeZone: string }) {
  const { t, locale } = useDiasporaleT()
  const local = props.viewerTimeZone !== props.timeZone
  return (
    <span className="flex min-w-0 flex-col">
      <span className="break-words">{t("mentoring.time.inZone", { slot: formatServiceSlot(props.slot, props.timeZone, locale), zone: props.timeZone })}</span>
      {local ? (
        <span className="break-words text-[13px] text-muted-foreground">
          {t("mentoring.time.yours", { slot: formatServiceSlot(props.slot, props.viewerTimeZone, locale), zone: props.viewerTimeZone })}
        </span>
      ) : null}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════
// Liste paginée
// ═══════════════════════════════════════════════════════════════

/** Un refus d'accès retire aussi les lignes déjà lues : aucun cache ne survit à un refus. */
const ACCESS_ERRORS: ReadonlySet<string> = new Set(["not_signed_in", "not_member", "not_found", "status_insufficient", "suspended", "network_unavailable"])

type Read<Row> = (cursor: string | null) => Loadable<MentoringPage<Row>>

function snapshotOf<Row>(loadable: Loadable<MentoringPage<Row>>): CursorPageSnapshot<Row> {
  if (loadable.status === "ready") {
    const { items, isDone, continueCursor } = loadable.data
    // Le curseur terminal peut être nul ; une suite exige son curseur opaque.
    if (!isDone && (continueCursor === null || continueCursor.length === 0)) return { data: undefined, isPending: false, isError: true }
    return { data: { page: items, isDone, continueCursor: continueCursor ?? "" }, isPending: false, isError: false }
  }
  return { data: undefined, isPending: loadable.status === "loading", isError: loadable.status === "error" }
}

function WindowReader<Row>(props: {
  readonly mount: CursorPageMount
  readonly read: Read<Row>
  readonly report: (mount: CursorPageMount, snapshot: CursorPageSnapshot<Row>, error: ActionErrorCode | null) => void
}) {
  const { mount, read, report } = props
  const loadable = read(mount.cursor)
  // Le fournisseur rend la même référence tant que rien ne change : un rapport par réponse.
  useLayoutEffect(() => {
    const snapshot = snapshotOf(loadable)
    const error = loadable.status === "error" ? (loadable.code as ActionErrorCode) : snapshot.isError ? "unknown" : null
    report(mount, snapshot, error)
  }, [mount, loadable, report])
  return null
}

interface PagerState<Row> {
  readonly pages: CursorPagesState<Row>
  readonly errors: Readonly<Record<number, ActionErrorCode | null>>
}

/**
 * Les fenêtres d'une liste (mentors, demandes) : une lecture par fenêtre,
 * chacune abonnée à son curseur opaque ; « Afficher plus » monte la suivante.
 * Une ligne présente dans deux fenêtres ne s'affiche qu'une fois.
 */
export function MentoringPager<Row>(props: {
  /** Lit UNE fenêtre (un hook du fournisseur) : toujours la même fonction pour une même liste. */
  readonly read: Read<Row>
  readonly keyOf: (row: Row) => string
  readonly children: (rows: readonly Row[]) => ReactNode
  readonly empty: ReactNode
}) {
  const { t } = useDiasporaleT()
  const [generation, setGeneration] = useState(0)
  const [state, setState] = useState<PagerState<Row>>(() => ({ pages: initialCursorPages<Row>(), errors: {} }))
  const report = useCallback((mount: CursorPageMount, snapshot: CursorPageSnapshot<Row>, error: ActionErrorCode | null) => {
    setState((current) => {
      const pages = recordCursorPage(current.pages, mount, snapshot)
      if (pages === current.pages && (current.errors[mount.id] ?? null) === error) return current
      return { pages, errors: { ...current.errors, [mount.id]: error } }
    })
  }, [])
  const { pages, errors } = state
  const error = pages.mounts.map((mount) => errors[mount.id] ?? null).find((code) => code !== null) ?? null
  const rows = error !== null && ACCESS_ERRORS.has(error) ? [] : mergedCursorRows(pages, props.keyOf)
  const last = pages.pages[pages.mounts[pages.mounts.length - 1]?.id ?? 0]
  const initialLoading = pages.pages[0]?.data === undefined && error === null
  const loadingMore = pages.mounts.length > 1 && (!last?.data || last.isPending) && !last?.isError
  const hasMore = nextCursor(pages) !== null
  const empty = rows.length === 0 && !initialLoading && error === null && !hasMore && !loadingMore
  const retry = () => {
    setState((current) => ({ ...current, errors: {} }))
    setGeneration((value) => value + 1)
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {pages.mounts.map((mount) => (
        <WindowReader key={`${generation}:${mount.id}`} mount={mount} read={props.read} report={report} />
      ))}
      {initialLoading ? <Skeleton className="h-32 w-full rounded-xl" /> : null}
      {error !== null ? (
        <Card role="alert" className="flex flex-col items-start gap-3 p-4">
          <p>{t(`errors.${error}`)}</p>
          <Button variant="outline" onClick={retry}>{t("mentoring.list.retry")}</Button>
        </Card>
      ) : null}
      {empty ? props.empty : null}
      {rows.length > 0 ? props.children(rows) : null}
      {hasMore || loadingMore ? (
        <Button
          variant="outline"
          className="self-start"
          disabled={loadingMore || error !== null}
          aria-busy={loadingMore}
          onClick={() => setState((current) => ({ ...current, pages: appendCursorPage(current.pages) }))}
        >
          {t(loadingMore ? "mentoring.list.loadingMore" : "mentoring.list.loadMore")}
        </Button>
      ) : null}
    </div>
  )
}
