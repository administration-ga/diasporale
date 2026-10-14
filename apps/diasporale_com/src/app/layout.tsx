import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"

import { Providers } from "@/components/providers"
import { getAppT } from "@/i18n/server"
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
 * convention du moteur) ; `next-themes` y pose la classe `dark` ; les portails
 * (feuilles, menus, notifications) héritent donc des jetons.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const { locale, t } = await getAppT()
  return (
    <html lang={locale} data-charte="diasporale" suppressHydrationWarning>
      <body className="min-h-dvh">
        <a
          href={anchors.content}
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-card focus:px-4 focus:py-2 focus:shadow-lg"
        >
          {t("a11y.skipToContent")}
        </a>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  )
}
