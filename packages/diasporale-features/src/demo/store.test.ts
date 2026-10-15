// @vitest-environment node
import { DAY_MS, HOUR_MS, type OnboardingConsentChoices } from "@diasporale/domain"
import { describe, expect, it } from "vitest"

import type { JoinInput } from "../data/port"
import {
  NOTIFICATIONS_PAGE,
  bookmarksView,
  commentsView,
  feedView,
  hubCounters,
  memberSearchView,
  membershipView,
  notificationsView,
  postDetailView,
  profileView,
  relationView,
  repliesView,
  sessionView,
  suggestionsView,
  unreadCountView,
} from "./selectors"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

/**
 * Le fournisseur de démonstration joue les parcours de recette R1, R2 et R3
 * de bout en bout, avec les règles de `@diasporale/domain` — sans réseau,
 * sans latence, à horloge maîtrisée.
 */

const T0 = Date.UTC(2026, 9, 14, 12)

function memoryStorage() {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  }
}

function demo() {
  let clock = T0
  const storage = memoryStorage()
  const store = new DemoStore(storage, () => clock, 0)
  return {
    store,
    storage,
    advance: (ms: number) => {
      clock += ms
    },
    me: () => {
      const id = store.getState().session.personId
      if (!id) throw new Error("aucune session")
      return id
    },
  }
}

const AWA = { firstName: "Awa", lastName: "Ogooué", loa: 2, gaboneseNationality: true }
const ONLY_PROFILE: OnboardingConsentChoices = { social_profile: true, directory: false, notifications: false }

function joinInput(overrides: Partial<JoinInput> = {}): JoinInput {
  return {
    facet: { countryOfResidence: "FR", city: "Lyon" },
    handle: "awa.ogooue",
    displayName: "Awa Ogooué",
    consents: ONLY_PROFILE,
    directoryVisibility: "country",
    ...overrides,
  }
}

describe("R1 — une personne inscrite entre par IDN", () => {
  it("l'entrée ne crée aucun profil ; l'onboarding crée une adhésion déclarée, badge Vérifié, adhésion ANTIA dérivée", async () => {
    const { store, me } = demo()
    expect(await store.signInWithIdn(AWA)).toEqual({ ok: true, value: null })
    const id = me()
    expect(store.getState().persons[id]?.profile).toBeNull()
    expect(store.getState().memberships[id]).toBeUndefined()
    expect(sessionView(store.getState(), T0)).toMatchObject({ status: "signed_in", membership: null })

    expect(await store.join(joinInput())).toEqual({ ok: true, value: { country: "FR" } })
    const view = membershipView(store.getState(), id, T0)
    expect(view).toMatchObject({
      handle: "awa.ogooue",
      status: "declaree",
      canPublish: true,
      // Même personne, deux politiques : ANTIA (ouvert) reconnaît l'IDN de niveau 2,
      // DIASPORALE (fermé) attend un parrainage ou l'attestation consulaire.
      root: { network: "antia", status: "verifiee", derivedFrom: "diasporale" },
      // Annuaire non consenti : masqué, quel que soit le niveau demandé.
      directoryVisibility: "hidden",
    })
    expect(view?.badges).toContain("verified")
  })

  it("trace chaque consentement de l'onboarding, accordé ou non, horodaté", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    const mine = store.getState().consents.filter((record) => record.personId === me())
    expect(mine.map((record) => [record.purpose, record.granted])).toEqual([
      ["social_profile", true],
      ["directory", false],
      ["notifications", false],
    ])
    expect(mine.every((record) => record.recordedAt === T0)).toBe(true)
  })

  it("refuse l'adhésion sans le consentement au profil social", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    const refused = await store.join(joinInput({ consents: { ...ONLY_PROFILE, social_profile: false } }))
    expect(refused).toEqual({ ok: false, code: "consent_social_profile_required" })
  })

  it("refuse le Gabon comme pays de résidence, un handle pris, un nom affiché trop court", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    expect(await store.join(joinInput({ facet: { countryOfResidence: "GA" } }))).toEqual({ ok: false, code: "country_is_home" })
    expect(await store.join(joinInput({ handle: "mireille.ivindo" }))).toEqual({ ok: false, code: "handle_taken" })
    expect(await store.join(joinInput({ handle: "a" }))).toEqual({ ok: false, code: "handle_length" })
    expect(await store.join(joinInput({ displayName: " A " }))).toEqual({ ok: false, code: "display_name_invalid" })
  })

  it("une identité IDN de nationalité non gabonaise ne fonde rien : le compte reste en attente", async () => {
    const { store, me } = demo()
    await store.signInWithIdn({ firstName: "Camille", lastName: "Martin", loa: 2, gaboneseNationality: false })
    await store.join(joinInput({ handle: "camille.martin", displayName: "Camille Martin" }))
    expect(store.statusOf(me())).toBe("en_attente")
    expect(membershipView(store.getState(), me(), T0)?.canPublish).toBe(false)
  })

  it("une seconde entrée IDN retrouve la même personne", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    const first = me()
    await store.signOutEverywhere()
    expect(store.getState().session.personId).toBeNull()
    await store.signInWithIdn(AWA)
    expect(me()).toBe(first)
  })
})

