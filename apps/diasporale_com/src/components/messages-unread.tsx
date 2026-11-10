"use client"

/**
 * Les non-lus de « Messages » (UX-06) : les DEUX décomptes que le serveur du moteur tient déjà
 * (tête-à-tête et groupes, `totalUnread` dans le réseau courant), réunis par la règle de la coque
 * du moteur (`messagesUnreadTotal`, plafonnée) : la barre et la carte iCom ne disent jamais deux
 * chiffres différents.
 *
 * Monté SOUS l'îlot iCom, et seulement quand iCom est ouvert : aucune lecture en démonstration, ni
 * pour un membre qui ne peut pas encore écrire. Les conversations de mise en relation ne comptent
 * pas : le plan 04 ne tranche pas, et la boîte de réception d'iCom (« Toutes ») ne montre que les
 * tête-à-tête et les groupes ; les mises en relation ont leur filtre, sans décompte au serveur.
 * Un nombre seulement, aucun contenu.
 */
import { api } from "@antsia/api/engine"
import { useAuthenticatedConvexQuery } from "@antsia/api/hooks"
import { useNetwork } from "@antsia/api/network"
import { messagesUnreadTotal } from "@antsia/social-features/shell/reseau-menu-destinations"
import { useEffect } from "react"

/** Remonte à la coque le chiffre de la pastille ; ne rend rien. */
export function MessagesUnreadReader(props: { onTotal: (total: number) => void }) {
  const { networkId } = useNetwork()
  const directs = useAuthenticatedConvexQuery(api.modules.messaging.inbox.totalUnread, { networkId })
  const groups = useAuthenticatedConvexQuery(api.modules.groups.threads.totalUnread, { networkId })
  const total = messagesUnreadTotal(directs.data, groups.data)
  const { onTotal } = props
  useEffect(() => {
    onTotal(total)
  }, [onTotal, total])
  // Démonté (iCom fermé, sortie) : aucun chiffre ne reste posé sur la barre.
  useEffect(() => () => onTotal(0), [onTotal])
  return null
}
