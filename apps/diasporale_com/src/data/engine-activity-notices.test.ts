import type { Id } from "@convex/_generated/dataModel"
import { describe, expect, it } from "vitest"

import { toNotificationView } from "./engine-views"

/**
 * NP-04 : les genres communs du moteur que DIASPORALE nomme désormais — leur cible vient du moteur,
 * relue avec les droits du lecteur ; aucun contenu n'est projeté. Les deux avis de gouvernance d'une
 * page (PG-01, PR antsia 144) se lisent sans dépendre de leur déclaration dans ce moteur.
 */
type Notice = Parameters<typeof toNotificationView>[0]

const notice = (overrides: Partial<Notice> = {}): Notice => ({
  notificationId: "notice-activity-demo" as Id<"notifications">,
  kind: "page_post", subject: null,
  createdAt: 42, readAt: null, resolution: null, inviteState: null,
  fileScanStatus: null, actor: null, page: null, ...overrides,
})

const BASE = { id: "notice-activity-demo", createdAt: 42, read: false, pendingConnectionId: null, postId: null } as const

/** Un genre que ce moteur ne déclare peut-être pas encore (PR antsia 144) : la projection le lit comme une chaîne. */
const futureKind = (kind: string) => kind as unknown as Notice["kind"]

describe("cloche DIASPORALE — genres communs nommés (NP-04)", () => {
  it("une page suivie a publié : sa carte publique (adresse et nom), et la publication désignée", () => {
    const page = { pageId: "page-demo" as Id<"pages">, networkId: "network-demo" as Id<"networks">, handle: "amicale-demo", name: "Amicale de démonstration", shortName: null, logoUrl: null, badge: null, ownerKind: "association", country: "FR" } as unknown as Notice["page"]
    expect(toNotificationView(notice({ subject: { kind: "post", id: "post-demo" }, page }))).toEqual({
      ...BASE, kind: "page_post", actor: null, inviteOutcome: null, postId: "post-demo",
      page: { handle: "amicale-demo", name: "Amicale de démonstration" },
    })
    expect(toNotificationView(notice({ subject: { kind: "post", id: "post-demo" } })).page).toBeNull()
  })

  it("un album publié : l'album désigné et son auteur, par son profil publié", () => {
    const actor = { personId: "person-demo" as Id<"persons">, displayName: "Awa OGOUÉ", handle: "awa.demo", avatarUrl: null, badges: [] } as unknown as Notice["actor"]
    expect(toNotificationView(notice({ kind: "album_published", subject: { kind: "album", id: "album-demo" }, actor }))).toEqual({
      ...BASE, kind: "album_published", actor: { handle: "awa.demo", displayName: "Awa OGOUÉ" }, inviteOutcome: null, albumId: "album-demo",
    })
    expect(toNotificationView(notice({ kind: "album_published" })).albumId).toBeNull()
  })

  it("un fichier retenu : libéré seulement quand l'analyse le rend servable", () => {
    expect(toNotificationView(notice({ kind: "file_withheld", subject: { kind: "fileScan", id: "scan-demo" }, fileScanStatus: "infected" }))).toEqual({
      ...BASE, kind: "file_withheld", actor: null, inviteOutcome: null, fileReleased: false,
    })
    expect(toNotificationView(notice({ kind: "file_withheld", fileScanStatus: "clean" })).fileReleased).toBe(true)
    expect(toNotificationView(notice({ kind: "file_withheld", fileScanStatus: null })).fileReleased).toBe(false)
  })

  it("une invitation dit l'issue que le serveur a posée ; annulée ou expirée, elle n'est plus d'actualité", () => {
    const resolved = (kind: Notice["resolution"]) => kind
    expect(toNotificationView(notice({ kind: "event_invite" })).inviteOutcome).toBeNull()
    expect(toNotificationView(notice({ kind: "event_invite", resolution: resolved({ kind: "maybe", at: 1 }) })).inviteOutcome).toBe("maybe")
    expect(toNotificationView(notice({ kind: "thematic_group_invite", resolution: resolved({ kind: "accepted", at: 1 }) })).inviteOutcome).toBe("accepted")
    expect(toNotificationView(notice({ kind: "thematic_group_invite", resolution: resolved({ kind: "declined", at: 1 }) })).inviteOutcome).toBe("declined")
    expect(toNotificationView(notice({ kind: "event_invite", resolution: resolved({ kind: "cancelled", at: 1 }) })).inviteOutcome).toBe("gone")
    expect(toNotificationView(notice({ kind: "event_invite", resolution: resolved({ kind: "expired", at: 1 }) })).inviteOutcome).toBe("gone")
  })

  it("statut et badges : nommés, sans cible à projeter", () => {
    expect(toNotificationView(notice({ kind: "membership_changed" }))).toEqual({ ...BASE, kind: "membership_changed", actor: null, inviteOutcome: null })
    expect(toNotificationView(notice({ kind: "badge_changed" }))).toEqual({ ...BASE, kind: "badge_changed", actor: null, inviteOutcome: null })
  })

  it("PG-01 : la page relue par le moteur (destination typée « page »), jamais son nom ; l'invitation dit son issue", () => {
    const target = { kind: "page", pageId: "page-demo", pageHandle: "amicale-demo" } as unknown as Notice["target"]
    expect(toNotificationView(notice({ kind: futureKind("page_signatory_invite"), target, resolution: { kind: "accepted", at: 1 } }))).toEqual({
      ...BASE, kind: "page_signatory_invite", actor: null, inviteOutcome: "accepted", governancePageHandle: "amicale-demo",
    })
    expect(toNotificationView(notice({ kind: futureKind("page_claim_decided"), target })).governancePageHandle).toBe("amicale-demo")
    // Page illisible pour le lecteur, ou destination d'une autre nature : aucune adresse.
    expect(toNotificationView(notice({ kind: futureKind("page_claim_decided"), target: null })).governancePageHandle).toBeNull()
    expect(toNotificationView(notice({ kind: futureKind("page_claim_decided"), target: { kind: "personalReports" } })).governancePageHandle).toBeNull()
  })

  it("un genre que DIASPORALE ne nomme pas reste « nouvelle activité », sans erreur", () => {
    expect(toNotificationView(notice({ kind: "live_started", subject: { kind: "liveSession", id: "live-demo" } }))).toEqual({ ...BASE, kind: "other", actor: null, inviteOutcome: null })
    expect(toNotificationView(notice({ kind: futureKind("genre_inconnu_demo") })).kind).toBe("other")
  })
})
