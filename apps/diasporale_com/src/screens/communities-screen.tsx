"use client"

import { Gate } from "@/components/gate"

import { HubScreen } from "./hub-screen"

/**
 * `/communautes` — Communautés (DG-005) : le hub de MON pays, celui de résidence,
 * monté tel que `hub-screen.tsx` l'exporte (une seule coque : c'est lui qui la pose).
 * Le hub pose lui-même, en tête, les rubriques de la vie communautaire du pays
 * (kit d'arrivée, entraide, mentorat, emploi, services, pages, et l'agenda
 * personnel), comme sur le hub de tout autre pays (HB-04). Changer de zone y reste
 * visible : « Changer de pays » mène au hub d'un autre pays (`/pays/<iso>`), où la
 * coque annonce la zone consultée et le retour ici. Aucun de ces gestes ne modifie
 * la résidence du membre, qui ne change que dans ses réglages.
 */
export function CommunitiesScreen() {
  return (
    <Gate require="member">
      {(session) => (session.membership ? <HubScreen iso={session.membership.facet.countryOfResidence} /> : null)}
    </Gate>
  )
}