describe("R2 — vérifier une inscription consulaire", () => {
  it("l'attestation confirmée rend le compte vérifié et pose le poste, sans autre donnée consulaire", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    expect(await store.requestAttestation()).toEqual({ ok: true, value: { outcome: "verified" } })
    const view = membershipView(store.getState(), me(), T0)
    expect(view).toMatchObject({ status: "verifiee", verifiedSince: T0, attestation: { outcome: "verified", postSlug: "poste-demo-france" } })
    expect(view?.facet.postSlug).toBe("poste-demo-france")
    // Le consentement est tracé AVANT la requête, avec sa finalité propre.
    expect(store.getState().consents.some((record) => record.personId === me() && record.purpose === "consular_attestation" && record.granted)).toBe(true)
    // Plus rien à vérifier.
    expect(await store.requestAttestation()).toEqual({ ok: false, code: "attestation_not_needed" })
  })

  it("une inscription expirée n'est pas confirmée, et la demande suivante attend 24 heures", async () => {
    const { store, advance } = demo()
    await store.signInWithIdn({ firstName: "Yannick", lastName: "Nyanga", loa: 1, gaboneseNationality: true })
    await store.join(joinInput({ handle: "yannick.nyanga", displayName: "Yannick Nyanga" }))
    expect(await store.requestAttestation()).toEqual({ ok: true, value: { outcome: "not_confirmed" } })
    advance(23 * HOUR_MS)
    expect(await store.requestAttestation()).toEqual({ ok: false, code: "attestation_too_soon" })
    advance(HOUR_MS)
    expect(await store.requestAttestation()).toEqual({ ok: true, value: { outcome: "not_confirmed" } })
  })

  it("un compte léger par téléphone n'a pas d'identifiant à présenter au consulat", async () => {
    const { store } = demo()
    const sent = await store.requestCode({ kind: "phone", value: "+33 6 39 98 12 34" })
    if (!sent.ok || !sent.value.demoCode) throw new Error("code non émis")
    await store.verifyCode(sent.value.demoCode)
    await store.join(joinInput({ handle: "telephone.demo", displayName: "Compte Démo" }))
    expect(await store.requestAttestation()).toEqual({ ok: false, code: "attestation_unavailable" })
  })
})

describe("R3 — un compte léger se fait parrainer", () => {
  it("en attente puis lecture seule ; parrainé par un membre vérifié depuis plus de 30 jours, il publie (relu, pays fermé)", async () => {
    const { store, me } = demo()
    const sent = await store.requestCode({ kind: "email", value: "nouvelle@example.com" })
    if (!sent.ok || !sent.value.demoCode) throw new Error("code non émis")
    expect(await store.verifyCode("000000")).toEqual({ ok: false, code: "code_invalid" })
    expect(await store.verifyCode(sent.value.demoCode)).toEqual({ ok: true, value: null })
    const newcomer = me()
    await store.join(joinInput({ facet: { countryOfResidence: "CA", city: "Montréal" }, handle: "nouvelle.venue", displayName: "Nouvelle Venue" }))
    expect(store.statusOf(newcomer)).toBe("en_attente")

    const post = { body: "Bonjour Montréal", reach: "local" as const, audience: "public" as const, alsoOnRoot: false }
    expect(await store.publish(post)).toEqual({ ok: false, code: "publish_not_allowed" })
    expect(await store.react("post-1", "like")).toEqual({ ok: false, code: "publish_not_allowed" })
    // Lecture : le hub et le fil restent ouverts.
    expect(feedView(store.getState(), newcomer, "recents", T0).length).toBeGreaterThan(0)

    await store.switchTo("p-mireille")
    expect(await store.sponsor("@nouvelle.venue")).toEqual({ ok: true, value: null })
    await store.switchTo(newcomer)
    expect(store.statusOf(newcomer)).toBe("declaree")
    expect(membershipView(store.getState(), newcomer, T0)?.sponsoredBy).toEqual({ handle: "mireille.ivindo", displayName: "Mireille Ivindo" })
    expect(await store.publish(post)).toEqual({ ok: true, value: { moderation: "pending_review" } })
  })

  it("un pays ouvert avec deux modérateurs publie directement", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    const published = await store.publish({ body: "Bonjour Lyon", reach: "local", audience: "public", alsoOnRoot: true })
    expect(published).toEqual({ ok: true, value: { moderation: "published" } })
    expect(store.getState().posts[0]).toMatchObject({ visibility: "root", scope: { reach: "local", country: "FR" } })
  })

  it("« publier aussi sur ANTIA » est ignoré hors audience publique : la visibilité reste au réseau", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    await store.publish({ body: "Entre nous", reach: "local", audience: "connections", alsoOnRoot: true })
    expect(store.getState().posts[0]?.visibility).toBe("network")
  })

  it("refus indistinct : une cible introuvable ou déjà vérifiée", async () => {
    const { store } = demo()
    await store.switchTo("p-mireille")
    expect(await store.sponsor("personne.inconnue")).toEqual({ ok: false, code: "target_not_eligible" })
    expect(await store.sponsor("nadia.mpassa")).toEqual({ ok: false, code: "target_not_eligible" })
  })

  it("un membre vérifié depuis moins de 30 jours ne parraine pas encore", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    await store.requestAttestation()
    expect(store.statusOf(me())).toBe("verifiee")
    expect(await store.sponsor("steeve.ngounie")).toEqual({ ok: false, code: "sponsor_too_recent" })
  })

  it("retirer un parrainage fait retomber le filleul selon ses faits restants", async () => {
    const { store } = demo()
    await store.switchTo("p-nadia")
    expect(store.statusOf("p-rodrigue")).toBe("declaree")
    expect(await store.revokeSponsorship("s-2")).toEqual({ ok: true, value: null })
    expect(store.statusOf("p-rodrigue")).toBe("en_attente")
    expect(await store.revokeSponsorship("s-2")).toEqual({ ok: false, code: "already_revoked" })
  })
})

