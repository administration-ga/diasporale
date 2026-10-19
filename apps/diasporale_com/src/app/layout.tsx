import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

import { AppearanceBootScript } from "@/components/appearance-boot-script"
import { Providers } from "@/components/providers"
import { getAppT } from "@/i18n/server"
import { DEFAULT_CHARTE } from "@/lib/appearance"
import { anchors } from "@/lib/routes"

import "./globals.css"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return {
    title: { default: t("meta.title"), template: t("meta.titleTemplate") },
    description: t("meta.description"),
    applicationName: t("brand.name"),
    robots: { index: false, follow: false },
  }
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

/**
 * Racine de diasporale.com. La charte est posée sur <html> (`data-charte`,
 * convention du moteur) : Sable par défaut ; le script d'amorçage y pose, avant le
 * premier affichage, le thème et le mode (classe `dark`) choisis sur cet appareil,
 * que le fournisseur d'apparence tient ensuite. Les portails (feuilles, menus,
 * notifications) héritent donc des jetons.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getAppT()
  return (
    <html lang={locale} data-charte={DEFAULT_CHARTE} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Thème et mode sombre de l'appareil posés avant le premier affichage. */}
        <AppearanceBootScript />
      </head>
      <body className="min-h-dvh">
        <a
          href={anchors.content}
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:shadow-float"
        >
          {t("a11y.skipToContent")}
        </a>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  )
}
