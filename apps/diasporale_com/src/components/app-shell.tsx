"use client"

import { MessagerieDock } from "@antsia/social-features/messagerie"
import { useIsReseauMobile } from "@antsia/ui/overlay"
import { parseResidenceCountry, type CountryCode, type MembershipStatus } from "@diasporale/domain"
import {
  Avatar,
  Button,
  CountryTag,
  NotificationBell,
  PostComposerSheet,
  PostShareProvider,
  Sheet,
  SheetContent,
  SheetTrigger,
  TrustBadges,
  cn,
  countryName,
} from "@diasporale/features"
import {
  useDataSource,
  useModerationDesk,
  useOpenCountries,
  usePilotMetrics,
  type MembershipView,
  type ModerationDeskCapability,
  type PilotMetricsCapability,
  type PostView,
} from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookmarkIcon,
  BriefcaseBusinessIcon,
  ChartColumnIcon,
  ChevronsUpDownIcon,
  ClipboardListIcon,
  CompassIcon,
  DatabaseIcon,
  FileTextIcon,
  GraduationCapIcon,
  HandshakeIcon,
  HeartHandshakeIcon,
  HouseIcon,
  MessageCircleIcon,
  PenSquareIcon,
  PlusIcon,
  Settings2Icon,
  ShieldCheckIcon,
  StoreIcon,
  UserRoundCheckIcon,
  UserRoundIcon,
  UsersRoundIcon,
  XIcon,
  type LucideIcon,
} from "lucide-react"
import NextLink from "next/link"
import { usePathname } from "next/navigation"
import { DropdownMenu, Popover } from "radix-ui"
import { createContext, Suspense, useContext, useId, useState, type ReactNode } from "react"

import { routes } from "@/lib/routes"

import { IcomIsland, useEngineNetwork, useIcomNetwork } from "./icom"
import { AppDemoChip } from "./site-chrome"
import { Wordmark } from "./wordmark"

interface ComposerControl {
  readonly open: () => void
  readonly canPublish: boolean
}

const ComposerContext = createContext<ComposerControl>({ open: () => {}, canPublish: false })

/** Ouvre le composeur de la coque depuis un écran (« Quoi de neuf ? »). */
export function useComposer(): ComposerControl {
  return useContext(ComposerContext)
}

// ═══════════════════════════════════════════════════════════════
// Arborescence (DG-005) — cinq destinations, un espace personnel, le compte
// ═══════════════════════════════════════════════════════════════

type EntryId =
  | "feed"
  | "explore"
  | "services"
  | "communities"
  | "messages"
  | "myRequests"
  | "myActivity"
  | "myAssociations"
  | "myApplications"
  | "myMentoring"
  | "moderation"
  | "pilot"
  | "relations"
  | "bookmarks"
  | "sponsor"
  | "profile"
  | "settings"
  | "myData"

/** Une entrée de navigation : une adresse de la table des routes, son icône, sa clé de libellé, son état courant. */
interface NavEntry {
  readonly id: EntryId
  readonly href: string
  readonly icon: LucideIcon
  readonly labelKey: string
  /** Le chemin courant relève de cette entrée : `aria-current="page"`. */
  readonly active: boolean
}

/** Un segment fictif : la table des routes donne la forme d'une adresse paramétrée, jamais la coque. */
const SAMPLE_SEGMENT = "segment"

