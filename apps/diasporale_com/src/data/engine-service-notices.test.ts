/** Projection des avis de mise en relation du moteur (DG-010, DG-015, DG-016) vers la cloche DIASPORALE. */
import type { Id } from "@convex/_generated/dataModel"
import { SERVICE_NOTIFICATION_KINDS } from "@diasporale/features/data"
import { describe, expect, it } from "vitest"

import { toNotificationView } from "./engine-views"

type Notice = Parameters<typeof toNotificationView>[0]
const REQUEST = "service-request-demo" as Id<"serviceRequests">

const notice = (overrides: Partial<Notice> = {}): Notice => ({
  notificationId: "notice-service" as Id<"notifications">,
  kind: "service_request_received", subject: null,
  createdAt: 42, readAt: null, resolution: null, inviteState: null,
  fileScanStatus: null, actor: null, page: null,
  serviceNotice: { audience: "provider", requestId: REQUEST, pageHandle: "salon-demo" }, ...overrides,
})

describe("avis de mise en relation dans la cloche DIASPORALE", () => {
  it("projette l'interlocuteur et les références relues par le moteur, sans acteur ni contenu", () => {
    expect(toNotificationView(notice())).toEqual({
      id: "notice-service", kind: "service_request_received", actor: null,
      createdAt: 42, read: false, pendingConnectionId: null, inviteOutcome: null, postId: null,
      serviceNotice: { audience: "provider", requestId: REQUEST, pageHandle: "salon-demo" },
    })
  })

  it("dit chaque genre de la tranche, jamais « nouvelle activité »", () => {
    for (const kind of SERVICE_NOTIFICATION_KINDS) {
      const view = toNotificationView(notice({ kind, readAt: 7, serviceNotice: { audience: "member", requestId: null, pageHandle: "collectif-demo" } }))
      expect(view).toMatchObject({ kind, read: true, serviceNotice: { audience: "member", requestId: null, pageHandle: "collectif-demo" } })
    }
  })

  it("une cible qui ne se lit plus ne donne aucun lien ; rien n'est inventé à sa place", () => {
    expect(toNotificationView(notice({ serviceNotice: null })).serviceNotice).toBeNull()
    expect(toNotificationView(notice({ serviceNotice: undefined })).serviceNotice).toBeNull()
  })

  it("aucune donnée privée n'entre dans la vue : ni besoin, ni montant, ni personne", () => {
    const json = JSON.stringify(toNotificationView(notice({ kind: "service_proposal_received", serviceNotice: { audience: "requester", requestId: REQUEST, pageHandle: "salon-demo" } })))
    for (const privateKey of ["need", "amountMinor", "startAt", "personId", "displayName"]) expect(json).not.toContain(privateKey)
  })

  it("les autres genres gardent leur forme et ne reçoivent aucune cible de mise en relation", () => {
    const projected = toNotificationView(notice({ kind: "post_reaction", subject: { kind: "post", id: "post-demo" }, serviceNotice: undefined }))
    expect(projected.kind).toBe("post_reaction")
    expect(projected.postId).toBe("post-demo")
    expect(projected).not.toHaveProperty("serviceNotice")
  })
})
