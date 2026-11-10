import type { Id } from "@convex/_generated/dataModel"
import { describe, expect, it } from "vitest"

import { toNotificationView } from "./engine-views"

/** ET-01 : les avis du moteur au bénévole inscrit — mission annulée, horaire changé. */
type Notice = Parameters<typeof toNotificationView>[0]
const MISSION = "mission-notice-demo"
const notice = (overrides: Partial<Notice> = {}): Notice => ({
  notificationId: "notice-mission-demo" as Id<"notifications">,
  kind: "aid_mission_cancelled", subject: null,
  createdAt: 42, readAt: null, resolution: null, inviteState: null,
  fileScanStatus: null, actor: null, page: null,
  communityNotice: { audience: "volunteer", opens: "aidMission", objectId: MISSION, pageHandle: "collectif-demo" }, ...overrides,
})

describe("avis de mission au bénévole dans la cloche DIASPORALE", () => {
  it("dit chaque genre par son nom et garde l'objet relu par le moteur, sans acteur", () => {
    for (const kind of ["aid_mission_cancelled", "aid_mission_rescheduled"] as const) {
      expect(toNotificationView(notice({ kind }))).toEqual({
        id: "notice-mission-demo", kind, actor: null,
        createdAt: 42, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null,
        communityNotice: { audience: "volunteer", opens: "aidMission", objectId: MISSION, pageHandle: "collectif-demo" },
      })
    }
  })

  it("un objet qui ne se lit plus n'offre aucune destination", () => {
    expect(toNotificationView(notice({ communityNotice: null })).communityNotice).toBeNull()
  })
})
