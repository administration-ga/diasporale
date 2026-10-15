"use client"

import { RoutingProvider, type FeatureRoutes, type LinkComponent } from "@diasporale/features"
import { DataSourceProvider, type DiasporaleDataSource } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import type { Locale } from "@diasporale/features/i18n"
import { ThemeProvider } from "next-themes"
import NextLink from "next/link"
import { useState, type ReactNode } from "react"
import { Toaster } from "sonner"

import { publicEnv } from "@/lib/env"
import { routes } from "@/lib/routes"

import { DemoFloatingCard } from "./site-chrome"

/** La table de routes, telle que les surfaces de `@diasporale/features` la consomment. */
const featureRoutes: FeatureRoutes = {
  profile: routes.profile,
  page: routes.page,
  hub: routes.hub,
  feed: () => routes.feed(),
  sponsor: routes.sponsor,
  settings: routes.settings,
  attestation: routes.attestation,
  enter: routes.enter,
}

const AppLink: LinkComponent = ({ href, children, ...rest }) => (
  <NextLink href={href} {...rest}>
    {children}
  </NextLink>
)

/**
 * La source de données de l'application. Aujourd'hui : le fournisseur de
 * DÉMONSTRATION (données fictives, ce navigateur seulement). Le moteur ANTIA le
 * remplace au câblage (PD2/PD4) — c'est ici, et seulement ici, que le choix se fait.
 */
function createDataSource(): DiasporaleDataSource {
  if (publicEnv.dataSource === "engine") {
    throw new Error("Le moteur ANTIA n'est pas encore câblé (PD2) : NEXT_PUBLIC_DIASPORALE_DATA_SOURCE doit valoir « demo ».")
  }
  return createDemoDataSource(new DemoStore(typeof window === "undefined" ? null : window.localStorage))
}

export function Providers(props: { locale: Locale; children: ReactNode }) {
  const [source] = useState(createDataSource)
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider locale={props.locale}>
        <DataSourceProvider source={source}>
          <RoutingProvider routes={featureRoutes} Link={AppLink}>
            {props.children}
            {/* Une seule pile pour tout ce qui flotte (charte v2 §7) : cartes flottantes et
                notifications, en bas à droite ; au téléphone, pleine largeur au-dessus de la
                barre basse. Déployée : une carte flottante n'est jamais cachée derrière une autre. */}
            <Toaster
              position="bottom-right"
              offset={{ bottom: 88, right: 24 }}
              mobileOffset={{ bottom: 88, left: 12, right: 12 }}
              expand
              visibleToasts={4}
              gap={10}
              toastOptions={{
                classNames: {
                  toast: "!rounded-xl !border-0 !bg-popover !text-popover-foreground !shadow-float !font-sans",
                  description: "!text-muted-foreground",
                },
              }}
            />
            <DemoFloatingCard />
          </RoutingProvider>
        </DataSourceProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}
