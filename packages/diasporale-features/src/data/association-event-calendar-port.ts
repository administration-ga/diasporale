/** DG-023 : mes inscriptions dans l'agenda, et copie iCalendar ponctuelle. */
import type { ActionResult } from "./port"
import type { Loadable } from "./types"
import type { AssociationActivityPage } from "./association-activities-port"

/** La frontière reste fixe pendant le parcours ; le classement visuel peut continuer à évoluer. */
export type AssociationAgendaPeriod = "upcoming" | "history"

export interface AssociationAgendaPageInput {
  readonly anchor: number
  readonly period: AssociationAgendaPeriod
  readonly cursor: string | null
  readonly readerPersonId: string
}

export interface AssociationAgendaEventView {
  readonly kind: "association"
  readonly eventId: string
  readonly pageId: string
  readonly title: string
  readonly description: string | null
  readonly location: string | null
  readonly startAt: number
  readonly endAt: number
  readonly timeZone: string
  readonly status: "scheduled" | "cancelled"
  readonly cancelledAt: number | null
  readonly version: number
  readonly organizer: { readonly name: string; readonly handle: string }
  /** Une attente n'est ni une invitation personnelle ni une place confirmée. */
  readonly registration: "confirmed" | "waitlisted"
}

export interface AssociationAgendaView {
  readonly items: readonly AssociationAgendaEventView[]
  readonly truncated: boolean
}

export interface AssociationEventCalendarFile {
  readonly filename: string
  readonly content: string
  readonly mediaType: "text/calendar;charset=utf-8"
}

export interface AssociationEventCalendarCapability {
  readonly mode: "engine" | "demonstration"
  useAgenda(input: { readonly now: number; readonly from?: number; readonly to?: number }): Loadable<AssociationAgendaView>
  /** Facultatif pour préserver les fournisseurs historiques. Chaque page relit les droits actuels. */
  useAgendaPage?(input: AssociationAgendaPageInput): Loadable<AssociationActivityPage<AssociationAgendaEventView>>
  /** Lecture fraîche authentifiée ; ne crée ni inscription ni abonnement extérieur. */
  exportIcal(eventId: string): Promise<ActionResult<AssociationEventCalendarFile>>
}