describe("consentements, annuaire, départ et effacement", () => {
  it("l'annuaire exige son consentement ; le retirer masque la fiche", async () => {
    const { store, me, advance } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    expect(await store.setDirectoryVisibility("network")).toEqual({ ok: false, code: "consent_directory_required" })
    // À horodatage égal, le refus l'emporte (règle du domaine) : le geste suivant vient après.
    advance(1000)
    await store.setConsent("directory", true)
    expect(await store.setDirectoryVisibility("network")).toEqual({ ok: true, value: null })
    await store.setConsent("directory", false)
    expect(membershipView(store.getState(), me(), T0)?.directoryVisibility).toBe("hidden")
  })

  it("retirer le consentement au profil social, c'est quitter DIASPORALE", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    await store.setConsent("social_profile", false)
    expect(store.statusOf(me())).toBe("partie")
  })

  it("l'effacement purge la personne, ses traces et ses parrainages donnés", async () => {
    const { store } = demo()
    await store.switchTo("p-mireille")
    expect(store.statusOf("p-prisca")).toBe("verifiee")
    expect(await store.deleteMyAccount()).toEqual({ ok: true, value: null })
    const state = store.getState()
    expect(state.persons["p-mireille"]).toBeUndefined()
    expect(state.memberships["p-mireille"]).toBeUndefined()
    expect(state.consents.some((record) => record.personId === "p-mireille")).toBe(false)
    expect(state.sponsorships.some((item) => item.sponsorId === "p-mireille")).toBe(false)
    expect(state.posts.some((post) => post.author.kind === "person" && post.author.id === "p-mireille")).toBe(false)
    expect(state.session.personId).toBeNull()
    // Prisca garde son IDN de niveau 2 mais perd son parrainage : déclarée.
    expect(store.statusOf("p-prisca")).toBe("declaree")
  })

  it("l'export rend les données de la personne, marquées comme démonstration", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    const exported = await store.exportMyData()
    if (!exported.ok) throw new Error(exported.code)
    expect(JSON.parse(exported.value)).toMatchObject({ demonstration: true, person: { id: "p-steeve" } })
  })
})

describe("compteurs de hub et persistance", () => {
  it("les membres visibles sous le seuil de 20 ne sont jamais chiffrés", () => {
    const { store } = demo()
    expect(hubCounters(store.getState(), "FR", T0).members).toEqual({ kind: "below_threshold", threshold: 20 })
  })

  it("persiste dans le stockage local, recharge, et se remet à zéro", async () => {
    const { store, storage } = demo()
    await store.switchTo("p-steeve")
    expect(storage.items.has(DEMO_STORAGE_KEY)).toBe(true)
    const reloaded = new DemoStore(storage, () => T0, 0)
    expect(reloaded.getState().session.personId).toBe("p-steeve")
    await reloaded.reset()
    expect(reloaded.getState().session.personId).toBeNull()
  })

  it("un stockage illisible repart du jeu de démonstration", () => {
    const storage = memoryStorage()
    storage.setItem(DEMO_STORAGE_KEY, "{pas du json")
    const store = new DemoStore(storage, () => T0 + DAY_MS, 0)
    expect(Object.keys(store.getState().persons)).toContain("p-mireille")
  })
})

describe("relations (EXF-DG-11, EXF-DG-12)", () => {
  it("demander, recevoir, accepter : le lien se voit des deux côtés ; l'abonnement est indépendant", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    expect(await store.connect("p-mireille")).toEqual({ ok: true, value: null })
    expect(relationView(store.getState(), "p-steeve", "p-mireille")).toMatchObject({ connection: "requested_by_me", following: true })
    const pending = relationView(store.getState(), "p-mireille", "p-steeve")
    expect(pending.connection).toBe("requested_by_them")
    // Seul le destinataire répond.
    expect(await store.respondToConnection(pending.connectionId ?? "", true)).toEqual({ ok: false, code: "not_found" })
    await store.switchTo("p-mireille")
    expect(await store.respondToConnection(pending.connectionId ?? "", true)).toEqual({ ok: true, value: null })
    expect(relationView(store.getState(), "p-mireille", "p-steeve").connection).toBe("connected")
    expect(relationView(store.getState(), "p-steeve", "p-mireille").connection).toBe("connected")
    // Redemander à quelqu'un de déjà lié ne double rien.
    expect(await store.connect("p-steeve")).toEqual({ ok: true, value: null })
    expect(store.getState().connectionRequests).toEqual([])
    await store.follow("@Steeve.Ngounie")
    expect(relationView(store.getState(), "p-mireille", "p-steeve").following).toBe(true)
    await store.unfollow("p-steeve")
    expect(relationView(store.getState(), "p-mireille", "p-steeve").following).toBe(false)
  })

  it("refuser une demande la fait disparaître, sans lien", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    await store.connect("p-mireille")
    await store.switchTo("p-mireille")
    const pending = relationView(store.getState(), "p-mireille", "p-steeve")
    await store.respondToConnection(pending.connectionId ?? "", false)
    expect(relationView(store.getState(), "p-mireille", "p-steeve")).toMatchObject({ connection: "none", connectionId: null })
  })

  it("bloquer défait le lien et les abonnements de la paire ; le bloqué ne voit rien et ses gestes sont muets", async () => {
    const { store } = demo()
    await store.switchTo("p-mireille")
    expect(await store.block("p-steeve")).toEqual({ ok: true, value: null })
    expect(relationView(store.getState(), "p-mireille", "p-steeve")).toMatchObject({ connection: "blocked_by_me", following: false })
    // Le bloqué : « rien » — ni lien, ni abonnement (il suivait Mireille dans le jeu).
    expect(relationView(store.getState(), "p-steeve", "p-mireille")).toEqual({ connection: "none", connectionId: null, following: false })
    await store.switchTo("p-steeve")
    expect(await store.connect("p-mireille")).toEqual({ ok: true, value: null })
    expect(store.getState().connectionRequests).toEqual([])
    expect(await store.follow("mireille.ivindo")).toEqual({ ok: false, code: "not_found" })
    await store.switchTo("p-mireille")
    await store.unblock("p-steeve")
    expect(relationView(store.getState(), "p-mireille", "p-steeve").connection).toBe("none")
  })

  it("un compte en attente n'échange pas encore ; une cible inconnue ou soi-même : introuvable", async () => {
    const { store } = demo()
    await store.requestCode({ kind: "email", value: "nouveau@exemple.test" })
    await store.verifyCode(store.getState().pendingCode?.code ?? "")
    await store.join(joinInput({ handle: "nouveau.venu", displayName: "Nouveau Venu" }))
    expect(await store.connect("p-mireille")).toEqual({ ok: false, code: "status_insufficient" })
    await store.switchTo("p-mireille")
    expect(await store.connect("p-inconnu")).toEqual({ ok: false, code: "not_found" })
    expect(await store.connect("p-mireille")).toEqual({ ok: false, code: "not_found" })
    expect(await store.block("p-mireille")).toEqual({ ok: false, code: "not_found" })
  })

  it("l'effacement purge les demandes, blocages et abonnements de la personne", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    await store.connect("p-mireille")
    await store.block("p-prisca")
    await store.deleteMyAccount()
    const state = store.getState()
    expect(state.connectionRequests).toEqual([])
    expect(state.blocks).toEqual([])
    expect(state.follows.some(([a, b]) => a === "p-steeve" || b === "p-steeve")).toBe(false)
  })
})

