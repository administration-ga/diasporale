import type { Id } from "@convex/_generated/dataModel"
import { describe, expect, it } from "vitest"

import { toNotificationView } from "./engine-views"

type Notice = Parameters<typeof toNotificationView>[0]
const EVENT = "event-notice-demo" as Id<"events">
const notice = (overrides: Partial<Notice> = {}): Notice => ({
  notificationId: "notice-demo" as Id<"notifications">,
  kind: "association_event_reminder", subject: { kind: "event", id: EVENT },
  createdAt: 42, readAt: null, resolution: null, inviteState: null,
  fileScanStatus: null, actor: null, page: null,
  associationEvent: { eventId: EVENT, pageHandle: "association-demo" }, ...overrides,
})

describe("rappel associatif dans la cloche DIASPORALE", () => {
  it("projette le lien gardé et une phrase système sans détails du contenu", () => {
    expect(toNotificationView(notice())).toEqual({
      id: "notice-demo", kind: "association_event_reminder", actor: null,
      createdAt: 42, read: false, pendingConnectionId: null, inviteOutcome: null,
      postId: null, associationEvent: { eventId: EVENT, pageHandle: "association-demo" },
    })
  })
  it("n'invente aucune destination lorsque référence et lien ne concordent pas", () => {
    expect(toNotificationView(notice({ subject: { kind: "event", id: "autre" } })).associationEvent).toBeNull()
    expect(toNotificationView(notice({ associationEvent: null })).associationEvent).toBeNull()
    expect(toNotificationView(notice({ subject: null })).associationEvent).toBeNull()
  })
  it("préserve le format des autres genres et ne leur ajoute aucun lien d'événement", () => {
    const projected = toNotificationView(notice({ kind: "post_reaction", subject: { kind: "post", id: "post-demo" } }))
    expect(projected.kind).toBe("post_reaction")
    expect(projected.postId).toBe("post-demo")
    expect(projected).not.toHaveProperty("associationEvent")
  })
})
