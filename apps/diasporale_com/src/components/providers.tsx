"use client"

import { RoutingProvider, type FeatureRoutes, type LinkComponent } from "@diasporale/features"
import { DataSourceProvider } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { I18nProvider, useDiasporaleT } from "@diasporale/features/i18n/client"
import type { Locale } from "@diasporale/features/i18n"
import { ThemeProvider } from "next-themes"
import NextLink from "next/link"
import { useState, type ReactNode } from "react"

import { EngineDataProviders } from "@/data/engine-providers"
import { publicEnv } from "@/lib/env"
import { routes } from "@/lib/routes"

import { DemoFloatingCard } from "./site-chrome"
import { ToastRegion } from "./toast-region"

/** La table de routes, telle que les surfaces de `@diasporale/features` la consomment. */
const featureRoutes: FeatureRoutes = {
  profile: routes.profile,
  post: routes.post,
  page: routes.page,
  associationEvent: routes.associationEvent,
  // Liens profonds des avis de mise en relation (cloche) : chaque route relit les droits à l'ouverture.
  serviceRequest: routes.serviceRequest,
  activityRequest: routes.activityRequest,
  associationMembers: routes.associationMembers,
  myAssociations: routes.myAssociations,
  // Avis de décision de modération : « Mes données », ou l'onglet des décisions de la page (droits relus).
  myDecisions: routes.settingsData,
  pageDecisions: routes.pageDecisions,
  // Avis de la vie communautaire (vague H) : chaque route relit les droits à l'ouverture.
  mutualAidItem: routes.mutualAidItem,
  myMentoring: routes.myMentoring,
  jobsActivity: () => routes.myActivity("emplois"),
  pageJobs: (handle) => routes.pageManage(handle, "emplois"),
  myApplications: routes.myApplications,
  arrivalKitResource: routes.arrivalKitResource,
  contextualConversation: routes.contextualConversation,
  hub: routes.hub,
  feed: (tag, context) => routes.feed(context?.scope, tag, context?.country),
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

/** Le fournisseur de DÉMONSTRATION : données fictives, dans ce navigateur seulement. */
function DemoDataProvider(props: { children: ReactNode }) {
  const [source] = useState(() => createDemoDataSource(new DemoStore(typeof window === "undefined" ? null : window.localStorage)))
  return <DataSourceProvider source={source}>{props.children}</DataSourceProvider>
}

/**
 * La source de données de l'application — c'est ici, et seulement ici, que le
 * choix se fait (`NEXT_PUBLIC_DIASPORALE_DATA_SOURCE`) : la démonstration, ou le
 * moteur ANTSIA (PD2 : session, Convex du moteur, tranche `diaspora`).
 */
function DataProviders(props: { children: ReactNode }) {
  if (publicEnv.dataSource === "engine") return <EngineDataProviders>{props.children}</EngineDataProviders>
  return <DemoDataProvider>{props.children}</DemoDataProvider>
}

/**
 * Une seule pile pour tout ce qui flotte (charte v2 §7) : cartes flottantes et
 * confirmations, en bas à droite ; au téléphone, pleine largeur au-dessus de la
 * barre basse. Déployée : une carte flottante n'est jamais cachée derrière une
 * autre. Sa zone s'annonce « Avis » : « Notifications », c'est la cloche.
 *
 * Couches (charte §4) : barres 40 < feuilles 50 < pile des avis 55 < menus 60.
 * Un avis passager reste lisible au-dessus d'une feuille, et un menu ouvert
 * passe devant une carte flottante (sonner se pose sinon à 999999999).
 * La pile vit dans sa propre région, exemptée de l'inertage des modales
 * (`toast-region.tsx`) : un avis émis pendant une visionneuse reste annoncé.
 */
function FloatingStack() {
  const { t } = useDiasporaleT()
  return (
    <ToastRegion
      className="!z-55"
      containerAriaLabel={t("notice.region")}
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
  )
}

export function Providers(props: { locale: Locale; children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider locale={props.locale}>
        <DataProviders>
          <RoutingProvider routes={featureRoutes} Link={AppLink}>
            {props.children}
            <FloatingStack />
            <DemoFloatingCard />
          </RoutingProvider>
        </DataProviders>
      </I18nProvider>
    </ThemeProvider>
  )
}
