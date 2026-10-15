"use client"

/**
 * Le branchement de diasporale.com sur le moteur ANTIA (PD2) : client Convex du
 * moteur, session Better Auth par le proxy `/api/auth/*` de cette origine,
 * création de la personne à la première session (`ensureMyPerson`, rien n'est
 * recopié ni publié), puis la source de données « moteur » pour tout l'arbre.
 */
import type { RefreshableCrossDomainAuthClient } from "@antia/api/cross-domain-session-bootstrap"
import { EngineConvexProvider } from "@antia/api/next-provider"
import { api } from "@convex/_generated/api"
import { DataSourceProvider } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { useConvex } from "convex/react"
import { type ReactNode, useState } from "react"

import { EngineIcom } from "@/components/icom"
import { authClient } from "@/lib/auth-client"
import { publicEnv } from "@/lib/env"

import { createEngineDataSource } from "./engine-source"

/** La source « moteur », créée une fois, sous le client Convex du moteur. */
function EngineSource(props: { children: ReactNode }) {
  const convex = useConvex()
  const [source] = useState(() => createEngineDataSource({ convex, authClient }))
  return <DataSourceProvider source={source}>{props.children}</DataSourceProvider>
}

export function EngineDataProviders(props: { children: ReactNode }) {
  const { t } = useDiasporaleT()
  if (!publicEnv.convexUrl) {
    // Moteur non configuré (variable absente) : un avertissement plutôt qu'un écran blanc.
    return (
      <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6">
        <p role="alert" className="rounded-xl bg-card p-4 text-card-foreground shadow-sm">
          {t("engine.backendMissing")}
        </p>
      </main>
    )
  }
  return (
    <EngineConvexProvider
      convexUrl={publicEnv.convexUrl}
      authClient={authClient as unknown as RefreshableCrossDomainAuthClient}
      ensurePerson={api.modules.people.persons.ensureMyPerson}
      labels={{ loading: t("engine.sessionLoading"), failed: t("engine.sessionFailed"), retry: t("engine.sessionRetry") }}
    >
      <EngineSource>
        {/* iCom (PD7) : la couche de communication du moteur, montée une fois, à côté des pages. */}
        <EngineIcom>{props.children}</EngineIcom>
      </EngineSource>
    </EngineConvexProvider>
  )
}