/** Le chemin d'une adresse de la table, sans requête ni ancre. */
function pathOf(href: string): string {
  const end = href.search(/[?#]/)
  return end === -1 ? href : href.slice(0, end)
}

/** La rubrique d'une adresse : son premier segment (« /pays/fr » → « /pays »). */
function sectionOf(href: string): string {
  const path = pathOf(href)
  const next = path.indexOf("/", 1)
  return next === -1 ? path : path.slice(0, next)
}

/** Le chemin relève-t-il de la rubrique d'une de ces adresses ? `/services` couvre `/services/…`, jamais `/servicesx`. */
function withinAny(pathname: string, hrefs: readonly string[]): boolean {
  return hrefs.some((href) => {
    const section = sectionOf(href)
    return pathname === section || pathname.startsWith(`${section}/`)
  })
}

/** La gestion d'une page (`/pages/<page>/gerer…`) relève de « Mon activité », sa simple lecture non. */
function managesPage(pathname: string): boolean {
  const [head = "", tail = ""] = pathOf(routes.pageManage(SAMPLE_SEGMENT)).split(SAMPLE_SEGMENT)
  if (head === "" || tail === "" || !pathname.startsWith(head)) return false
  const rest = pathname.slice(head.length)
  const cut = rest.indexOf("/")
  if (cut <= 0) return false
  const after = rest.slice(cut)
  return after === tail || after.startsWith(`${tail}/`)
}

/**
 * Les cinq destinations, dans cet ordre : Fil, Explorer, Services, Communautés, Messages.
 * Messages n'existe qu'avec iCom (même règle qu'avant) : sans lui, la barre garde
 * quatre onglets, sans trou. Correspondances : une publication seule et les statuts
 * relèvent du fil ; l'annuaire des membres d'Explorer ; les hubs pays de Communautés.
 */
function primaryEntries(membership: MembershipView, pathname: string, withMessages: boolean): NavEntry[] {
  const entries: NavEntry[] = [
    {
      id: "feed",
      href: routes.feed(),
      icon: HouseIcon,
      labelKey: "nav.feed",
      active: withinAny(pathname, [routes.feed(), routes.post(SAMPLE_SEGMENT), routes.stories()]),
    },
    {
      id: "explore",
      href: routes.explore(),
      icon: CompassIcon,
      labelKey: "nav.explore",
      active: withinAny(pathname, [routes.explore(), routes.members()]),
    },
    {
      id: "services",
      href: routes.services(),
      icon: StoreIcon,
      labelKey: "nav.services",
      active: withinAny(pathname, [routes.services(), routes.serviceOffer(SAMPLE_SEGMENT)]),
    },
    {
      id: "communities",
      href: routes.communities(),
      icon: UsersRoundIcon,
      labelKey: "nav.communities",
      active: withinAny(pathname, [routes.communities(), routes.hub(membership.facet.countryOfResidence)]),
    },
  ]
  if (withMessages) {
    entries.push({ id: "messages", href: routes.messages(), icon: MessageCircleIcon, labelKey: "nav.messages", active: withinAny(pathname, [routes.messages()]) })
  }
  return entries
}

/** L'espace personnel : le rail du bureau le montre sous les destinations, le menu du compte le reprend. */
function personalEntries(pathname: string, withRelations: boolean): NavEntry[] {
  const relations: NavEntry[] = withRelations
    ? [{ id: "relations", href: routes.relations(), icon: UserRoundCheckIcon, labelKey: "nav.relations", active: withinAny(pathname, [routes.relations()]) }]
    : []
  return [
    {
      id: "myRequests",
      href: routes.myServiceRequests(),
      icon: ClipboardListIcon,
      labelKey: "nav.myRequests",
      active: withinAny(pathname, [routes.myServiceRequests(), routes.serviceRequest(SAMPLE_SEGMENT)]),
    },
    {
      id: "myActivity",
      href: routes.myActivity(),
      icon: BriefcaseBusinessIcon,
      labelKey: "nav.myActivity",
      active: withinAny(pathname, [routes.myActivity(), routes.newPage()]) || managesPage(pathname),
    },
    {
      id: "myAssociations",
      href: routes.myAssociations(),
      icon: HeartHandshakeIcon,
      labelKey: "nav.myAssociations",
      active: withinAny(pathname, [routes.myAssociations()]),
    },
    // Vague H du plan global : candidatures (DG-025) et mentorat (DG-024).
    {
      id: "myApplications",
      href: routes.myApplications(),
      icon: FileTextIcon,
      labelKey: "nav.myApplications",
      active: withinAny(pathname, [routes.myApplications()]),
    },
    {
      id: "myMentoring",
      href: routes.myMentoring(),
      icon: GraduationCapIcon,
      labelKey: "nav.myMentoring",
      active: withinAny(pathname, [routes.myMentoring()]),
    },
    ...relations,
    { id: "bookmarks", href: routes.bookmarks(), icon: BookmarkIcon, labelKey: "bookmarks.title", active: withinAny(pathname, [routes.bookmarks()]) },
    { id: "sponsor", href: routes.sponsor(), icon: HandshakeIcon, labelKey: "nav.sponsor", active: withinAny(pathname, [routes.sponsor()]) },
  ]
}

/**
 * Sans capacité servie, aucune entrée réservée : ces lectures constantes (sans hook) remplacent la
 * capacité absente et gardent l'ordre des hooks, la source de données ne changeant pas d'un rendu à l'autre.
 */
const NO_MODERATION_DESK: Pick<ModerationDeskCapability, "useDesk"> = { useDesk: () => ({ status: "ready", data: null }) }
const NO_PILOT_METRICS: Pick<PilotMetricsCapability, "useAccess"> = { useAccess: () => ({ status: "ready", data: { allowed: false } }) }

/**
 * Les entrées réservées aux responsables que le serveur reconnaît (modération par pays, mesure du
 * pilote) : absentes pour tout autre membre, et le serveur rejuge chaque lecture derrière elles.
 */
function responsibleEntries(pathname: string, access: { readonly moderation: boolean; readonly pilot: boolean }): NavEntry[] {
  const entries: NavEntry[] = []
  if (access.moderation) {
    entries.push({ id: "moderation", href: routes.moderationDesk(), icon: ShieldCheckIcon, labelKey: "nav.moderation", active: withinAny(pathname, [routes.moderationDesk()]) })
  }
  if (access.pilot) {
    entries.push({ id: "pilot", href: routes.pilotDashboard(), icon: ChartColumnIcon, labelKey: "pilotMetrics.nav", active: withinAny(pathname, [routes.pilotDashboard()]) })
  }
  return entries
}

/** Le menu du compte, ouvert depuis l'avatar : profil, réglages, l'espace personnel, mes données. */
function accountEntries(membership: MembershipView, pathname: string, personal: readonly NavEntry[]): NavEntry[] {
  return [
    {
      id: "profile",
      href: routes.profile(membership.handle),
      icon: UserRoundIcon,
      labelKey: "nav.profile",
      active: withinAny(pathname, [routes.profile(membership.handle)]),
    },
    {
      id: "settings",
      href: routes.settings(),
      icon: Settings2Icon,
      labelKey: "nav.settings",
      active: withinAny(pathname, [routes.settings(), routes.attestation()]),
    },
    ...personal,
    // Une ancre des réglages : le chemin seul ne la distingue pas, elle n'est donc jamais « courante ».
    { id: "myData", href: routes.settingsData(), icon: DatabaseIcon, labelKey: "nav.myData", active: false },
  ]
}

/**
 * Le pays CONSULTÉ, quand il n'est pas celui de résidence : le hub d'un autre pays
 * (`/pays/<iso>`). Consulter une zone ne réécrit jamais la résidence (plan G1, point 5).
 */
function exploredZone(pathname: string, home: CountryCode): CountryCode | null {
  const base = `${sectionOf(routes.hub(home))}/`
  if (!pathname.startsWith(base)) return null
  const parsed = parseResidenceCountry(pathname.slice(base.length).split("/", 1)[0])
  return parsed.ok && parsed.value !== home ? parsed.value : null
}

interface PublishRefusal {
  /** La raison courte, annoncée avec le bouton (`aria-describedby`). */
  readonly hintKey: string
  readonly titleKey: string
  readonly bodyKey: string
  /** Les chemins qui rouvrent la publication — les adresses de la carte de statut. */
  readonly paths: readonly { readonly href: string; readonly labelKey: string }[]
}

function publishRefusal(status: MembershipStatus): PublishRefusal {
  if (status === "suspendue") {
    return {
      hintKey: "nav.publish.suspendedHint",
      titleKey: "status.suspendedTitle",
      bodyKey: "nav.publish.suspendedBody",
      paths: [{ href: routes.settingsData(), labelKey: "nav.myData" }],
    }
  }
  return {
    hintKey: "composer.notAllowed",
    titleKey: "composer.notAllowed",
    bodyKey: "status.pendingBody",
    paths: [
      { href: routes.sponsorHelp(), labelKey: "status.sponsorHelp" },
      { href: routes.attestation(), labelKey: "status.verifyConsular" },
    ],
  }
}

// ═══════════════════════════════════════════════════════════════
// La coque
// ═══════════════════════════════════════════════════════════════

/**
 * Coque des pages membres — squelette de l'espace agent (charte §8), arborescence DG-005 :
 *   · bureau (≥ 960 px) : rail gauche (pays, cinq destinations, espace personnel,
 *     Publier, carte de l'avatar qui ouvre le menu du compte), colonne du fil
 *     (≤ 792 px), rail droit de 312 px dès 1 280 px ;
 *   · téléphone : en-tête collant (mot-symbole, Publier, cloche, avatar → feuille du
 *     compte), barre basse flottante à cinq destinations, composeur en feuille.
 *
 * Publier vit dans l'en-tête au téléphone, pas en bouton flottant : au-dessus de la
 * barre basse se tient la pile des cartes flottantes (démonstration, statut d'adhésion,
 * avis — pleine largeur), qui le masquerait ou qu'il masquerait ; et le futur fil
 * vertical (G6) ne doit rien porter sur le sujet d'une vidéo. L'en-tête collant le
 * garde au même endroit sur chaque écran.
 *
 * Aucune perte d'accès : chaque lien d'avant reste à un geste (destinations, Publier,
 * cloche) ou à deux (Membres par Explorer ; Profil, Réglages, Relations, Parrainer par
 * le menu du compte, aussi présents dans le rail du bureau).
 * Jamais d'AppShell de l'administration, jamais de chrome du Poste.
 */
export function AppShell(props: { membership: MembershipView; rail?: ReactNode; children: ReactNode }) {
  const pathname = usePathname() ?? ""
  const [composerOpen, setComposerOpen] = useState(false)
  // Partage cité : la publication citée reste posée pendant la fermeture de la feuille (pas de bascule de titre).
  const [shareTarget, setShareTarget] = useState<PostView | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  // Chaque partage remonte son composeur : formulaire, aperçu et clé d'idempotence repartent de zéro.
  const [shareSession, setShareSession] = useState(0)
  const openCountries = useOpenCountries()
  // iCom (PD7) : en mode moteur, pour un membre qui peut écrire ; le dock se monte au bureau seulement
  // (seuil du moteur, 960 px ; inconnu au rendu serveur, donc rien avant le premier passage client).
  const icom = useIcomNetwork()
  const network = useEngineNetwork()
  const desktop = useIsReseauMobile() === false
  const { membership } = props
  const canPublish = membership.canPublish
  const open = openCountries.status === "ready" ? openCountries.data.map((item) => item.country) : []
  const primary = primaryEntries(membership, pathname, icom !== null)
  const desk = (useModerationDesk() ?? NO_MODERATION_DESK).useDesk(membership.personId)
  const pilot = (usePilotMetrics() ?? NO_PILOT_METRICS).useAccess()
  const personal = [
    ...personalEntries(pathname, network !== null),
    ...responsibleEntries(pathname, {
      moderation: desk.status === "ready" && desk.data !== null,
      pilot: pilot.status === "ready" && pilot.data.allowed,
    }),
  ]
  const account = accountEntries(membership, pathname, personal)
  const openComposer = () => setComposerOpen(true)

  const startShare = (post: PostView) => {
    setShareTarget(post)
    setShareSession((session) => session + 1)
    setShareOpen(true)
  }

  return (
    <PostShareProvider value={canPublish ? startShare : null}>
      <div className="min-h-dvh">
        <div className="mx-auto flex w-full max-w-[1400px]">
          <DesktopRail membership={membership} primary={primary} personal={personal} account={account} onPublish={openComposer} />

          <div className="min-w-0 flex-1">
            <MobileHeader membership={membership} account={account} onPublish={openComposer} />
            <main
              id="contenu"
              className="mx-auto grid w-full gap-6 px-4 pb-[calc(var(--esp-reseau-tabbar-inset)+env(safe-area-inset-bottom)+1rem)] pt-4 min-[960px]:pb-10 min-[960px]:pt-6 xl:grid-cols-[minmax(0,792px)_312px] xl:justify-center"
            >
              <ComposerContext.Provider value={{ open: openComposer, canPublish }}>
                <div className="flex min-w-0 max-w-[792px] flex-col gap-4">
                  <ZoneNotice pathname={pathname} membership={membership} />
                  {props.children}
                </div>
              </ComposerContext.Provider>
              {/* Le rail droit (dès 1 280 px). Sa première place revient à la carte iCom ; montée dès 960 px,
                  elle reste disponible entre 960 et 1 280 px, rail retiré : une adresse de messagerie l'ouvre
                  détachée, en carte flottante (même doctrine que la page réseau du moteur). */}
              {props.rail || (icom && desktop) ? (
                <aside className="hidden flex-col gap-4 xl:flex">
                  {icom && desktop ? (
                    <IcomIsland network={icom}>
                      <Suspense fallback={null}>
                        <MessagerieDock />
                      </Suspense>
                    </IcomIsland>
                  ) : null}
                  {props.rail}
                </aside>
              ) : null}
            </main>
          </div>
        </div>

        <MobileTabBar entries={primary} />

        {canPublish ? (
          <PostComposerSheet
            open={composerOpen}
            onOpenChange={setComposerOpen}
            memberCountry={membership.facet.countryOfResidence}
            openCountries={open}
            draftKey={`diasporale:brouillon:${membership.personId}`}
          />
        ) : null}
        {canPublish ? (
          <PostComposerSheet
            key={shareSession}
            open={shareOpen}
            onOpenChange={setShareOpen}
            memberCountry={membership.facet.countryOfResidence}
            openCountries={open}
            share={shareTarget}
          />
        ) : null}
      </div>
    </PostShareProvider>
  )
}

// ═══════════════════════════════════════════════════════════════
// Bureau : le rail gauche
// ═══════════════════════════════════════════════════════════════

function DesktopRail(props: {
  membership: MembershipView
  primary: readonly NavEntry[]
  personal: readonly NavEntry[]
  account: readonly NavEntry[]
  onPublish: () => void
}) {
  const { t } = useDiasporaleT()
  const personalId = useId()
  return (
    <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col gap-4 overflow-y-auto overscroll-contain border-r border-border px-4 py-5 min-[960px]:flex">
      <div className="flex flex-wrap items-center gap-2 px-2">
        <NextLink href={routes.feed()} aria-label={t("nav.feed")} className="rounded-md focus-visible:shadow-focus">
          <Wordmark />
        </NextLink>
        <AppDemoChip />
        <NotificationBell className="ml-auto" />
      </div>
      <HomeCountryLink membership={props.membership} caption="visible" className="mx-2 flex-col items-start gap-1" />
      <nav aria-label={t("nav.label")} className="flex flex-col gap-1">
        {props.primary.map((entry) => (
          <RailLink key={entry.id} entry={entry} />
        ))}
      </nav>
      <nav aria-labelledby={personalId} className="flex flex-col gap-0.5">
        <p id={personalId} className="px-3 pb-1 text-xs font-semibold text-muted-foreground">
          {t("nav.personal")}
        </p>
        {props.personal.map((entry) => (
          <RailLink key={entry.id} entry={entry} compact />
        ))}
      </nav>
      <PublishAction variant="rail" membership={props.membership} onPublish={props.onPublish} />
      <AccountMenu membership={props.membership} entries={props.account} />
    </aside>
  )
}

function RailLink(props: { entry: NavEntry; compact?: boolean }) {
  const { t } = useDiasporaleT()
  const Icon = props.entry.icon
  return (
    <NextLink
      href={props.entry.href}
      aria-current={props.entry.active ? "page" : undefined}
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-3 rounded-[var(--esp-r-chrome)] px-3 font-medium transition-colors focus-visible:shadow-focus",
        props.compact ? "text-sm" : "text-[15px]",
        props.entry.active ? "bg-[var(--esp-accent-soft)] text-[var(--esp-accent-deep)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className={cn("shrink-0", props.compact ? "size-4" : "size-5")} aria-hidden />
      <span className="min-w-0 truncate">{t(props.entry.labelKey)}</span>
    </NextLink>
  )
}

/** Le pays de résidence, contexte permanent (charte §5) : il mène à « Communautés », le hub de son pays. */
function HomeCountryLink(props: { membership: MembershipView; caption: "visible" | "hidden"; className?: string }) {
  const { t } = useDiasporaleT()
  return (
    <NextLink href={routes.communities()} className={cn("flex min-w-0 rounded-md focus-visible:shadow-focus", props.className)}>
      <span className={props.caption === "visible" ? "text-xs font-semibold text-muted-foreground" : "sr-only"}>{t("nav.hub")}</span>
      <CountryTag country={props.membership.facet.countryOfResidence} city={props.membership.facet.city} className="min-w-0 shrink" />
    </NextLink>
  )
}

/** Le menu du compte au bureau : la carte de l'avatar l'ouvre (flèches, Échap, focus rendu par Radix). */
function AccountMenu(props: { membership: MembershipView; entries: readonly NavEntry[] }) {
  const { t } = useDiasporaleT()
  const { membership } = props
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={t("nav.account.open", { name: membership.displayName })}
        className="mt-auto flex w-full min-w-0 shrink-0 items-center gap-3 rounded-xl bg-card p-3 text-left text-card-foreground shadow-card transition-colors hover:bg-muted focus-visible:shadow-focus data-[state=open]:bg-muted"
      >
        <Avatar id={membership.personId} name={membership.displayName} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{membership.displayName}</span>
          <TrustBadges badges={membership.badges} className="mt-1" />
        </span>
        <ChevronsUpDownIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" align="start" sideOffset={8} collisionPadding={12} className="z-60 w-[min(16rem,calc(100vw-2rem))] rounded-xl bg-popover p-1.5 text-popover-foreground shadow-float">
          <DropdownMenu.Label className="px-3 py-2">
            <span className="block truncate text-sm font-semibold">{membership.displayName}</span>
            <span className="block truncate text-[13px] text-muted-foreground">@{membership.handle}</span>
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          {props.entries.map((entry) => {
            const Icon = entry.icon
            return (
              <DropdownMenu.Item key={entry.id} asChild>
                <NextLink
                  href={entry.href}
                  aria-current={entry.active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm outline-none focus-visible:shadow-focus data-[highlighted]:bg-muted",
                    // La page courante se lit aussi sans la couleur : graisse et `aria-current`.
                    entry.active ? "font-semibold text-[var(--esp-accent-deep)]" : "font-medium",
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {t(entry.labelKey)}
                </NextLink>
              </DropdownMenu.Item>
            )
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

// ═══════════════════════════════════════════════════════════════
// Téléphone : l'en-tête, la feuille du compte, la barre basse
// ═══════════════════════════════════════════════════════════════

function MobileHeader(props: { membership: MembershipView; account: readonly NavEntry[]; onPublish: () => void }) {
  const { t } = useDiasporaleT()
  const demo = useDataSource().kind === "demo"
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-border bg-background/95 px-3 backdrop-blur min-[360px]:px-4 min-[960px]:hidden">
      {/* Largeurs mesurées sur les polices de la charte : mot-symbole 140 px, repère « Démo » 72 px
          (34 px sans libellé), Publier, cloche et compte 136 px. Le mot-symbole et les trois actions
          tiennent dès 320 px ; avec le repère de démonstration, celui-ci ne garde que son icône sous
          420 px (son nom reste lu) et le mot-symbole son œillet sous 380 px (le lien reste nommé).
          L'étiquette pays n'entre qu'à partir de 440 px, le format téléphone de la charte ; plus
          étroit, « Communautés » et la feuille du compte portent le pays. */}
      <div className="flex shrink-0 items-center gap-2 max-[420px]:[&_[data-slot=demo-chip]>span]:sr-only">
        <NextLink href={routes.feed()} aria-label={t("nav.feed")} className="rounded-md focus-visible:shadow-focus">
          <Wordmark className={demo ? "max-[380px]:[&>span:last-child]:sr-only" : undefined} />
        </NextLink>
        <AppDemoChip />
      </div>
      <div className="flex min-w-0 items-center justify-end gap-1">
        <HomeCountryLink membership={props.membership} caption="hidden" className="hidden min-[440px]:flex" />
        <PublishAction variant="header" membership={props.membership} onPublish={props.onPublish} />
        <NotificationBell />
        <AccountSheet membership={props.membership} entries={props.account} />
      </div>
    </header>
  )
}

/** Le menu du compte au téléphone : une feuille (piège de focus, Échap, focus rendu à l'avatar). */
function AccountSheet(props: { membership: MembershipView; entries: readonly NavEntry[] }) {
  const { t } = useDiasporaleT()
  const [open, setOpen] = useState(false)
  const { membership } = props
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label={t("nav.account.open", { name: membership.displayName })}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:shadow-focus"
      >
        <Avatar id={membership.personId} name={membership.displayName} size="sm" />
      </SheetTrigger>
      <SheetContent title={t("nav.account.title")} description={t("nav.account.description")} hideDescription closeLabel={t("nav.account.close")}>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar id={membership.personId} name={membership.displayName} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{membership.displayName}</p>
            <p className="truncate text-[13px] text-muted-foreground">@{membership.handle}</p>
          </div>
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
          <TrustBadges badges={membership.badges} />
          <CountryTag country={membership.facet.countryOfResidence} city={membership.facet.city} />
        </div>
        <nav aria-label={t("nav.account.title")} className="mt-4">
          <ul className="flex flex-col gap-0.5">
            {props.entries.map((entry) => {
              const Icon = entry.icon
              return (
                <li key={entry.id}>
                  <NextLink
                    href={entry.href}
                    aria-current={entry.active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex min-h-12 min-w-0 items-center gap-3 rounded-lg px-3 text-[15px] font-medium transition-colors focus-visible:shadow-focus",
                      entry.active ? "bg-[var(--esp-accent-soft)] text-[var(--esp-accent-deep)]" : "hover:bg-muted",
                    )}
                  >
                    <Icon className="size-5 shrink-0" aria-hidden />
                    <span className="min-w-0 truncate">{t(entry.labelKey)}</span>
                  </NextLink>
                </li>
              )
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  )
}

/**
 * La barre basse flottante : les cinq destinations (quatre sans iCom). Chaque onglet
 * prend la largeur de son libellé (« Communautés » ne tient pas dans un cinquième de
 * 320 px) et garde 44 px au moins ; un libellé trop long pour un très grand texte se
 * tronque, son nom accessible reste entier. Posée au-dessus de la zone sûre.
 */
function MobileTabBar(props: { entries: readonly NavEntry[] }) {
  const { t } = useDiasporaleT()
  return (
    <nav
      aria-label={t("nav.label")}
      className="fixed inset-x-2 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 rounded-4xl bg-[var(--esp-mobilebar-bg)] shadow-[var(--esp-mobilebar-shadow)] backdrop-blur min-[360px]:inset-x-3 min-[960px]:hidden"
    >
      <ul className="flex h-16 items-stretch px-1">
        {props.entries.map((entry) => {
          const Icon = entry.icon
          return (
            <li key={entry.id} className="flex min-w-11 flex-auto">
              <NextLink
                href={entry.href}
                aria-current={entry.active ? "page" : undefined}
                className={cn(
                  "flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[11px] transition-colors focus-visible:shadow-focus",
                  entry.active ? "font-semibold text-[var(--esp-accent-deep)]" : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="max-w-full truncate">{t(entry.labelKey)}</span>
              </NextLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ═══════════════════════════════════════════════════════════════
// Publier : une action stable, expliquée quand elle est fermée
// ═══════════════════════════════════════════════════════════════

const HEADER_PUBLISH_CLASS =
  "grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-[var(--primary-fill-hover)] focus-visible:shadow-focus"

/**
 * Publier, dans le rail (bouton plein) ou l'en-tête (rond de 44 px). Fermée, l'action
 * reste focalisable (`aria-disabled`, jamais `disabled`) : sa raison est annoncée avec
 * elle, écrite sous le bouton au bureau, et un geste ouvre l'explication avec les
 * chemins qui la rouvrent (parrainage, vérification ; recours pendant une suspension).
 */
function PublishAction(props: { variant: "rail" | "header"; membership: MembershipView; onPublish: () => void }) {
  const { t } = useDiasporaleT()
  const ids = useId()
  const [explaining, setExplaining] = useState(false)
  const rail = props.variant === "rail"
  if (props.membership.canPublish) {
    return rail ? (
      <Button onClick={props.onPublish} className="w-full">
        <PenSquareIcon aria-hidden />
        {t("composer.open")}
      </Button>
    ) : (
      <button type="button" onClick={props.onPublish} aria-label={t("composer.open")} className={HEADER_PUBLISH_CLASS}>
        <PlusIcon aria-hidden className="size-5" />
      </button>
    )
  }

  const refusal = publishRefusal(props.membership.status)
  const hintId = `${ids}-raison`
  const titleId = `${ids}-titre`
  return (
    <Popover.Root open={explaining} onOpenChange={setExplaining}>
      {rail ? (
        <div className="flex flex-col gap-1.5">
          <Popover.Trigger asChild>
            <Button aria-disabled="true" aria-describedby={hintId} className="w-full opacity-55">
              <PenSquareIcon aria-hidden />
              {t("composer.open")}
            </Button>
          </Popover.Trigger>
          <p id={hintId} className="px-1 text-[13px] leading-snug text-muted-foreground">
            {t(refusal.hintKey)}
          </p>
        </div>
      ) : (
        <>
          <Popover.Trigger asChild>
            <button
              type="button"
              aria-label={t("composer.open")}
              aria-disabled="true"
              aria-describedby={hintId}
              className={cn(HEADER_PUBLISH_CLASS, "opacity-55")}
            >
              <PlusIcon aria-hidden className="size-5" />
            </button>
          </Popover.Trigger>
          <span id={hintId} className="sr-only">
            {t(refusal.hintKey)}
          </span>
        </>
      )}
      <Popover.Portal>
        <Popover.Content
          aria-labelledby={titleId}
          side={rail ? "right" : "bottom"}
          align={rail ? "center" : "end"}
          sideOffset={8}
          collisionPadding={12}
          className="z-60 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl bg-popover p-4 text-popover-foreground shadow-float"
        >
          <div className="flex items-start gap-2">
            <p id={titleId} className="min-w-0 flex-1 font-semibold leading-snug">
              {t(refusal.titleKey)}
            </p>
            <Popover.Close
              aria-label={t("nav.publish.close")}
              className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-focus"
            >
              <XIcon aria-hidden className="size-4" />
            </Popover.Close>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t(refusal.bodyKey)}</p>
          <ul className="mt-2 flex flex-col">
            {refusal.paths.map((path) => (
              <li key={path.href}>
                <NextLink
                  href={path.href}
                  onClick={() => setExplaining(false)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:shadow-focus"
                >
                  {t(path.labelKey)}
                  <ArrowRightIcon aria-hidden className="size-4" />
                </NextLink>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// ═══════════════════════════════════════════════════════════════
// Le contexte pays : une zone consultée reste visible
// ═══════════════════════════════════════════════════════════════

/** Sur le hub d'un autre pays : la zone consultée, la résidence inchangée, le retour à son pays. */
function ZoneNotice(props: { pathname: string; membership: MembershipView }) {
  const { t, locale } = useDiasporaleT()
  const home = props.membership.facet.countryOfResidence
  const zone = exploredZone(props.pathname, home)
  if (zone === null) return null
  return (
    <div role="note" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-muted px-3 py-2">
      <CountryTag country={zone} />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-semibold">{t("nav.zone.title", { country: countryName(zone, locale) })}</span>{" "}
        <span className="text-muted-foreground">{t("nav.zone.body", { home: countryName(home, locale) })}</span>
      </p>
      <NextLink
        href={routes.communities()}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:shadow-focus"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        {t("nav.zone.back")}
      </NextLink>
    </div>
  )
}
