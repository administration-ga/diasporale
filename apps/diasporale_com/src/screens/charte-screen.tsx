"use client"

import type { TrustBadge as TrustBadgeKind } from "@diasporale/domain"
import {
  AssociationCard,
  Button,
  Card,
  Checkbox,
  ClassifiedCard,
  CommunityTabSwitcher,
  CompanyCard,
  ContactButton,
  ContentScopeTag,
  CountryMonument,
  CountryTag,
  DemoBanner,
  DemoChip,
  EmptyState,
  EventCard,
  Field,
  FilterBar,
  FolderTabs,
  FolderTabsContent,
  GroupCard,
  Input,
  JobCard,
  Label,
  MembershipStatusBanner,
  MentorCard,
  ModerationBanner,
  PostCard,
  RadioCard,
  RadioGroup,
  ScopeTag,
  SponsoredBadge,
  SponsoredSlot,
  StatCounter,
  Switch,
  TalentCard,
  TrustBadges,
  cn,
  type StatusBannerActions,
} from "@diasporale/features"
import type {
  ClassifiedView,
  EventView,
  GroupView,
  JobView,
  MentorView,
  PageView,
  PostView,
  TalentView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { CalendarDaysIcon, PlayIcon, RotateCcwIcon } from "lucide-react"
import NextLink from "next/link"
import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react"

import { showFloatingCard } from "@/components/floating-cards"
import { ThemeSwitch } from "@/components/preferences"
import { PublicShell, floatingLinkClass } from "@/components/site-chrome"
import { contrastLevel, contrastRatio, type ContrastLevel } from "@/lib/contrast"
import { routes } from "@/lib/routes"

/**
 * `/charte` — la charte « Sable de la diaspora », version 2 (15/10/2026) : chaque
 * composant de `@diasporale/features` monté avec des données d'EXEMPLE (fictives),
 * pour la relecture `web-design-guidelines` et la vérification réelle (320 px,
 * 375 px, 1 280 px, clair et sombre). Les contrastes sont MESURÉS sur la page,
 * dans le thème affiché ; aucun autre chiffre réel n'y figure.
 */

/** Instant de référence des exemples : fixe, pour que le rendu serveur et le rendu client disent la même heure. */
const SAMPLE_NOW = Date.UTC(2026, 9, 15, 9, 0)
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

const SECTIONS = {
  color: { id: "couleur", title: "charte.section.color.title", lead: "charte.section.color.lead" },
  contrast: { id: "contraste", title: "charte.section.contrast.title", lead: "charte.section.contrast.lead" },
  type: { id: "typographie", title: "charte.section.type.title", lead: "charte.section.type.lead" },
  shape: { id: "geometrie", title: "charte.section.shape.title", lead: "charte.section.shape.lead" },
  tag: { id: "etiquette", title: "charte.section.tag.title", lead: "charte.section.tag.lead" },
  trust: { id: "confiance", title: "charte.section.trust.title", lead: "charte.section.trust.lead" },
  notices: { id: "cartes-flottantes", title: "charte.section.notices.title", lead: "charte.section.notices.lead" },
  cards: { id: "cartes", title: "charte.section.cards.title", lead: "charte.section.cards.lead" },
  controls: { id: "commandes", title: "charte.section.controls.title", lead: "charte.section.controls.lead" },
} as const

type SectionSpec = (typeof SECTIONS)[keyof typeof SECTIONS]

/** Les six couleurs nommées : des primitives, identiques dans les deux thèmes. */
const SWATCHES = [
  { token: "--esp-neutral-100", name: "charte.swatch.sable.name", role: "charte.swatch.sable.role", tile: "bg-[var(--esp-neutral-100)] text-[var(--esp-neutral-900)]" },
  { token: "--esp-neutral-0", name: "charte.swatch.papier.name", role: "charte.swatch.papier.role", tile: "bg-[var(--esp-neutral-0)] text-[var(--esp-neutral-900)]" },
  { token: "--esp-neutral-900", name: "charte.swatch.encre.name", role: "charte.swatch.encre.role", tile: "bg-[var(--esp-neutral-900)] text-[var(--esp-neutral-100)]" },
  { token: "--esp-night-bg", name: "charte.swatch.nuit.name", role: "charte.swatch.nuit.role", tile: "bg-[var(--esp-night-bg)] text-[var(--esp-neutral-200)]" },
  { token: "--esp-blue-500", name: "charte.swatch.bleu.name", role: "charte.swatch.bleu.role", tile: "bg-[var(--esp-blue-500)] text-[var(--esp-neutral-0)]" },
  { token: "--esp-neutral-600", name: "charte.swatch.gres.name", role: "charte.swatch.gres.role", tile: "bg-[var(--esp-neutral-600)] text-[var(--esp-neutral-100)]" },
] as const

/** Les paires que la charte s'engage à tenir, mesurées sur les rôles du thème affiché. */
const CONTRAST_ROWS = [
  { label: "charte.contrast.row.textBackground", fg: "--foreground", bg: "--background", kind: "text", sample: "bg-background text-foreground" },
  { label: "charte.contrast.row.textCard", fg: "--card-foreground", bg: "--card", kind: "text", sample: "bg-card text-card-foreground" },
  { label: "charte.contrast.row.mutedCard", fg: "--muted-foreground", bg: "--card", kind: "text", sample: "bg-card text-muted-foreground" },
  { label: "charte.contrast.row.mutedBackground", fg: "--muted-foreground", bg: "--background", kind: "text", sample: "bg-background text-muted-foreground" },
  { label: "charte.contrast.row.faintCard", fg: "--ink-500", bg: "--card", kind: "text", sample: "bg-card text-[var(--ink-500)]" },
  { label: "charte.contrast.row.linkCard", fg: "--primary", bg: "--card", kind: "text", sample: "bg-card text-primary" },
  { label: "charte.contrast.row.linkBackground", fg: "--primary", bg: "--background", kind: "text", sample: "bg-background text-primary" },
  { label: "charte.contrast.row.primaryButton", fg: "--primary-foreground", bg: "--primary", kind: "text", sample: "bg-primary text-primary-foreground" },
  { label: "charte.contrast.row.fieldEdge", fg: "--input", bg: "--card", kind: "component", sample: "bg-card" },
] as const

const LEVELS: Record<ContrastLevel, { label: string; className: string }> = {
  aaa: { label: "charte.contrast.levelAaa", className: "bg-published text-published-foreground" },
  aa: { label: "charte.contrast.levelAa", className: "bg-published text-published-foreground" },
  component: { label: "charte.contrast.levelComponent", className: "bg-published text-published-foreground" },
  fail: { label: "charte.contrast.levelFail", className: "bg-rejected text-rejected-foreground" },
}

const TYPE_ROWS = [
  { role: "charte.type.display.role", spec: "charte.type.display.spec", sample: "charte.type.display.sample", className: "font-display text-[40px] font-bold leading-[1.1] tracking-[-0.01em]" },
  { role: "charte.type.title.role", spec: "charte.type.title.spec", sample: "charte.type.title.sample", className: "text-xl font-semibold leading-[1.3] tracking-[-0.01em]" },
  { role: "charte.type.subtitle.role", spec: "charte.type.subtitle.spec", sample: "charte.type.subtitle.sample", className: "text-[17px] font-semibold leading-snug" },
  { role: "charte.type.body.role", spec: "charte.type.body.spec", sample: "charte.type.body.sample", className: "max-w-prose text-[15px] leading-[1.55]" },
  { role: "charte.type.caption.role", spec: "charte.type.caption.spec", sample: "charte.type.caption.sample", className: "text-[13px] text-muted-foreground" },
  { role: "charte.type.code.role", spec: "charte.type.code.spec", sample: "charte.type.code.sample", className: "font-mono text-[11px] font-semibold uppercase tracking-[0.06em]" },
] as const

const RADII = [
  { value: "charte.shape.badge.value", use: "charte.shape.badge.use", radius: "rounded-[var(--radius-xs)]" },
  { value: "charte.shape.control.value", use: "charte.shape.control.use", radius: "rounded-md" },
  { value: "charte.shape.card.value", use: "charte.shape.card.use", radius: "rounded-xl" },
  { value: "charte.shape.panel.value", use: "charte.shape.panel.use", radius: "rounded-2xl" },
  { value: "charte.shape.pill.value", use: "charte.shape.pill.use", radius: "rounded-[var(--esp-r-chrome)]" },
] as const

/** Les jetons relus sur la page : ceux des paires de contraste et des six couleurs. */
const MEASURED_TOKENS = [...new Set([...CONTRAST_ROWS.flatMap((row) => [row.fg, row.bg]), ...SWATCHES.map((swatch) => swatch.token)])]

function subscribeToTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-charte"] })
  return () => observer.disconnect()
}

