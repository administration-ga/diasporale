// @vitest-environment node
import { DAY_MS, HOUR_MS, type OnboardingConsentChoices } from "@diasporale/domain"
import { describe, expect, it } from "vitest"

import type { JoinInput } from "../data/port"
import { NOTIFICATIONS_PAGE, feedView, hubCounters, membershipView, notificationsView, relationView, sessionView, unreadCountView } from "./selectors"
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
