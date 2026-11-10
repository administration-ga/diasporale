"use client"

import { AppearanceProvider } from "@antsia/social-features/shell/appearance"
import { Button } from "@diasporale/features"
import { DEFAULT_LOCALE, type Locale } from "@diasporale/features/i18n"
import { I18nProvider, useDiasporaleT } from "@diasporale/features/i18n/client"
import { ArrowLeftIcon, RefreshCwIcon, RotateCwIcon } from "lucide-react"
import NextLink from "next/link"
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react"

import { localeFromBrowser } from "@/i18n/browser-locale"
import { isStaleBuildError } from "@/lib/app-error"
import { APPEARANCE } from "@/lib/appearance"
import { routes } from "@/lib/routes"

import { Wordmark } from "./wordmark"

/**
 * La page d'erreur de l'application (UX-01), à la marque : ce qui s'est passé, en
 * clair et sans aucun détail technique (ni message, ni identifiant), puis l'issue.
 *  · Incident de rendu : « Réessayer » relance l'écran (`retry` du cadre), « Revenir
 *    au fil » en sort.
 *  · Fichier de l'ancienne version introuvable après une publication du site : la
 *    page dit « nouvelle version disponible » et « Recharger » suffit — un
 *    rechargement complet, le seul qui ramène les fichiers de la version servie.
 * Le focus va au titre à l'affichage : la personne au clavier ou au lecteur d'écran
 * apprend aussitôt ce qui arrive. Aucune erreur n'est envoyée à un tiers (aucune
 * mesure d'usage n'est décidée, plan 17).
 *
 * `documentNavigation` : la page globale remplace la mise en page racine ; elle sort
 * par une navigation complète, qui remonte toute l'application.
 */
export function AppErrorScreen(props: { error: unknown; onRetry: () => void; documentNavigation?: boolean }) {
  const { t } = useDiasporaleT()
  const title = useRef<HTMLHeadingElement>(null)
  const stale = isStaleBuildError(props.error)

  useEffect(() => {
    title.current?.focus()
  }, [])

  const back = (
    <>
      <ArrowLeftIcon aria-hidden />
      {t("appError.backToFeed")}
    </>
  )

  return (
    <main id="contenu" className="mx-auto flex min-h-[60dvh] w-full max-w-[640px] flex-col items-start justify-center gap-4 px-4 py-10">
      <Wordmark />
      <h1 ref={title} tabIndex={-1} className="rounded-sm font-display text-3xl font-bold focus-visible:shadow-focus">
        {t(stale ? "appError.stale.title" : "appError.title")}
      </h1>
      <p className="text-muted-foreground">{t(stale ? "appError.stale.body" : "appError.body")}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {stale ? (
          // Recharger, pas relancer : l'écran demanderait encore les fichiers de l'ancienne version.
          <Button onClick={() => window.location.reload()}>
            <RefreshCwIcon aria-hidden />
            {t("appError.stale.reload")}
          </Button>
        ) : (
          <Button onClick={props.onRetry}>
            <RotateCwIcon aria-hidden />
            {t("appError.retry")}
          </Button>
        )}
        <Button asChild variant="outline">
          {props.documentNavigation ? (
            <a href={routes.feed()}>{back}</a>
          ) : (
            <NextLink href={routes.feed()}>{back}</NextLink>
          )}
        </Button>
      </div>
    </main>
  )
}

const neverChanges = () => () => {}

/** Le serveur ne la connaît pas : le français au rendu serveur, celle de la personne dès le navigateur. */
function readBrowserLocale(): Locale {
  return localeFromBrowser({ cookie: document.cookie, languages: navigator.languages })
}

/** La langue de la page d'erreur globale : cookie de langue, puis langues du navigateur (`localeFromBrowser`). */
export function useBrowserLocale(): Locale {
  return useSyncExternalStore(neverChanges, readBrowserLocale, () => DEFAULT_LOCALE)
}

/**
 * Ce que la mise en page racine apporte d'ordinaire, et que la page d'erreur globale
 * doit se donner seule : la langue et l'apparence choisies (thème, mode sombre), lues
 * sur cet appareil comme le fait le fournisseur de l'application.
 */
export function GlobalErrorProviders(props: { locale: Locale; children: ReactNode }) {
  return (
    <AppearanceProvider storagePrefix={APPEARANCE.storagePrefix} themes={APPEARANCE.themes}>
      <I18nProvider locale={props.locale}>{props.children}</I18nProvider>
    </AppearanceProvider>
  )
}