function readRenderedTokens(): string {
  const root = document.documentElement
  const style = getComputedStyle(root)
  return [root.classList.contains("dark") ? "dark" : "light", ...MEASURED_TOKENS.map((token) => style.getPropertyValue(token).trim())].join("|")
}

/** Les jetons tels que la page les rend, relus à chaque changement de thème ; `null` avant le premier rendu client. */
function useRenderedTokens(): { dark: boolean; value: (token: string) => string } | null {
  const snapshot = useSyncExternalStore(subscribeToTheme, readRenderedTokens, () => "")
  return useMemo(() => {
    if (snapshot === "") return null
    const [mode, ...values] = snapshot.split("|")
    const byToken = new Map<string, string>(MEASURED_TOKENS.map((token, index) => [token, values[index] ?? ""]))
    return { dark: mode === "dark", value: (token: string) => byToken.get(token) ?? "" }
  }, [snapshot])
}

export function CharteScreen() {
  const { t, locale } = useDiasporaleT()
  const tokens = useRenderedTokens()
  const [filters, setFilters] = useState<readonly string[]>(["celebration"])
  const [noticeRound, setNoticeRound] = useState(0)
  const ratioFormat = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), [locale])
  const now = SAMPLE_NOW

  const page = (id: string, name: string, extra: Partial<PageView>): PageView => ({
    id,
    handle: id,
    name,
    ownerKind: "association",
    trust: "community",
    badge: "community",
    country: "FR",
    city: t("charte.sample.cityLyon"),
    description: t("charte.sample.description"),
    followers: 0,
    claimable: false,
    ...extra,
  })
  const organizer = { kind: "page" as const, id: "asso", handle: "asso", displayName: t("charte.sample.association"), badges: ["verified"] as TrustBadgeKind[] }
  const event = (id: string, extra: Partial<EventView>): EventView => ({
    id,
    title: t("charte.sample.eventTitle"),
    startsAt: now + 12 * DAY,
    city: t("charte.sample.cityLyon"),
    scope: { reach: "local", country: "FR" },
    category: "celebration",
    organizer,
    capacity: 150,
    registered: 84,
    moderation: "published",
    ...extra,
  })
  const post: PostView = {
    id: "post",
    author: { kind: "person", id: "awa", handle: "awa.ogooue", displayName: t("charte.sample.person"), badges: ["verified"] },
    body: t("charte.sample.postBody"),
    media: [],
    scope: { reach: "diaspora", country: "CA" },
    audience: "public",
    visibility: "root",
    moderation: "published",
    createdAt: now - 5 * HOUR,
    reactionCount: 12,
    commentCount: 3,
    myReaction: null,
    isMine: false,
    bookmarked: false,
    edited: false,
  }
  const myPost: PostView = {
    ...post,
    id: "post-a-relire",
    author: { kind: "person", id: "moi", handle: "moi", displayName: t("charte.sample.shortName"), badges: ["community"] },
    body: t("charte.sample.postMine"),
    scope: { reach: "local", country: "FR" },
    visibility: "network",
    moderation: "pending_review",
    createdAt: now - 20 * 60 * 1000,
    reactionCount: 0,
    commentCount: 0,
    isMine: true,
    bookmarked: false,
    edited: false,
  }
  const job: JobView = {
    id: "job",
    title: t("charte.sample.jobTitle"),
    employer: { id: "saveurs", name: t("charte.sample.company"), badge: "verified" },
    contract: "cdi",
    city: t("charte.sample.cityParis"),
    scope: { reach: "local", country: "FR" },
    salary: null,
    publishedAt: now - 2 * DAY,
    sponsored: false,
    filled: false,
  }
  const classified: ClassifiedView = {
    id: "annonce",
    title: t("charte.sample.classifiedTitle"),
    category: "parcel",
    price: null,
    city: t("charte.sample.cityParis"),
    country: "FR",
    seller: { displayName: t("charte.sample.person"), badges: ["verified"] },
    publishedAt: now - DAY,
  }
  const talent: TalentView = {
    personId: "talent",
    shortName: t("charte.sample.shortName"),
    title: t("charte.sample.talentTitle"),
    skills: [t("charte.sample.skill1"), t("charte.sample.skill2"), t("charte.sample.skill3")],
    languages: ["fr", "en"],
    city: t("charte.sample.cityMontreal"),
    country: "CA",
    badges: ["verified"],
  }
  const group: GroupView = {
    id: "groupe",
    name: t("charte.sample.groupName"),
    scope: { reach: "local", country: "FR" },
    memberCount: 128,
    lastMessage: t("charte.sample.groupMessage"),
    unread: 3,
    private: true,
  }
  const mentor: MentorView = {
    personId: "mentor",
    shortName: t("charte.sample.shortName"),
    city: t("charte.sample.cityLyon"),
    country: "FR",
    domains: ["housing", "studies"],
    arrivedAt: 2016,
  }
  const statusActions: StatusBannerActions = {
    verifyConsular: (
      <NextLink href={routes.attestation()} className={floatingLinkClass}>
        {t("status.verifyConsular")}
      </NextLink>
    ),
    sponsorHelp: (
      <NextLink href={routes.sponsorHelp()} className={floatingLinkClass}>
        {t("status.sponsorHelp")}
      </NextLink>
    ),
  }
  const showInPlace = () =>
    showFloatingCard("charte-en-situation", (dismiss) => (
      <MembershipStatusBanner status="en_attente" badges={["community"]} actions={statusActions} onDismiss={dismiss} />
    ))

  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-20 px-4 pb-10 pt-6 md:pt-12">
        <header className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex max-w-[44rem] flex-col gap-4">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{t("charte.eyebrow")}</p>
              <h1 className="font-display text-[40px] font-bold leading-[1.05] tracking-[-0.01em] md:text-[56px]">{t("charte.heading")}</h1>
              <p className="text-[17px] leading-relaxed text-muted-foreground">{t("charte.lead")}</p>
            </div>
            <ThemeSwitch />
          </div>
          <nav aria-label={t("charte.tocLabel")} className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
            {Object.values(SECTIONS).map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex min-h-10 shrink-0 items-center rounded-[var(--esp-r-chrome)] bg-[var(--esp-neutral-chip)] px-3.5 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-charte hover:text-foreground focus-visible:shadow-focus"
              >
                {t(section.title)}
              </a>
            ))}
          </nav>
        </header>

        <Section spec={SECTIONS.color}>
          {/* Une scène neutre : le sable, la nuit, le papier et l'encre s'y lisent dans les deux thèmes. */}
          <div className="flex flex-col gap-4 rounded-2xl bg-[var(--esp-neutral-chip)] p-3 sm:p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ThemeMock variant="light" />
              <ThemeMock variant="dark" />
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {SWATCHES.map((swatch) => (
                <li key={swatch.token} className={cn("flex min-h-28 flex-col justify-between gap-3 rounded-xl p-3", swatch.tile)}>
                  <span>
                    <span className="block text-sm font-semibold">{t(swatch.name)}</span>
                    <span className="block text-[13px] leading-snug">{t(swatch.role)}</span>
                  </span>
                  <span translate="no" className="font-mono text-xs font-medium uppercase tracking-[0.04em]">
                    {tokens ? tokens.value(swatch.token) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section spec={SECTIONS.contrast}>
          <Card className="overflow-hidden">
            <table className="w-full text-left text-sm">
              <caption className="px-4 pt-4 text-left text-[13px] text-muted-foreground">
                {tokens ? (tokens.dark ? t("charte.contrast.shownDark") : t("charte.contrast.shownLight")) : t("charte.contrast.measuring")}
              </caption>
              <thead className="text-[13px] text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("charte.contrast.pair")}
                  </th>
                  <th scope="col" className="hidden px-4 py-3 font-medium md:table-cell">
                    {t("charte.contrast.tokens")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    {t("charte.contrast.ratio")}
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    {t("charte.contrast.level")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {CONTRAST_ROWS.map((row) => {
                  const ratio = tokens ? contrastRatio(tokens.value(row.fg), tokens.value(row.bg)) : null
                  const level = ratio === null ? null : LEVELS[contrastLevel(ratio, row.kind)]
                  return (
                    <tr key={row.label}>
                      <th scope="row" className="px-4 py-2.5 font-medium">
                        <span className="flex items-center gap-3">
                          <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-md text-sm font-semibold", row.sample)}>
                            {row.kind === "component" ? <span className="block h-5 w-6 rounded-[var(--radius-xs)] border border-input" /> : t("charte.contrast.sample")}
                          </span>
                          {t(row.label)}
                        </span>
                      </th>
                      <td translate="no" className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground md:table-cell">
                        {row.fg} / {row.bg}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">{ratio === null ? "—" : `${ratioFormat.format(ratio)}:1`}</td>
                      <td className="px-4 py-2.5">
                        {level ? (
                          <span className={cn("inline-flex rounded-[var(--radius-xs)] px-1.5 py-0.5 text-[11px] font-semibold", level.className)}>{t(level.label)}</span>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </Section>

        <Section spec={SECTIONS.type}>
          <div className="flex flex-col gap-8">
            {TYPE_ROWS.map((row) => (
              <div key={row.role} className="grid gap-x-10 gap-y-2 md:grid-cols-[12rem_minmax(0,1fr)] md:items-baseline">
                <div>
                  <p className="text-sm font-semibold">{t(row.role)}</p>
                  <p className="font-mono text-xs text-muted-foreground">{t(row.spec)}</p>
                </div>
                <p className={row.className}>{t(row.sample)}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section spec={SECTIONS.shape}>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {RADII.map((radius) => (
              <li key={radius.value} className="flex flex-col gap-3">
                <span aria-hidden className={cn("block h-16 w-full bg-card shadow-card", radius.radius)} />
                <span>
                  <span className="block font-mono text-sm font-semibold">{t(radius.value)}</span>
                  <span className="block text-[13px] leading-snug text-muted-foreground">{t(radius.use)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="max-w-[60ch] text-[13px] leading-relaxed text-muted-foreground">{t("charte.shape.relief")}</p>
        </Section>

        <Section spec={SECTIONS.tag}>
          <div className="flex flex-wrap items-center gap-3">
            <CountryTag country="FR" city={t("charte.sample.cityLyon")} />
            <CountryTag country="CA" city={t("charte.sample.cityMontreal")} size="md" />
            <CountryTag country="BE" />
            <ScopeTag />
            <ContentScopeTag scope={{ reach: "diaspora", country: "CA" }} hubCountry="FR" />
          </div>
          <Card className="flex flex-col gap-6 p-5 md:p-6">
            <div className="flex items-end gap-4">
              <CountryMonument country="FR" />
              <p className="pb-1 font-display text-3xl font-bold leading-tight">{t("charte.monumentCaption")}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCounter value={{ kind: "below_threshold", threshold: 20 }} label={t("hub.counters.members")} />
              <StatCounter value={{ kind: "value", value: 4 }} label={t("hub.counters.associations")} />
              <StatCounter value={{ kind: "value", value: 2 }} label={t("hub.counters.companies")} />
              <StatCounter value={{ kind: "value", value: 3 }} label={t("hub.counters.events")} />
            </div>
          </Card>
        </Section>

        <Section spec={SECTIONS.trust}>
          <div className="flex flex-col gap-4">
            <TrustBadges badges={["official", "verified", "public_agent", "community"]} size="md" />
            <TrustBadges badges={["official", "verified", "public_agent", "community"]} />
            <SponsoredBadge className="self-start" />
          </div>
        </Section>

        <Section spec={SECTIONS.notices}>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setNoticeRound((round) => round + 1)}>
              <RotateCcwIcon aria-hidden />
              {t("charte.notices.restore")}
            </Button>
            <Button variant="outline" size="sm" onClick={showInPlace}>
              <PlayIcon aria-hidden />
              {t("charte.notices.live")}
            </Button>
            <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
              <DemoChip />
              {t("charte.notices.chip")}
            </span>
          </div>
          {/* Une nouvelle clé remonte les cartes : celles qu'on a écartées reviennent. */}
          <div key={noticeRound} className="grid items-start gap-3 md:grid-cols-2">
            <ModerationBanner state="pending_review" />
            <ModerationBanner state="published" />
            <ModerationBanner state="rejected" reason={t("charte.sample.rejectReason")} />
            <DemoBanner
              action={
                <NextLink href={routes.demo()} className={floatingLinkClass}>
                  {t("demo.accountsLink")}
                </NextLink>
              }
            />
            <MembershipStatusBanner status="en_attente" badges={["community"]} actions={statusActions} />
            <MembershipStatusBanner status="declaree" badges={["community"]} actions={statusActions} />
            <MembershipStatusBanner status="verifiee" badges={["verified"]} />
            <MembershipStatusBanner status="suspendue" badges={["community"]} />
          </div>
        </Section>

        <Section spec={SECTIONS.cards}>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <EventCard event={event("e1", {})} now={now} variant="wide" />
            <EventCard event={event("e2", { registered: 150, title: t("charte.sample.eventFull") })} now={now} />
            <EventCard event={event("e3", { startsAt: now - 20 * DAY, title: t("charte.sample.eventPast") })} now={now} />
            <EventCard event={event("e4", { scope: { reach: "diaspora", country: "FR" }, capacity: null })} now={now} hubCountry="CA" />
            <AssociationCard page={page("asso-v", t("charte.sample.association"), { trust: "verified", badge: "verified", associationType: "cultural" })} />
            <AssociationCard page={page("asso-c", t("charte.sample.associationClaimable"), { claimable: true, associationType: "student" })} />
            <CompanyCard page={page("ent", t("charte.sample.company"), { ownerKind: "company", trust: "verified", badge: "verified", sector: "food" })} />
            <JobCard job={job} now={now} />
            <JobCard job={{ ...job, id: "job-s", sponsored: true }} now={now} />
            <JobCard job={{ ...job, id: "job-f", filled: true }} now={now} />
            <ClassifiedCard item={classified} now={now} />
            <TalentCard talent={talent} />
            <GroupCard group={group} />
            <MentorCard mentor={mentor} />
          </div>
          <div className="grid items-start gap-4 md:grid-cols-2">
            <PostCard post={post} now={now} canReact={false} />
            <PostCard post={myPost} now={now} canReact={false} />
          </div>
        </Section>

        <Section spec={SECTIONS.controls}>
          <Group label={t("charte.controlGroup.filters")}>
            <FilterBar
              label={t("charte.filtersLabel")}
              options={(["celebration", "culture", "sport", "charity", "diplomacy"] as const).map((id) => ({ id, label: t(`event.category.${id}`) }))}
              selected={filters}
              onToggle={(id) => setFilters((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
              onAdvanced={() => undefined}
            />
            <FolderTabs defaultValue="actus">
              <CommunityTabSwitcher tabs={["actus", "evenements", "associations", "entreprises", "emploi", "annonces", "groupes"]} label={t("charte.tabsLabel")} />
              <FolderTabsContent value="actus">
                <EmptyState icon={<CalendarDaysIcon />} title={t("charte.sample.emptyTitle")} description={t("charte.sample.emptyBody")} action={<Button>{t("feed.empty.action")}</Button>} />
              </FolderTabsContent>
            </FolderTabs>
          </Group>

          <Group label={t("charte.controlGroup.buttons")}>
            <div className="flex flex-wrap gap-3">
              <Button>{t("charte.button.primary")}</Button>
              <Button variant="secondary">{t("charte.button.secondary")}</Button>
              <Button variant="outline">{t("charte.button.outline")}</Button>
              <Button variant="ghost">{t("charte.button.ghost")}</Button>
              <Button variant="destructive">{t("charte.button.destructive")}</Button>
              <Button disabled>{t("charte.button.disabled")}</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">{t("charte.button.small")}</Button>
              <Button size="md">{t("charte.button.medium")}</Button>
              <Button size="lg">{t("charte.button.large")}</Button>
            </div>
          </Group>

          <Group label={t("charte.controlGroup.fields")}>
            <div className="grid gap-6 md:grid-cols-2">
              <Field id="charte-champ" label={t("charte.fieldLabel")} hint={t("charte.fieldHint")}>
                {(control) => (
                  <Input
                    id={control.id}
                    name="ville"
                    autoComplete="address-level2"
                    aria-describedby={control.describedBy}
                    placeholder={t("charte.fieldPlaceholder")}
                  />
                )}
              </Field>
              <div className="flex flex-col gap-4 md:pt-7">
                <div className="flex items-center gap-3">
                  <Checkbox id="charte-case" />
                  <Label htmlFor="charte-case">{t("charte.checkboxLabel")}</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="charte-interrupteur" />
                  <Label htmlFor="charte-interrupteur">{t("charte.switchLabel")}</Label>
                </div>
              </div>
              <fieldset className="flex flex-col gap-2 md:col-span-2">
                <legend className="mb-1 text-sm font-medium">{t("charte.radioLegend")}</legend>
                <RadioGroup defaultValue="local" aria-label={t("charte.radioLegend")} className="sm:grid-cols-2">
                  <RadioCard value="local">
                    <span className="flex flex-wrap items-center gap-2">
                      <CountryTag country="FR" />
                      <span className="text-sm">{t("charte.radioLocal")}</span>
                    </span>
                  </RadioCard>
                  <RadioCard value="diaspora">
                    <span className="flex flex-wrap items-center gap-2">
                      <ScopeTag />
                      <span className="text-sm">{t("charte.radioDiaspora")}</span>
                    </span>
                  </RadioCard>
                </RadioGroup>
              </fieldset>
            </div>
          </Group>

          <Group label={t("charte.controlGroup.contact")}>
            <div className="flex flex-wrap items-center gap-3">
              <ContactButton recipientName={t("charte.sample.association")} />
              <ContactButton recipientName={t("charte.sample.association")} onContact={() => undefined} />
            </div>
            <SponsoredSlot advertiser={t("charte.sample.advertiser")} message={t("charte.sample.advertiserMessage")} />
          </Group>
        </Section>
      </div>
    </PublicShell>
  )
}

/**
 * Une section de la charte : son titre et sa phrase d'intention côte à côte au
 * bureau, puis ses spécimens. Ni filet ni boîte : l'espace sépare.
 */
function Section(props: { spec: SectionSpec; children: ReactNode }) {
  const { t } = useDiasporaleT()
  const titleId = `${props.spec.id}-titre`
  return (
    <section id={props.spec.id} aria-labelledby={titleId} className="flex scroll-mt-6 flex-col gap-6">
      <header className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-10">
        <h2 id={titleId} className="text-xl font-semibold tracking-[-0.01em]">
          {t(props.spec.title)}
        </h2>
        <p className="max-w-[60ch] text-[15px] leading-relaxed text-muted-foreground">{t(props.spec.lead)}</p>
      </header>
      {props.children}
    </section>
  )
}

/** Un groupe de spécimens, nommé par une légende discrète. */
function Group(props: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[13px] font-semibold text-muted-foreground">{props.label}</h3>
      {props.children}
    </div>
  )
}

/**
 * Les deux thèmes côte à côte, peints avec les primitives (identiques quel que
 * soit le thème affiché) : dans les deux, le fond est la couche la plus basse et
 * la carte se lève, plus claire (papier sur sable, carte relevée sur la nuit).
 */
function ThemeMock(props: { variant: "light" | "dark" }) {
  const { t } = useDiasporaleT()
  const light = props.variant === "light"
  return (
    <figure className="flex flex-col gap-3">
      <div className={cn("rounded-2xl p-4 sm:p-5", light ? "bg-[var(--esp-neutral-100)]" : "bg-[var(--esp-night-bg)]")}>
        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl p-4",
            light ? "bg-[var(--esp-neutral-0)] text-[var(--esp-neutral-900)] shadow-[var(--esp-shadow)]" : "bg-[var(--esp-night-card)] text-[var(--esp-neutral-200)]",
          )}
        >
          <p className="text-[15px] font-semibold">{t("charte.theme.text")}</p>
          <p className={cn("text-[13px]", light ? "text-[var(--esp-neutral-600)]" : "text-[var(--esp-night-soft)]")}>{t("charte.theme.secondary")}</p>
          <span
            className={cn(
              "mt-1 inline-flex h-9 items-center self-start rounded-md px-3.5 text-sm font-medium",
              light ? "bg-[var(--esp-blue-500)] text-[var(--esp-neutral-0)]" : "bg-[var(--esp-blue-400)] text-[var(--esp-on-blue)]",
            )}
          >
            {t("charte.theme.action")}
          </span>
        </div>
      </div>
      <figcaption className="flex flex-col gap-0.5 px-1">
        <span className="text-sm font-semibold">{light ? t("charte.theme.light") : t("charte.theme.dark")}</span>
        <span className="text-[13px] text-muted-foreground">{light ? t("charte.theme.lightRoles") : t("charte.theme.darkRoles")}</span>
      </figcaption>
    </figure>
  )
}
