"use client"

import { useDiasporaleT } from "@diasporale/features/i18n/client"
import type { ErrorInfo } from "next/error"

import { AppearanceBootScript } from "@/components/appearance-boot-script"
import { AppErrorScreen, GlobalErrorProviders, useBrowserLocale } from "@/components/app-error"
import { DEFAULT_CHARTE } from "@/lib/appearance"

import "./globals.css"

/** Le titre de l'onglet : les métadonnées ne s'exportent pas d'ici, la balise est hissée dans `<head>`. */
function DocumentTitle() {
  const { t } = useDiasporaleT()
  return <title>{t("meta.title")}</title>
}

/**
 * Quand la mise en page racine elle-même casse (UX-01), cette page la remplace : elle
 * pose seule son document, la feuille de la charte, la charte Sable par défaut, puis
 * le thème et le mode choisis sur l'appareil (script d'amorçage au rendu serveur,
 * fournisseur d'apparence dans le navigateur), et la langue de la personne.
 */
export default function GlobalError({ error, retry }: ErrorInfo) {
  const locale = useBrowserLocale()
  return (
    <html lang={locale} data-charte={DEFAULT_CHARTE} suppressHydrationWarning>
      <head>
        <AppearanceBootScript />
      </head>
      <body className="min-h-dvh">
        <GlobalErrorProviders locale={locale}>
          <DocumentTitle />
          <AppErrorScreen error={error} onRetry={retry} documentNavigation />
        </GlobalErrorProviders>
      </body>
    </html>
  )
}
