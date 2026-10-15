"use client"

import { Avatar, Button, CountryTag, NotificationBell, PostComposerSheet, TrustBadges, cn } from "@diasporale/features"
import { useOpenCountries, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import {
  HandshakeIcon,
  HouseIcon,
  MapPinnedIcon,
  PenSquareIcon,
  PlusIcon,
  Settings2Icon,
  UserRoundIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"
import NextLink from "next/link"
import { usePathname } from "next/navigation"
import { createContext, useContext, useState, type ReactNode } from "react"

import { routes } from "@/lib/routes"

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

interface NavItem {
  readonly id: string
  readonly href: string
  readonly icon: LucideIcon
  readonly labelKey: string
  readonly match: (path: string) => boolean
}

function navItems(membership: MembershipView): NavItem[] {
  const hub = routes.hub(membership.facet.countryOfResidence)
  return [
    { id: "feed", href: routes.feed(), icon: HouseIcon, labelKey: "nav.feed", match: (path) => path.startsWith("/fil") },
    { id: "hub", href: hub, icon: MapPinnedIcon, labelKey: "nav.hub", match: (path) => path.startsWith("/pays") },
    { id: "members", href: routes.members(), icon: UsersRoundIcon, labelKey: "nav.members", match: (path) => path.startsWith("/membres") },
    { id: "profile", href: routes.profile(membership.handle), icon: UserRoundIcon, labelKey: "nav.profile", match: (path) => path.startsWith("/@") || path.startsWith("/profil") },
    { id: "sponsor", href: routes.sponsor(), icon: HandshakeIcon, labelKey: "nav.sponsor", match: (path) => path.startsWith("/parrainer") },
    { id: "settings", href: routes.settings(), icon: Settings2Icon, labelKey: "nav.settings", match: (path) => path.startsWith("/parametres") || path.startsWith("/verification") },
  ]
}

/**
 * Coque légère des pages membres — squelette de l'espace agent (charte §8) :
 *   · bureau (≥ 960 px) : rail de navigation, colonne du fil (≤ 792 px), rail
 *     droit de 312 px dès 1 280 px ;
 *   · téléphone : en-tête collant, barre basse flottante en pilule (Fil · Pays
 *     · Publier · Profil · Réglages), composeur en feuille.
 * Jamais d'AppShell de l'administration, jamais de chrome du Poste.
 */
export function AppShell(props: { membership: MembershipView; rail?: ReactNode; children: ReactNode }) {
  const { t } = useDiasporaleT()
  const pathname = usePathname() ?? ""
  const [composerOpen, setComposerOpen] = useState(false)
  const openCountries = useOpenCountries()
  const items = navItems(props.membership)
  const canPublish = props.membership.canPublish
  const open = openCountries.status === "ready" ? openCountries.data.map((item) => item.country) : []

  return (
    <div className="min-h-dvh">
      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside className="sticky top-0 hidden h-dvh w-[240px] shrink-0 flex-col gap-6 border-r border-border px-4 py-5 min-[960px]:flex">
          <div className="flex flex-wrap items-center gap-2 px-2">
            <NextLink href={routes.feed()} aria-label={t("nav.feed")} className="rounded-md focus-visible:shadow-focus">
              <Wordmark />
            </NextLink>
            <AppDemoChip />
            <NotificationBell className="ml-auto" />
          </div>
          <nav aria-label={t("nav.label")} className="flex flex-col gap-1">
            {items.map((item) => {
              const active = item.match(pathname)
              const Icon = item.icon
              return (
                <NextLink
                  key={item.id}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-[var(--esp-r-chrome)] px-3 text-[15px] font-medium transition-colors focus-visible:shadow-focus",
                    active ? "bg-[var(--esp-accent-soft)] text-[var(--esp-accent-deep)]" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {t(item.labelKey)}
                </NextLink>
              )
            })}
          </nav>
          <Button onClick={() => setComposerOpen(true)} disabled={!canPublish} title={canPublish ? undefined : t("composer.notAllowed")}>
            <PenSquareIcon aria-hidden />
            {t("composer.open")}
          </Button>
          <div className="mt-auto flex items-center gap-3 rounded-xl bg-card p-3 shadow-card">
            <Avatar id={props.membership.personId} name={props.membership.displayName} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{props.membership.displayName}</p>
              <TrustBadges badges={props.membership.badges} />
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur min-[960px]:hidden">
            {/* Le mot-symbole garde sa largeur ; l'étiquette pays cède la première (tronquée, puis
                retirée sous 360 px : « Mon pays » reste dans la barre basse). */}
            <div className="flex shrink-0 items-center gap-2">
              <NextLink href={routes.feed()} aria-label={t("nav.feed")} className="rounded-md focus-visible:shadow-focus">
                <Wordmark />
              </NextLink>
              <AppDemoChip />
            </div>
            <div className="flex min-w-0 items-center justify-end gap-1">
              <NextLink
                href={routes.members()}
                aria-label={t("nav.members")}
                aria-current={pathname.startsWith("/membres") ? "page" : undefined}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-focus aria-[current=page]:text-[var(--esp-accent-deep)]"
              >
                <UsersRoundIcon aria-hidden className="size-5" />
              </NextLink>
              <NotificationBell />
              <NextLink
                href={routes.hub(props.membership.facet.countryOfResidence)}
                aria-label={t("nav.hub")}
                className="flex min-w-0 rounded-md focus-visible:shadow-focus max-[359px]:hidden"
              >
                <CountryTag country={props.membership.facet.countryOfResidence} city={props.membership.facet.city} className="min-w-0 shrink" />
              </NextLink>
            </div>
          </header>
          <main
            id="contenu"
            className="mx-auto grid w-full gap-6 px-4 pb-[calc(var(--esp-reseau-tabbar-inset)+env(safe-area-inset-bottom)+1rem)] pt-4 min-[960px]:pb-10 min-[960px]:pt-6 xl:grid-cols-[minmax(0,792px)_312px] xl:justify-center"
          >
            <ComposerContext.Provider value={{ open: () => setComposerOpen(true), canPublish }}>
              <div className="flex min-w-0 max-w-[792px] flex-col gap-4">{props.children}</div>
            </ComposerContext.Provider>
            {props.rail ? <aside className="hidden flex-col gap-4 xl:flex">{props.rail}</aside> : null}
          </main>
        </div>
      </div>

      <nav
        aria-label={t("nav.label")}
        className="fixed inset-x-3 bottom-3 z-40 rounded-4xl bg-[var(--esp-mobilebar-bg)] shadow-[var(--esp-mobilebar-shadow)] backdrop-blur min-[960px]:hidden"
      >
        <ul className="grid h-16 grid-cols-5 items-center px-1 pb-[env(safe-area-inset-bottom)]">
          {mobileItems(items, ["feed", "hub"]).map((item) => (
            <MobileTab key={item.id} item={item} active={item.match(pathname)} label={t(item.labelKey)} />
          ))}
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              disabled={!canPublish}
              aria-label={canPublish ? t("composer.open") : t("composer.notAllowed")}
              className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95 focus-visible:shadow-focus disabled:opacity-55"
            >
              <PlusIcon className="size-6" aria-hidden />
            </button>
          </li>
          {mobileItems(items, ["profile", "settings"]).map((item) => (
            <MobileTab key={item.id} item={item} active={item.match(pathname)} label={t(item.labelKey)} />
          ))}
        </ul>
      </nav>

      {canPublish ? (
        <PostComposerSheet
          open={composerOpen}
          onOpenChange={setComposerOpen}
          memberCountry={props.membership.facet.countryOfResidence}
          openCountries={open}
          draftKey={`diasporale:brouillon:${props.membership.personId}`}
        />
      ) : null}
    </div>
  )
}

/** Les onglets de la barre basse, désignés par leur identifiant (la colonne du bureau en a davantage). */
function mobileItems(items: readonly NavItem[], ids: readonly string[]): NavItem[] {
  return ids.flatMap((id) => items.filter((item) => item.id === id))
}

function MobileTab(props: { item: NavItem; active: boolean; label: string }) {
  const Icon = props.item.icon
  return (
    <li className="flex justify-center">
      <NextLink
        href={props.item.href}
        aria-current={props.active ? "page" : undefined}
        className={cn(
          "flex min-h-12 min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium transition-colors focus-visible:shadow-focus",
          props.active ? "text-[var(--esp-accent-deep)]" : "text-muted-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden />
        {props.label}
      </NextLink>
    </li>
  )
}