describe("la cloche", () => {
  it("une demande de relation s'annonce au destinataire, s'accepte d'ici, puis dit ce qu'elle est devenue", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    await store.connect("p-mireille")
    // Rien pour l'auteur du geste.
    expect(notificationsView(store.getState(), "p-steeve")).toEqual([])
    const [request] = notificationsView(store.getState(), "p-mireille")
    expect(request).toMatchObject({
      kind: "connection_request",
      actor: { handle: "steeve.ngounie", displayName: "Steeve Ngounié" },
      read: false,
      inviteOutcome: null,
    })
    expect(request?.pendingConnectionId).toBe(relationView(store.getState(), "p-mireille", "p-steeve").connectionId)
    expect(unreadCountView(store.getState(), "p-mireille")).toEqual({ count: 1, capped: false })

    await store.switchTo("p-mireille")
    expect(await store.respondToConnection(request?.pendingConnectionId ?? "", true)).toEqual({ ok: true, value: null })
    expect(notificationsView(store.getState(), "p-mireille")[0]).toMatchObject({ pendingConnectionId: null, inviteOutcome: "accepted" })
    // Le demandeur apprend l'acceptation, de la main de la destinataire.
    expect(notificationsView(store.getState(), "p-steeve")).toMatchObject([
      { kind: "connection_accepted", actor: { handle: "mireille.ivindo" }, pendingConnectionId: null, inviteOutcome: null },
    ])
  })

  it("une demande refusée se dit refusée, et le refus n'avise pas le demandeur", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    await store.connect("p-mireille")
    await store.switchTo("p-mireille")
    const [request] = notificationsView(store.getState(), "p-mireille")
    await store.respondToConnection(request?.pendingConnectionId ?? "", false)
    expect(notificationsView(store.getState(), "p-mireille")[0]).toMatchObject({ pendingConnectionId: null, inviteOutcome: "declined" })
    expect(notificationsView(store.getState(), "p-steeve")).toEqual([])
  })

  it("un même avis se rafraîchit au lieu de se doubler ; un geste à travers un blocage n'avise personne", async () => {
    const { store, advance } = demo()
    await store.switchTo("p-mireille")
    await store.follow("steeve.ngounie")
    const [first] = notificationsView(store.getState(), "p-steeve")
    await store.switchTo("p-steeve")
    expect(await store.markNotificationRead(first?.id ?? "")).toEqual({ ok: true, value: null })
    await store.switchTo("p-mireille")
    await store.unfollow("p-steeve")
    advance(HOUR_MS)
    await store.follow("steeve.ngounie")
    const again = notificationsView(store.getState(), "p-steeve")
    expect(again).toHaveLength(1)
    expect(again[0]).toMatchObject({ id: first?.id, kind: "new_follower", read: false, createdAt: T0 + HOUR_MS })

    await store.switchTo("p-prisca")
    await store.block("p-steeve")
    await store.switchTo("p-steeve")
    await store.connect("p-prisca")
    expect(notificationsView(store.getState(), "p-prisca")).toEqual([])
  })

  it("marquer lu : un avis à soi, ou tous d'un geste ; l'avis d'autrui est introuvable", async () => {
    const { store } = demo()
    await store.switchTo("p-mireille")
    await store.follow("steeve.ngounie")
    await store.connect("p-steeve")
    const mine = notificationsView(store.getState(), "p-steeve")
    expect(mine).toHaveLength(2)
    // Mireille ne marque pas les avis de Steeve.
    expect(await store.markNotificationRead(mine[0]?.id ?? "")).toEqual({ ok: false, code: "not_found" })
    await store.switchTo("p-steeve")
    expect(await store.markNotificationRead(mine[0]?.id ?? "")).toEqual({ ok: true, value: null })
    expect(unreadCountView(store.getState(), "p-steeve")).toEqual({ count: 1, capped: false })
    expect(await store.markAllNotificationsRead()).toEqual({ ok: true, value: null })
    expect(unreadCountView(store.getState(), "p-steeve")).toEqual({ count: 0, capped: false })
    // Marquer un avis déjà lu ne change rien.
    expect(await store.markNotificationRead(mine[0]?.id ?? "")).toEqual({ ok: true, value: null })
  })

  it("au-delà de 99 non lus, le compte se borne et le dit ; la cloche montre les plus récents d'abord", () => {
    const { store } = demo()
    const notifications = Array.from({ length: 120 }, (_, index) => ({
      id: `n-x${index}`,
      recipientId: "p-mireille",
      kind: "new_follower" as const,
      actorId: "p-steeve",
      createdAt: T0 + index,
      readAt: null,
      connectionRequestId: null,
      inviteDeclined: false,
      postId: null,
    }))
    const state = { ...store.getState(), notifications }
    expect(unreadCountView(state, "p-mireille")).toEqual({ count: 99, capped: true })
    const page = notificationsView(state, "p-mireille")
    expect(page).toHaveLength(NOTIFICATIONS_PAGE)
    expect(page[0]?.createdAt).toBe(T0 + 119)
  })

  it("parrainage, retrait et issue d'une attestation s'annoncent à la personne concernée", async () => {
    const { store, me } = demo()
    await store.switchTo("p-nadia")
    await store.revokeSponsorship("s-2")
    expect(notificationsView(store.getState(), "p-rodrigue")).toMatchObject([{ kind: "sponsorship_withdrawn", actor: { handle: "nadia.mpassa" } }])

    const sent = await store.requestCode({ kind: "email", value: "filleule@exemple.test" })
    if (!sent.ok || !sent.value.demoCode) throw new Error("code non émis")
    await store.verifyCode(sent.value.demoCode)
    const newcomer = me()
    await store.join(joinInput({ handle: "filleule.demo", displayName: "Filleule Démo" }))
    await store.switchTo("p-mireille")
    await store.sponsor("filleule.demo")
    expect(notificationsView(store.getState(), newcomer)).toMatchObject([{ kind: "sponsorship_received", actor: { handle: "mireille.ivindo" } }])

    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    await store.requestAttestation()
    // Un avis du système : personne derrière.
    expect(notificationsView(store.getState(), me())).toMatchObject([{ kind: "attestation_verified", actor: null }])
  })

  it("l'effacement purge les avis reçus et ceux dont la personne est l'autrice", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    await store.connect("p-mireille")
    await store.switchTo("p-mireille")
    await store.follow("steeve.ngounie")
    await store.switchTo("p-steeve")
    await store.deleteMyAccount()
    expect(store.getState().notifications).toEqual([])
  })
})

