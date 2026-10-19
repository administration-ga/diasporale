/** DG-023 : la galerie commence après la fin réelle, dans le fuseau UTC stocké. */
export function isAssociationEventGalleryOpen(event: { readonly endAt: number; readonly status: "scheduled" | "cancelled" }, now: number): boolean {
  return event.status === "scheduled" && Number.isFinite(event.endAt) && Number.isFinite(now) && now >= event.endAt
}
