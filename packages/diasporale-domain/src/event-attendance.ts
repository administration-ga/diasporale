/** DG-023 : fenêtre d'accueil et format opaque, sans identifiant ni donnée personnelle. */
export const ASSOCIATION_EVENT_ATTENDANCE_EARLY_MS = 60 * 60 * 1000
export const ASSOCIATION_EVENT_ATTENDANCE_TICKET_TTL_MS = 15 * 60 * 1000
const PREFIX = "diasporale-attendance:v1:"

export function associationEventAttendanceWindow(event: { readonly startAt: number; readonly endAt: number }): { readonly opensAt: number; readonly closesAt: number } {
  return { opensAt: event.startAt - ASSOCIATION_EVENT_ATTENDANCE_EARLY_MS, closesAt: event.endAt }
}

export function isAssociationEventAttendanceOpen(event: { readonly startAt: number; readonly endAt: number }, now: number): boolean {
  const { opensAt, closesAt } = associationEventAttendanceWindow(event)
  return Number.isFinite(event.startAt) && Number.isFinite(closesAt) && event.startAt < closesAt && Number.isFinite(now) && now >= opensAt && now < closesAt
}

/** Un texte arbitraire, une URL ou un autre QR n'est jamais interprété comme une présence. */
export function parseAssociationEventAttendanceCode(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 256) return null
  const text = value.trim()
  return /^diasporale-attendance:v1:[0-9a-f]{64}$/.test(text) ? text : null
}

export function associationEventAttendanceCode(nonce: string): string | null {
  return parseAssociationEventAttendanceCode(`${PREFIX}${nonce}`)
}