describe("annuaire opt-in (EXF-DG-19, EXF-DG-46)", () => {
  const handles = (hits: readonly { handle: string }[]) => hits.map((hit) => hit.handle)

  it("la règle du domaine : « réseau » partout, « pays » au même pays, « masqué » nulle part", () => {
    const { store } = demo()
    const state = store.getState()
    // Steeve (FR) : Mireille et Steeve choisissent « pays », Prisca « réseau » ; Rodrigue (CA) reste masqué.
    expect(handles(memberSearchView(state, "p-steeve", "i", undefined, T0))).toEqual([])
    expect(handles(memberSearchView(state, "p-steeve", "mireille", undefined, T0))).toEqual(["mireille.ivindo"])
    expect(handles(memberSearchView(state, "p-steeve", "rodrigue", undefined, T0))).toEqual([])
    // Nadia (BE) ne voit pas les fiches « pays » de France, seulement celle « réseau ».
    expect(handles(memberSearchView(state, "p-nadia", "mireille", undefined, T0))).toEqual([])
    expect(handles(memberSearchView(state, "p-nadia", "prisca", undefined, T0))).toEqual(["prisca.abanga"])
    // Le filtre de pays restreint, il n'ouvre rien.
    expect(handles(memberSearchView(state, "p-nadia", "prisca", "BE", T0))).toEqual([])
    // Par identifiant, accents repliés.
    expect(handles(memberSearchView(state, "p-steeve", "@prisca.abanga", undefined, T0))).toEqual(["prisca.abanga"])
    expect(handles(memberSearchView(state, "p-mireille", "steeve ngounie", undefined, T0))).toEqual(["steeve.ngounie"])
  })

  it("rien que la facette projetée ; un blocage ou un retrait de consentement retire la fiche", async () => {
    const { store } = demo()
    const [prisca] = memberSearchView(store.getState(), "p-nadia", "prisca", undefined, T0)
    expect(prisca?.facet).toEqual(expect.objectContaining({ countryOfResidence: "FR" }))
    expect(Object.keys(prisca ?? {}).sort()).toEqual(["badges", "displayName", "facet", "handle", "headline", "personId"])

    await store.switchTo("p-nadia")
    await store.block("p-prisca")
    expect(memberSearchView(store.getState(), "p-nadia", "prisca", undefined, T0)).toEqual([])
    await store.unblock("p-prisca")
    await store.switchTo("p-prisca")
    await store.setConsent("directory", false)
    expect(memberSearchView(store.getState(), "p-nadia", "prisca", undefined, T0)).toEqual([])
  })
})

