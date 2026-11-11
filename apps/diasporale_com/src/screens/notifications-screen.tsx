"use client"

import { NotificationsCenter } from "@diasporale/features"
import { useDataSource, type MembershipView } from "@diasporale/features/data"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"

/**
 * `/notifications` — tous mes avis de la cloche (NP-04), dans la coque de membre : la suite au
 * curseur du serveur, le filtre « Non lues », les sections « Nouveau » et « Plus tôt ». La feuille
 * de la cloche y mène par « Voir toutes les notifications ».
 */
export function NotificationsScreen() {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <Notifications membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

/** Un autre lecteur, ou une autre source, repart d'une liste vierge : aucune page lue n'est réutilisée. */
function Notifications({ membership }: { membership: MembershipView }) {
  const source = useDataSource()
  return <NotificationsCenter key={`${source.kind}:${membership.personId}`} />
}
