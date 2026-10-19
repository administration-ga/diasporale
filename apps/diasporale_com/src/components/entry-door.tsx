"use client"

import { AppearanceToggle } from "@antsia/social-features/shell/appearance"
import { CountryTag, cn } from "@diasporale/features"
import { useOpenCountries } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import NextLink from "next/link"
import { useId, useRef, type ReactNode } from "react"

import { routes } from "@/lib/routes"

import { LiquidWordmark } from "./liquid-wordmark"
import { LanguageSwitch } from "./preferences"
import { AppDemoChip, SiteFooter } from "./site-chrome"

/**
 * La porte de DIASPORALE : une seule, responsive, pour l'accueil, la connexion,
 * l'inscription et leurs étapes (code, IDN de démonstration) — le principe de
 * l'accueil d'ANTSIA (`AccessHomeScreen`). La marque et la promesse à gauche dès
 * 960 px, la carte d'accès à droite ; au téléphone, une seule colonne. Le mode
 * sombre se bascule en un appui, avant même la connexion (ADR-0027 du moteur).
 * Le mot-symbole est en matière liquide (`LiquidWordmark`) ; la vitrine entière
 * est la zone où le curseur ou un doigt qui glisse la trouble, le défilement
 * vertical et le zoom restant au navigateur.
 *
 * `align="start"` sert les cartes longues (IDN) : la vitrine reste en haut, collée
 * au défilement sur ordinateur, au lieu d'être centrée sur la hauteur de la carte.
 */
export function EntryDoor(props: { children: ReactNode; align?: "center" | "start" }) {
  const { t } = useDiasporaleT()
  const vitrine = useRef<HTMLElement>(null)
  const atStart = props.align === "start"
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <header className="relative z-20 mx-auto flex w-full max-w-[1060px] flex-wrap items-center justify-end gap-3 px-5 py-4">
        <AppDemoChip />
        <LanguageSwitch />
        <AppearanceToggle />
      </header>
      <main id="contenu" className="flex flex-1 items-center">
        <div
          className={cn(
            "mx-auto grid w-full max-w-[1060px] gap-5 px-5 pb-8 pt-2 min-[960px]:grid-cols-[minmax(0,1fr)_420px] min-[960px]:gap-16 min-[960px]:pb-20 min-[960px]:pt-12",
            atStart ? "items-start" : "items-center",
          )}
        >
          <section
            ref={vitrine}
            aria-labelledby="vitrine-titre"
            className={cn(
              "relative isolate mx-auto w-full max-w-[480px] touch-pan-y touch-pinch-zoom text-center min-[960px]:text-left",
              atStart ? "min-[960px]:sticky min-[960px]:top-12" : "min-[960px]:-mt-12",
            )}
          >
            <NextLink
              href={routes.home()}
              aria-label={t("nav.home")}
              translate="no"
              className="inline-block rounded-md font-display text-[38px] font-bold leading-none tracking-[-0.025em] text-primary focus-visible:shadow-focus min-[960px]:text-[76px]"
            >
              <LiquidWordmark text={t("brand.name")} areaRef={vitrine} />
            </NextLink>
            <h1 id="vitrine-titre" className="mt-3 whitespace-pre-line font-display text-[25px] font-semibold leading-[1.15] tracking-tight min-[960px]:mt-6 min-[960px]:text-[38px]">
              {t("landing.title")}
            </h1>
            <p className="mt-4 hidden max-w-[420px] text-lg leading-relaxed text-muted-foreground min-[960px]:block">{t("landing.lead")}</p>
            <OpenCommunities />
          </section>
          <div className="relative z-10 mx-auto w-full min-w-0 max-w-[420px]">
            {props.children}
            <p className="mt-4 text-center text-[13px] text-muted-foreground">
              {t("landing.free")} {t("landing.eligibility")}
            </p>
          </div>
        </div>
      </main>
      <SiteFooter compact />
    </div>
  )
}

/** La carte d'une étape de la porte (code, IDN) : son titre, sa phrase d'appui, son contenu. */
export function EntryCard(props: { title: string; lead?: string; children: ReactNode }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="rounded-xl bg-card p-4 shadow-float sm:p-6">
      <h2 id={titleId} className="text-xl font-semibold">
        {props.title}
      </h2>
      {props.lead ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{props.lead}</p> : null}
      <div className="mt-5 flex flex-col gap-5">{props.children}</div>
    </section>
  )
}

/** Pays réellement ouverts, sans chiffre promotionnel ni contenu du réseau fermé. */
function OpenCommunities() {
  const { t } = useDiasporaleT()
  const open = useOpenCountries()
  if (open.status !== "ready" || open.data.length === 0) return null
  return (
    <section aria-labelledby="pays-ouverts" className="mt-8 hidden min-[960px]:block">
      <h2 id="pays-ouverts" className="mb-3 text-sm text-muted-foreground">
        {t("landing.boardTitle")}
      </h2>
      <ul className="flex flex-wrap gap-2">
        {open.data.map((item) => (
          <li key={item.country} className="flex items-center gap-2">
            <CountryTag country={item.country} size="md" />
            {item.counters.dormant ? <span className="text-[13px] text-muted-foreground">{t("hub.soon")}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
