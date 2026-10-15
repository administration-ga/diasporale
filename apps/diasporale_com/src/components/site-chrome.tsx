"use client"

import { Button, DemoBanner, DemoChip } from "@diasporale/features"
import { useDataSource } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import NextLink from "next/link"
import type { ReactNode } from "react"

import { routes } from "@/lib/routes"

import { useDismissal, useFloatingCard } from "./floating-cards"
import { LanguageSwitch, ThemeSwitch } from "./preferences"
import { Wordmark } from "./wordmark"

/** Lien d'action d'une carte flottante : le bleu des liens, souligné au survol. */
export const floatingLinkClass =
  "inline-flex min-h-8 items-center gap-1 text-primary underline-offset-2 hover:underline focus-visible:shadow-focus"

const DEMO_CARD = { id: "diasporale-demonstration", dismissKey: "diasporale:carte:demonstration" } as const

/**
 * La carte flottante de la démonstration, avec l'accès aux comptes fictifs.
 * Montée une fois pour toute l'application (providers) : elle ne se rejoue pas
 * d'une page à l'autre. Écartée, elle le reste pour la session ; le repère
 * « Démo » de l'en-tête (`AppDemoChip`), lui, ne part jamais.
 */
export function DemoFloatingCard() {
  const { t, locale } = useDiasporaleT()
  const source = useDataSource()
  useFloatingCard({
    ...DEMO_CARD,
    store: "session",
    version: locale,
    content:
      source.kind === "demo"
        ? (dismiss) => (
            <DemoBanner
              onDismiss={dismiss}
              action={
                <NextLink href={routes.demo()} className={floatingLinkClass}>
                  {t("demo.accountsLink")}
                </NextLink>
              }
            />
          )
        : null,
  })
  return null
}

/** Le repère permanent du mode démonstration ; un clic rouvre la carte qui l'explique. */
export function AppDemoChip() {
  const source = useDataSource()
  const { restore } = useDismissal(DEMO_CARD.dismissKey, "session")
  if (source.kind !== "demo") return null
  return <DemoChip onClick={restore} />
}

/** Chrome des pages publiques (vitrine, entrée, textes) : mot-symbole, langue, entrée. */
export function PublicShell(props: { children: ReactNode; hideEnter?: boolean }) {
  const { t } = useDiasporaleT()
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-3 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <NextLink href={routes.home()} aria-label={t("nav.home")} className="rounded-md focus-visible:shadow-focus">
            <Wordmark />
          </NextLink>
          <AppDemoChip />
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitch className="hidden sm:inline-flex" />
          {props.hideEnter ? null : (
            <Button asChild size="md">
              <NextLink href={routes.enter()}>{t("nav.enter")}</NextLink>
            </Button>
          )}
        </div>
      </header>
      <main id="contenu" className="flex-1">
        {props.children}
      </main>
      <SiteFooter />
    </div>
  )
}

export function SiteFooter() {
  const { t } = useDiasporaleT()
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-6 px-4 py-8 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <Wordmark />
          <p className="max-w-sm text-[13px] text-muted-foreground">{t("footer.publisher")}</p>
        </div>
        <nav aria-label={t("footer.label")} className="flex flex-col gap-2 text-sm">
          <NextLink href={routes.legalNotice()} className="hover:underline focus-visible:shadow-focus">
            {t("footer.legalNotice")}
          </NextLink>
          <NextLink href={routes.privacy()} className="hover:underline focus-visible:shadow-focus">
            {t("footer.privacy")}
          </NextLink>
          <NextLink href={routes.charte()} className="hover:underline focus-visible:shadow-focus">
            {t("footer.charte")}
          </NextLink>
        </nav>
        <div className="flex flex-col gap-2">
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </div>
    </footer>
  )
}
