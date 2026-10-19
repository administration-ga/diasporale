/** DG-023 : un billet personnel ne confère aucune autorité à son porteur. */
import type { ActionResult } from "./port"
import type { Loadable } from "./types"
import type { AssociationActivityPage } from "./association-activities-port"

export interface AssociationEventAttendanceView {
  readonly eventId: string
  readonly opensAt: number
  readonly closesAt: number
  readonly isOpen: boolean
  readonly canIssueTicket: boolean
  readonly canManage: boolean
  readonly checkedInAt: number | null
  readonly version: number
  /** Réservé aux responsables ; compteur de pointages enregistrés. */
  readonly recordedCount: number | null
}

export interface AssociationEventAttendanceTicket {
  readonly code: string
  readonly expiresAt: number
}

export interface AssociationEventAttendanceRow {
  readonly registrationId: string
  readonly displayName: string | null
  readonly checkedInAt: number
  readonly version: number
}

export interface AssociationEventAttendancePreview {
  readonly registrationId: string
  readonly displayName: string | null
  readonly checkedInAt: number | null
  readonly version: number
  readonly expiresAt: number
}

export interface AssociationEventAttendanceCapability {
  readonly mode: "engine" | "demonstration"
  useAttendance(eventId: string): Loadable<AssociationEventAttendanceView | null>
  usePresent(input: { readonly eventId: string; readonly cursor: string | null }): Loadable<AssociationActivityPage<AssociationEventAttendanceRow>>
  issueTicket(eventId: string): Promise<ActionResult<AssociationEventAttendanceTicket>>
  previewTicket(input: { readonly eventId: string; readonly code: string }): Promise<ActionResult<AssociationEventAttendancePreview>>
  checkIn(input: { readonly eventId: string; readonly code: string; readonly expectedVersion: number }): Promise<ActionResult<{ readonly alreadyRecorded: boolean }>>
  clear(input: { readonly eventId: string; readonly registrationId: string; readonly expectedVersion: number }): Promise<ActionResult>
}
