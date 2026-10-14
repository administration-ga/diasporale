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
  EmptyState,
  EventCard,
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
  ScopeTag,
  SponsoredBadge,
  SponsoredSlot,
  StatCounter,
  Switch,
  TalentCard,
  TrustBadges,
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
import { CalendarDaysIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { PublicShell } from "@/components/site-chrome"

const DAY = 24 * 60 * 60 * 1000

/**
 * `/charte` — la charte « Sable de la diaspora » en vrai : chaque composant de
 * `@diasporale/features` monté avec des données d'EXEMPLE (fictives), pour la
 * relecture `web-design-guidelines` et la vérification réelle dans Chrome
 * (320 px, 375 px, 1 280 px, sombre). Aucun chiffre réel n'y figure.
 */
export function CharteScreen() {
  const { t } = useDiasporaleT()
  const [now] = useState(() => Date.now())
  const [filters, setFilters] = useState<readonly string[]>(["celebration"])

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
    scope: { reach: "diaspora", country: "CA" },
    audience: "public",
    visibility: "root",
    moderation: "published",
    createdAt: now - 5 * 60 * 60 * 1000,
    reactionCount: 12,
    commentCount: 3,
    myReaction: null,
    isMine: false,
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

  return (
    <PublicShell>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-12 px-4 pb-10 pt-6 md:pt-10">
        <div>
          <h1 className="font-display text-4xl font-bold">{t("charte.title")}</h1>
          <p className="mt-2 max-w-[44rem] text-[15px] leading-relaxed text-muted-foreground">{t("charte.lead")}</p>
        </div>

        <Block title={t("charte.palette")}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
            {(
              [
                ["charte.swatch.sable", "bg-[var(--dg-sable-100)]"],
                ["charte.swatch.papier", "bg-[var(--dg-papier)]"],
                ["charte.swatch.encre", "bg-[var(--dg-encre)]"],
                ["charte.swatch.bleu", "bg-[var(--dg-bleu-600)]"],
                ["charte.swatch.gres", "bg-[var(--dg-gres-700)]"],
                ["charte.swatch.nuit", "bg-[var(--dg-nuit-300)]"],
              ] as const
            ).map(([key, swatch]) => (
              <div key={key} className="flex flex-col gap-2">
                <span aria-hidden className={`h-16 rounded-xl border border-border ${swatch}`} />
                <span className="text-[13px] font-medium">{t(key)}</span>
              </div>
            ))}
          </div>
          <div aria-hidden className="h-0.5 w-full bg-[image:var(--dg-stripe)]" />
          <p className="text-[13px] text-muted-foreground">{t("charte.stripeNote")}</p>
        </Block>

        <Block title={t("charte.typography")}>
          <p className="font-display text-5xl font-bold leading-none">{t("charte.typeDisplay")}</p>
          <p className="text-[15px] leading-relaxed">{t("charte.typeBody")}</p>
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.08em]">{t("charte.typeMono")}</p>
        </Block>

        <Block title={t("charte.tags")}>
          <div className="flex flex-wrap items-center gap-3">
            <CountryTag country="FR" city={t("charte.sample.cityLyon")} />
            <CountryTag country="CA" city={t("charte.sample.cityMontreal")} size="md" />
            <CountryTag country="BE" />
            <ScopeTag />
            <ContentScopeTag scope={{ reach: "diaspora", country: "CA" }} hubCountry="FR" />
          </div>
          <div className="flex items-end gap-4">
            <CountryMonument country="FR" />
            <p className="pb-1 font-display text-3xl font-bold">{t("charte.monumentCaption")}</p>
          </div>
        </Block>

        <Block title={t("charte.badges")}>
          <TrustBadges badges={["official", "verified", "public_agent", "community"]} size="md" />
          <TrustBadges badges={["official", "verified", "public_agent", "community"]} />
          <SponsoredBadge className="self-start" />
        </Block>

        <Block title={t("charte.banners")}>
          <ModerationBanner state="pending_review" />
          <ModerationBanner state="published" />
          <ModerationBanner state="rejected" reason={t("charte.sample.rejectReason")} />
          <MembershipStatusBanner status="en_attente" badges={["community"]} />
          <MembershipStatusBanner status="declaree" badges={["community"]} />
          <MembershipStatusBanner status="verifiee" badges={["verified"]} />
          <MembershipStatusBanner status="suspendue" badges={["community"]} />
          <DemoBanner className="rounded-xl" />
        </Block>

        <Block title={t("charte.counters")}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCounter value={{ kind: "below_threshold", threshold: 20 }} label={t("hub.counters.members")} />
            <StatCounter value={{ kind: "value", value: 4 }} label={t("hub.counters.associations")} />
            <StatCounter value={{ kind: "value", value: 2 }} label={t("hub.counters.companies")} />
            <StatCounter value={{ kind: "value", value: 3 }} label={t("hub.counters.events")} />
          </div>
        </Block>

        <Block title={t("charte.cards")}>
          <div className="grid gap-4 md:grid-cols-2">
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
          <PostCard post={post} now={now} canReact={false} />
        </Block>

        <Block title={t("charte.controls")}>
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
          <div className="flex flex-wrap items-center gap-3">
            <ContactButton recipientName={t("charte.sample.association")} />
            <ContactButton recipientName={t("charte.sample.association")} onContact={() => undefined} />
          </div>
          <SponsoredSlot advertiser={t("charte.sample.advertiser")} message={t("charte.sample.advertiserMessage")} />
        </Block>

        <Block title={t("charte.primitives")}>
          <div className="flex flex-wrap gap-3">
            <Button>{t("charte.button.primary")}</Button>
            <Button variant="secondary">{t("charte.button.secondary")}</Button>
            <Button variant="outline">{t("charte.button.outline")}</Button>
            <Button variant="ghost">{t("charte.button.ghost")}</Button>
            <Button variant="destructive">{t("charte.button.destructive")}</Button>
            <Button disabled>{t("charte.button.disabled")}</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="charte-champ">{t("charte.fieldLabel")}</Label>
              <Input id="charte-champ" placeholder={t("charte.fieldPlaceholder")} />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <Checkbox id="charte-case" />
                <Label htmlFor="charte-case">{t("charte.checkboxLabel")}</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch id="charte-interrupteur" />
                <Label htmlFor="charte-interrupteur">{t("charte.switchLabel")}</Label>
              </div>
            </div>
          </div>
        </Block>
      </div>
    </PublicShell>
  )
}

function Block(props: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="border-b border-border pb-2 font-display text-2xl font-bold">{props.title}</h2>
      <Card className="flex flex-col gap-4 bg-background p-4 md:p-6">{props.children}</Card>
    </section>
  )
}