describe("commentaires (EXF-DG-12)", () => {
  const bodies = (threads: readonly { body: string }[] | null) => (threads ?? []).map((item) => item.body)
  const countOf = (store: DemoStore, viewerId: string, postId: string) =>
    feedView(store.getState(), viewerId, "recents", T0).find((post) => post.id === postId)?.commentCount

  it("commenter, répondre sur un seul niveau, aviser l'autrice et la personne à qui l'on répond ; le compte suit", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    expect(countOf(store, "p-steeve", "post-7")).toBe(1)
    expect(await store.comment({ postId: "post-7", body: "  Je connais une adresse à Bordeaux.  " })).toEqual({ ok: true, value: null })
    const [root, mine] = commentsView(store.getState(), "post-7", "p-steeve", T0) ?? []
    expect(mine).toMatchObject({ body: "Je connais une adresse à Bordeaux.", isMine: true, replyCount: 0 })
    // Une réponse à une réponse rejoint la racine.
    await store.comment({ postId: "post-7", body: "Merci Mireille !", parentCommentId: root?.id ?? "" })
    const [reply] = repliesView(store.getState(), "post-7", root?.id ?? "", "p-steeve", T0) ?? []
    await store.switchTo("p-mireille")
    await store.comment({ postId: "post-7", body: "Avec plaisir.", parentCommentId: reply?.id ?? "" })
    expect(bodies(repliesView(store.getState(), "post-7", root?.id ?? "", "p-mireille", T0))).toEqual(["Merci Mireille !", "Avec plaisir."])
    expect(commentsView(store.getState(), "post-7", "p-mireille", T0)?.[0]).toMatchObject({ replyCount: 2 })
    expect(countOf(store, "p-mireille", "post-7")).toBe(4)
    // L'autrice de la publication et la personne à qui l'on répond sont avisées ; personne pour soi.
    const prisca = notificationsView(store.getState(), "p-prisca")
    expect(prisca.some((item) => item.kind === "post_comment" && item.actor?.handle === "steeve.ngounie")).toBe(true)
    expect(notificationsView(store.getState(), "p-mireille").some((item) => item.kind === "post_comment" && item.actor?.handle === "steeve.ngounie")).toBe(true)
    expect(notificationsView(store.getState(), "p-steeve").some((item) => item.kind === "post_comment" && item.actor?.handle === "mireille.ivindo")).toBe(true)
  })

  it("refus : vide, trop long, publication inconnue, réponse à un commentaire d'une autre publication, compte en attente", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    expect(await store.comment({ postId: "post-7", body: "   " })).toEqual({ ok: false, code: "comment_empty" })
    expect(await store.comment({ postId: "post-7", body: "x".repeat(1001) })).toEqual({ ok: false, code: "comment_too_long" })
    expect(await store.comment({ postId: "post-inconnue", body: "Bonjour" })).toEqual({ ok: false, code: "not_found" })
    expect(await store.comment({ postId: "post-7", body: "Bonjour", parentCommentId: "c-1" })).toEqual({ ok: false, code: "not_found" })
    await store.requestCode({ kind: "email", value: "attente@exemple.test" })
    await store.verifyCode(store.getState().pendingCode?.code ?? "")
    await store.join(joinInput({ handle: "compte.attente", displayName: "Compte Attente" }))
    expect(await store.comment({ postId: "post-7", body: "Bonjour" })).toEqual({ ok: false, code: "publish_not_allowed" })
  })

  it("retirer : le sien, ou n'importe lequel sous sa publication ; une racine retirée emporte ses réponses ; autrui : introuvable", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    expect(await store.removeComment("c-1")).toEqual({ ok: false, code: "not_found" })
    expect(await store.removeComment("c-3")).toEqual({ ok: true, value: null })
    expect(await store.removeComment("c-3")).toEqual({ ok: true, value: null })
    // Mireille, autrice de post-2, retire la racine de Prisca : sa réponse part avec.
    await store.switchTo("p-mireille")
    expect(countOf(store, "p-mireille", "post-2")).toBe(2)
    expect(await store.removeComment("c-1")).toEqual({ ok: true, value: null })
    expect(commentsView(store.getState(), "post-2", "p-mireille", T0)).toEqual([])
    expect(countOf(store, "p-mireille", "post-2")).toBe(0)
  })

  it("un blocage écarte les commentaires de la paire ; l'effacement purge ses commentaires et ceux de ses publications", async () => {
    const { store } = demo()
    await store.switchTo("p-prisca")
    await store.block("p-mireille")
    expect(commentsView(store.getState(), "post-7", "p-prisca", T0)).toEqual([])
    await store.switchTo("p-mireille")
    await store.deleteMyAccount()
    const left = store.getState().comments
    expect(left.some((item) => item.authorId === "p-mireille" || item.postId === "post-2")).toBe(false)
    expect(left.map((item) => item.id).sort()).toEqual(["c-5", "c-6"])
  })
})

describe("signets, masquage, sourdine, signalement et retrait (EXF-DG-12)", () => {
  const feedIds = (store: DemoStore, viewerId: string) => feedView(store.getState(), viewerId, "recents", T0).map((post) => post.id)

  it("un signet s'ajoute et se retire, pour soi seul", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    expect(await store.toggleBookmark("post-2")).toEqual({ ok: true, value: { bookmarked: true } })
    expect(feedView(store.getState(), "p-steeve", "recents", T0).find((post) => post.id === "post-2")?.bookmarked).toBe(true)
    expect(feedView(store.getState(), "p-prisca", "recents", T0).find((post) => post.id === "post-2")?.bookmarked).toBe(false)
    expect(await store.toggleBookmark("post-2")).toEqual({ ok: true, value: { bookmarked: false } })
    expect(await store.toggleBookmark("post-inconnue")).toEqual({ ok: false, code: "not_found" })
  })

  it("masquer retire la publication de mes fils seulement ; la sourdine retire un auteur de mes fils, pas de son profil", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    await store.hidePost("post-2")
    expect(feedIds(store, "p-steeve")).not.toContain("post-2")
    expect(feedIds(store, "p-prisca")).toContain("post-2")
    await store.muteAuthor("p-nadia")
    expect(feedIds(store, "p-steeve")).not.toContain("post-5")
    expect(profileView(store.getState(), "nadia.mpassa", "p-steeve", T0)?.posts.map((post) => post.id)).toEqual(["post-5"])
    // Se taire soi-même : sans effet.
    expect(await store.muteAuthor("p-steeve")).toEqual({ ok: true, value: null })
    expect(feedIds(store, "p-steeve")).toContain("post-6")
  })

  it("signaler : un motif, une précision bornée ; la publication est masquée pour la personne qui signale ; sa propre publication ne se signale pas", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    expect(await store.reportPost({ postId: "post-5", reason: "misinformation", note: "x".repeat(1001) })).toEqual({ ok: false, code: "report_note_too_long" })
    expect(await store.reportPost({ postId: "post-6", reason: "other" })).toEqual({ ok: false, code: "not_found" })
    expect(await store.reportPost({ postId: "post-5", reason: "misinformation", note: "  Chiffres sans source.  " })).toEqual({ ok: true, value: null })
    expect(store.getState().reports).toMatchObject([{ reporterId: "p-steeve", postId: "post-5", reason: "misinformation", note: "Chiffres sans source." }])
    expect(feedIds(store, "p-steeve")).not.toContain("post-5")
    expect(feedIds(store, "p-nadia")).toContain("post-5")
  })

  it("retirer ma publication l'efface avec ses commentaires ; celle d'autrui : introuvable", async () => {
    const { store } = demo()
    await store.switchTo("p-mireille")
    expect(await store.removePost("post-5")).toEqual({ ok: false, code: "not_found" })
    expect(await store.removePost("post-2")).toEqual({ ok: true, value: null })
    expect(store.getState().posts.some((post) => post.id === "post-2")).toBe(false)
    expect(store.getState().comments.some((item) => item.postId === "post-2")).toBe(false)
  })

  it("un blocage retire les publications de la paire des fils, et le profil devient introuvable", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    await store.block("p-mireille")
    expect(feedIds(store, "p-steeve")).not.toContain("post-2")
    expect(feedIds(store, "p-mireille")).not.toContain("post-6")
    expect(profileView(store.getState(), "mireille.ivindo", "p-steeve", T0)).toBeNull()
  })
})

