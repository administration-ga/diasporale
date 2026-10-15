"use client"

import type { CountryCode } from "@diasporale/domain"
import { createContext, useContext, type ComponentProps, type ComponentType, type ReactNode } from "react"

/**
 * Adaptateur de routage — les surfaces de DIASPORALE ne connaissent AUCUNE URL
 * (cliquet `no-hardcoded-urls`) : l'application leur passe sa table de routes
 * (`apps/diasporale_com/src/lib/routes.ts`) et son composant de lien. Même
 * principe que l'adaptateur du moteur (`useRoutes()`, PA6).
 */
export interface FeatureRoutes {
  profile(handle: string): string
  /** Une publication, ouverte seule (depuis la cloche, un signet, son horodatage). */
  post(postId: string): string
  page(handle: string): string
  hub(country: CountryCode): string
  feed(): string
  sponsor(): string
  settings(): string
  attestation(): string
  enter(): string
}

export type LinkComponent = ComponentType<
  Omit<ComponentProps<"a">, "href"> & { href: string; children?: ReactNode }
>

interface RoutingValue {
  readonly routes: FeatureRoutes
  readonly Link: LinkComponent
}

const RoutingContext = createContext<RoutingValue | null>(null)

export function RoutingProvider(props: { routes: FeatureRoutes; Link: LinkComponent; children: ReactNode }) {
  return <RoutingContext.Provider value={{ routes: props.routes, Link: props.Link }}>{props.children}</RoutingContext.Provider>
}

export function useRouting(): RoutingValue {
  const value = useContext(RoutingContext)
  if (value === null) throw new Error("RoutingProvider manquant : l'application doit fournir sa table de routes.")
  return value
}