describe("suggestions de relations (EXF-DG-18)", () => {
  it("l'annuaire opt-in, classé sur ce que je vois : même hub et relations communes ; ni mes relations ni les masqués ; « ne plus me proposer » tient", async () => {
    const { store } = demo()
    // Steeve (France) : Prisca est déjà une relation ; Mireille (fiche « pays ») partage Prisca avec lui.
    const [mireille, ...rest] = suggestionsView(store.getState(), "p-steeve", T0)
    expect(rest).toEqual([])
    expect(mireille).toMatchObject({ handle: "mireille.ivindo", reasons: { sameCountry: true, sameCity: false, sharedAssociations: 0, mutualConnections: 1 } })
    // Nadia (Belgique) : aucune fiche ne lui est rapprochée — rien plutôt qu'un inconnu.
    expect(suggestionsView(store.getState(), "p-nadia", T0)).toEqual([])
    await store.switchTo("p-steeve")
    expect(await store.dismissSuggestion("@mireille.ivindo")).toEqual({ ok: true, value: null })
    expect(await store.dismissSuggestion("mireille.ivindo")).toEqual({ ok: true, value: null })
    expect(suggestionsView(store.getState(), "p-steeve", T0)).toEqual([])
    expect(await store.dismissSuggestion("steeve.ngounie")).toEqual({ ok: false, code: "not_found" })
  })

  it("une demande envoyée retire la suggestion", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    await store.connect("p-mireille")
    expect(suggestionsView(store.getState(), "p-steeve", T0)).toEqual([])
  })
})

describe("publication seule, modification et signets (EXF-DG-12)", () => {
  it("modifier ma publication : le texte change, la carte dit « modifiée » ; celle d'autrui reste introuvable", async () => {
    const { store, advance } = demo()
    await store.switchTo("p-mireille")
    expect(await store.editPost("post-5", "Autre texte")).toEqual({ ok: false, code: "not_found" })
    expect(await store.editPost("post-2", "   ")).toEqual({ ok: false, code: "post_empty" })
    advance(HOUR_MS)
    expect(await store.editPost("post-2", "  Valise pleine, merci à toutes et à tous.  ")).toEqual({ ok: true, value: null })
    expect(postDetailView(store.getState(), "post-2", "p-steeve", T0)).toMatchObject({ body: "Valise pleine, merci à toutes et à tous.", edited: true })
  })

  it("la publication seule suit les mêmes règles que le fil : masquée, bloquée ou inconnue, c'est « introuvable »", async () => {
    const { store } = demo()
    expect(postDetailView(store.getState(), "post-2", "p-steeve", T0)).toMatchObject({ id: "post-2", edited: false })
    expect(postDetailView(store.getState(), "post-inconnue", "p-steeve", T0)).toBeNull()
    await store.switchTo("p-steeve")
    await store.hidePost("post-2")
    expect(postDetailView(store.getState(), "post-2", "p-steeve", T0)).toBeNull()
    await store.block("p-nadia")
    expect(postDetailView(store.getState(), "post-5", "p-steeve", T0)).toBeNull()
  })

  it("mes signets, du plus récent ; une publication retirée disparaît de la liste", async () => {
    const { store, advance } = demo()
    await store.switchTo("p-steeve")
    await store.toggleBookmark("post-2")
    advance(HOUR_MS)
    await store.toggleBookmark("post-1")
    expect(bookmarksView(store.getState(), "p-steeve", T0).map((item) => [item.postId, item.author.kind])).toEqual([
      ["post-1", "page"],
      ["post-2", "person"],
    ])
    await store.switchTo("p-mireille")
    await store.removePost("post-2")
    expect(bookmarksView(store.getState(), "p-steeve", T0).map((item) => item.postId)).toEqual(["post-1"])
  })

  it("l'avis d'un commentaire mène à sa publication", async () => {
    const { store } = demo()
    await store.switchTo("p-steeve")
    await store.comment({ postId: "post-7", body: "Bonne question." })
    expect(notificationsView(store.getState(), "p-prisca").find((item) => item.kind === "post_comment")?.postId).toBe("post-7")
  })
})

describe("médias d'une publication (EXF-DG-10)", () => {
  // Une photo réduite telle que la démonstration la garde : 4 000 caractères de charge base64, soit 3 000 octets.
  const PHOTO = `data:image/jpeg;base64,${"A".repeat(4000)}`

  it("une photo sans légende se publie, avec son texte alternatif ; un dépôt ne s'embarque qu'une fois", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    const upload = store.stageMedia({ kind: "image", url: PHOTO, width: 1280, height: 960 })
    expect(upload).toMatchObject({ kind: "image", mimeType: "image/jpeg", sizeBytes: 3000, width: 1280, height: 960 })
    expect(
      await store.publish({ body: "  ", reach: "local", audience: "public", alsoOnRoot: false, media: [{ upload, altText: "  Le marché de Lyon  " }] }),
    ).toEqual({ ok: true, value: { moderation: "published" } })
    expect(store.getState().posts[0]?.media).toEqual([{ kind: "image", url: PHOTO, width: 1280, height: 960, altText: "Le marché de Lyon" }])
    expect(feedView(store.getState(), me(), "recents", T0).find((post) => post.media.length > 0)?.media).toEqual([
      { kind: "image", url: PHOTO, withheld: null, altText: "Le marché de Lyon", width: 1280, height: 960 },
    ])
    expect(await store.publish({ body: "Encore", reach: "local", audience: "public", alsoOnRoot: false, media: [{ upload, altText: "" }] })).toEqual({
      ok: false,
      code: "media_upload_failed",
    })
  })

  it("sans média, un message vide reste refusé ; les règles du moteur jugent les médias ensemble", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    const post = { reach: "local" as const, audience: "public" as const, alsoOnRoot: false }
    expect(await store.publish({ ...post, body: " " })).toEqual({ ok: false, code: "post_empty" })
    const photo = () => ({ upload: store.stageMedia({ kind: "image", url: PHOTO, width: 10, height: 10 }), altText: "" })
    expect(await store.publish({ ...post, body: "Cinq photos", media: [photo(), photo(), photo(), photo(), photo()] })).toEqual({
      ok: false,
      code: "media_too_many",
    })
    expect(await store.publish({ ...post, body: "", media: [{ ...photo(), altText: "x".repeat(301) }] })).toEqual({ ok: false, code: "media_alt_too_long" })
  })
})

describe("partage cité (EXF-DG-10)", () => {
  const share = (sharedPostId: string, body = "") => ({ body, reach: "local" as const, audience: "public" as const, alsoOnRoot: false, sharedPostId })

  it("partager une publication publique : un mot facultatif, l'original cité dans la carte, l'autrice avisée", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    expect(await store.publish(share("post-7"))).toEqual({ ok: true, value: { moderation: "published" } })
    const mine = feedView(store.getState(), me(), "recents", T0).find((post) => post.share !== null)
    expect(mine?.body).toBe("")
    expect(mine?.share).toMatchObject({ available: true, postId: "post-7", author: { kind: "person", handle: "prisca.abanga", displayName: "Prisca Abanga" } })
    expect(postDetailView(store.getState(), "post-7", "p-prisca", T0)?.shareCount).toBe(1)
    expect(notificationsView(store.getState(), "p-prisca")[0]).toMatchObject({ kind: "post_share", postId: "post-7" })
  })

  it("partager un partage cite l'original ; l'original retiré, la carte le dit indisponible", async () => {
    const { store, me } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    await store.publish(share("post-7", "À lire"))
    const first = store.getState().posts[0]
    if (!first) throw new Error("partage absent")
    await store.publish(share(first.id))
    expect(store.getState().posts[0]?.sharedPostId).toBe("post-7")
    const awa = me()
    await store.switchTo("p-prisca")
    expect(await store.removePost("post-7")).toEqual({ ok: true, value: null })
    // Retiré : chaque partage le dit indisponible, et ne dit que cela.
    const shares = feedView(store.getState(), awa, "recents", T0).filter((post) => post.share !== null)
    expect(shares.map((post) => post.share)).toEqual([{ available: false }, { available: false }])
  })

  it("refus : une publication réservée aux relations ne se partage pas ; un partage ne joint pas de média ; un original introuvable", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    await store.publish({ body: "Entre nous", reach: "local", audience: "connections", alsoOnRoot: false })
    const private_ = store.getState().posts[0]
    if (!private_) throw new Error("publication absente")
    expect(await store.publish(share(private_.id))).toEqual({ ok: false, code: "share_not_allowed" })
    const upload = store.stageMedia({ kind: "image", url: `data:image/jpeg;base64,${"A".repeat(40)}`, width: 10, height: 10 })
    expect(await store.publish({ ...share("post-7"), media: [{ upload, altText: "" }] })).toEqual({ ok: false, code: "share_with_media" })
    expect(await store.publish(share("post-inconnue"))).toEqual({ ok: false, code: "not_found" })
  })
})

describe("idempotence de la publication (EXF-DG-10)", () => {
  it("la même clé rejouée rend la réponse d'alors, sans seconde publication ; une clé neuve publie", async () => {
    const { store } = demo()
    await store.signInWithIdn(AWA)
    await store.join(joinInput())
    const post = { body: "Une seule fois", reach: "local" as const, audience: "public" as const, alsoOnRoot: false, idempotencyKey: "cle-1" }
    const count = () => store.getState().posts.filter((item) => item.body === "Une seule fois").length
    expect(await store.publish(post)).toEqual({ ok: true, value: { moderation: "published" } })
    expect(await store.publish(post)).toEqual({ ok: true, value: { moderation: "published" } })
    expect(count()).toBe(1)
    await store.publish({ ...post, idempotencyKey: "cle-2" })
    expect(count()).toBe(2)
  })
})
