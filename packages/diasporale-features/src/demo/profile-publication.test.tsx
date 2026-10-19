// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { commentsView, memberSearchView, membershipView, notificationsView, ownProfileView, postDetailView, profileView, relationView, suggestionsView } from "./selectors"
import { createDemoDataSource } from "./source"
import { createDemoSeed, DEMO_STATE_VERSION, type DemoState } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

const NOW = Date.UTC(2026, 9, 17, 12)
const PERSON = "p-prisca"
const OTHER = "p-nadia"
function setup(extra: Partial<DemoState> = {}, latency = 0) {
  const seed = createDemoSeed(NOW)
  const state: DemoState = { ...seed, session: { personId: PERSON }, ...extra }
  const stored = new Map([[DEMO_STORAGE_KEY, JSON.stringify(state)]])
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value) },
    removeItem: vi.fn((key: string) => { stored.delete(key) }),
  }
  const store = new DemoStore(storage, () => NOW, latency)
  const source = createDemoDataSource(store)
  return { store, source, publication: source.profilePublication!, storage, stored }
}
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("Profil commun de démonstration — état propriétaire et persistance", () => {
  it("relit les états existants sans flags, sans changement de version ni remise à zéro", () => {
    const { store, publication, storage } = setup()
    const { result } = renderHook(() => publication.useMyProfile())
    expect(result.current).toEqual({ status: "ready", data: {
      personId: PERSON, handle: "prisca.abanga", displayName: "Prisca ABANGA", headline: "Étudiante en droit à Bordeaux", published: true, private: false,
    } })
    expect(store.getState().version).toBe(DEMO_STATE_VERSION)
    expect(store.getState().sequence).toBe(100)
    expect(store.getState().posts.length).toBeGreaterThan(0)
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it("garde une fiche propriétaire retirée réactive puis republie les mêmes champs et le même choix privé", async () => {
    const { store, publication } = setup()
    const before = store.getState()
    const identity = before.persons[PERSON]!.profile
    const { result } = renderHook(() => publication.useMyProfile())
    await act(async () => {
      await publication.setPrivacy(PERSON, true)
      await publication.withdraw(PERSON)
    })
    expect(result.current).toEqual({ status: "ready", data: { personId: PERSON, ...identity, published: false, private: true } })
    expect(profileView(store.getState(), identity!.handle, PERSON, NOW)).toBeNull()
    for (const key of ["posts", "comments", "memberships", "consents", "connections", "follows", "sponsorships", "marks"] as const) {
      expect(store.getState()[key]).toEqual(before[key])
    }
    expect(store.getState().persons[PERSON]!.profile).toEqual(identity)
    await act(async () => { await publication.republish(PERSON) })
    expect(result.current).toEqual({ status: "ready", data: { personId: PERSON, ...identity, published: true, private: true } })
    expect(store.getState().persons[PERSON]!.profile).toEqual(identity)
    expect(store.getState().memberships[PERSON]!.directoryVisibility).toBe(before.memberships[PERSON]!.directoryVisibility)
    expect(store.getState().consents).toEqual(before.consents)
    const version = store.getVersion()
    await act(async () => { await publication.republish(PERSON) })
    expect(store.getVersion()).toBe(version)
  })

  it("conserve les flags de retrait et de privé après rechargement du stockage", async () => {
    const { store, publication, storage } = setup()
    await publication.setPrivacy(PERSON, true)
    await publication.withdraw(PERSON)
    const reloaded = new DemoStore(storage, () => NOW, 0)
    expect(ownProfileView(reloaded.getState(), PERSON)).toMatchObject({ published: false, private: true, handle: "prisca.abanga" })
    expect(reloaded.getState().posts).toEqual(store.getState().posts)
    expect(reloaded.getState().version).toBe(DEMO_STATE_VERSION)
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it.each(["privacy", "withdraw", "republish"] as const)("refuse une ancienne personne pour la commande %s", async (kind) => {
    const { store, publication } = setup()
    await store.switchTo(OTHER)
    const before = store.getState()
    const action = kind === "privacy" ? publication.setPrivacy(PERSON, true) : publication[kind](PERSON)
    expect(await action).toEqual({ ok: false, code: "not_found" })
    expect(store.getState()).toBe(before)
  })

  it("change la lecture avec la session et ferme la lecture anonyme", async () => {
    const { store, publication } = setup()
    const { result } = renderHook(() => publication.useMyProfile())
    await act(async () => { await store.switchTo(OTHER) })
    expect(result.current).toMatchObject({ status: "ready", data: { personId: OTHER } })
    await act(async () => { await store.signOutEverywhere() })
    expect(result.current).toEqual({ status: "error", code: "not_signed_in" })
    expect(await publication.withdraw(OTHER)).toEqual({ ok: false, code: "not_signed_in" })
  })
})

describe("Profil de démonstration — publication et découvrabilité distinctes", () => {
  it("le privé garde la fiche et les liens connus, mais retire découverte et nouveaux liens entrants", async () => {
    const { store, publication } = setup()
    expect(memberSearchView(store.getState(), OTHER, "Prisca", undefined, NOW).some((hit) => hit.personId === PERSON)).toBe(true)
    const connections = store.getState().connections
    const follows = store.getState().follows
    await publication.setPrivacy(PERSON, true)
    expect(profileView(store.getState(), "prisca.abanga", OTHER, NOW)?.displayName).toBe("Prisca ABANGA")
    expect(memberSearchView(store.getState(), OTHER, "Prisca", undefined, NOW)).toEqual([])
    expect(suggestionsView(store.getState(), OTHER, NOW).some((hit) => hit.personId === PERSON)).toBe(false)
    expect(relationView(store.getState(), "p-mireille", PERSON).connection).toBe("connected")
    await store.switchTo(OTHER)
    expect(await store.connect(PERSON)).toEqual({ ok: false, code: "not_found" })
    expect(await store.follow("prisca.abanga")).toEqual({ ok: false, code: "not_found" })
    expect(store.getState().connections).toEqual(connections)
    expect(store.getState().follows).toEqual(follows)
    await store.switchTo(PERSON)
    await publication.setPrivacy(PERSON, false)
    expect(memberSearchView(store.getState(), OTHER, "Prisca", undefined, NOW).some((hit) => hit.personId === PERSON)).toBe(true)
  })

  it("le retrait neutralise les auteurs et les acteurs sans retirer leurs contenus ni les liens", async () => {
    const seed = createDemoSeed(NOW)
    const { store, publication } = setup({ notifications: [{
      id: "notice", recipientId: "p-mireille", kind: "connection_accepted", actorId: PERSON, createdAt: NOW,
      readAt: null, connectionRequestId: null, inviteDeclined: false, postId: null,
    }] })
    const personalPost = seed.posts.find((post) => post.author.kind === "person" && post.author.id === PERSON)!
    await publication.withdraw(PERSON)
    expect(profileView(store.getState(), "prisca.abanga", "p-mireille", NOW)).toBeNull()
    const post = postDetailView(store.getState(), personalPost.id, "p-mireille", NOW)
    expect(post?.body).toBe(personalPost.body)
    expect(post?.author).toMatchObject({ handle: "", displayName: "", badges: [] })
    const comment = commentsView(store.getState(), "post-2", "p-mireille", NOW)?.find((item) => item.id === "c-1")
    expect(comment?.author).toEqual({ personId: PERSON, handle: null, displayName: null })
    expect(notificationsView(store.getState(), "p-mireille")[0]?.actor).toBeNull()
    expect(store.getState().connections).toEqual(seed.connections)
    expect(store.getState().posts).toEqual(seed.posts)
  })

  it("autorise les gestes personnels de protection même sans droit de publier dans le réseau", async () => {
    const seed = createDemoSeed(NOW)
    const membership = seed.memberships[PERSON]!
    const { store, publication } = setup({ memberships: { ...seed.memberships, [PERSON]: {
      ...membership, grounds: { idn: null, sponsored: false, consularAttestation: false, suspension: null, leftAt: null },
    } } })
    expect(membershipView(store.getState(), PERSON, NOW)?.canPublish).toBe(false)
    expect(await publication.setPrivacy(PERSON, true)).toEqual({ ok: true, value: null })
    expect(await publication.withdraw(PERSON)).toEqual({ ok: true, value: null })
    expect(await publication.republish(PERSON)).toEqual({ ok: true, value: null })
    expect(ownProfileView(store.getState(), PERSON)).toMatchObject({ published: true, private: true })
  })
})

describe("Départ DIASPORALE de démonstration — aucune dépublication ou révocation implicite", () => {
  it("quitte l'adhésion, termine le parrainage reçu et conserve profil, contenus, consentements et ANTSIA", async () => {
    const { store, source } = setup()
    const before = store.getState()
    expect(await source.actions.leaveDiasporale()).toEqual({ ok: true, value: null })
    expect(store.statusOf(PERSON)).toBe("partie")
    expect(ownProfileView(store.getState(), PERSON)).toMatchObject({ published: true, private: false })
    expect(store.getState().persons).toEqual(before.persons)
    expect(store.getState().posts).toEqual(before.posts)
    expect(store.getState().consents).toEqual(before.consents)
    expect(store.getState().sponsorships.find((item) => item.sponsoredId === PERSON)?.revokedAt).toBe(NOW)
    expect(membershipView(store.getState(), PERSON, NOW)?.root.status).not.toBe("partie")
    expect(profileView(store.getState(), "prisca.abanga", OTHER, NOW)).toBeNull()
  })

  it("refuse un changement de lecteur pendant la préparation du départ", async () => {
    vi.useFakeTimers()
    const { store } = setup({}, 100)
    const leaving = store.leaveDiasporale()
    await store.switchTo(OTHER)
    await vi.advanceTimersByTimeAsync(100)
    expect(await leaving).toEqual({ ok: false, code: "not_found" })
    expect(store.statusOf(PERSON)).not.toBe("partie")
    expect(store.statusOf(OTHER)).not.toBe("partie")
  })
})

describe("Identité de démonstration — sauvegarder ne republie pas", () => {
  it.each([false, true])("conserve publication/retrait (retiré=%s), privé et tous les autres choix", async (withdrawn) => {
    const { store, publication, storage } = setup()
    await publication.setPrivacy(PERSON, true)
    if (withdrawn) await publication.withdraw(PERSON)
    const before = store.getState()
    expect(await publication.updateIdentity!(PERSON, { displayName: "  Nom libre  ", headline: "  Nouvelle accroche  " })).toEqual({ ok: true, value: null })
    expect(ownProfileView(store.getState(), PERSON)).toMatchObject({ displayName: "Nom libre", headline: "Nouvelle accroche", published: !withdrawn, private: true, handle: "prisca.abanga" })
    expect(store.getState().persons[PERSON]!.withdrawnAt).toBe(before.persons[PERSON]!.withdrawnAt)
    for (const key of ["posts", "comments", "memberships", "consents", "connections", "follows", "sponsorships", "marks"] as const) expect(store.getState()[key]).toEqual(before[key])
    const reloaded = new DemoStore(storage, () => NOW, 0)
    expect(ownProfileView(reloaded.getState(), PERSON)).toMatchObject({ displayName: "Nom libre", published: !withdrawn, private: true })
    expect(storage.removeItem).not.toHaveBeenCalled()
  })
  it("efface l'accroche explicitement sans republier le profil retiré", async () => {
    const { store, publication } = setup()
    await publication.withdraw(PERSON)
    await publication.updateIdentity!(PERSON, { displayName: "Nom libre", headline: "  " })
    expect(ownProfileView(store.getState(), PERSON)).toMatchObject({ headline: null, published: false })
  })
  it.each([{ displayName: " ", headline: "", code: "display_name_invalid" }, { displayName: "x".repeat(121), headline: "", code: "display_name_invalid" }, { displayName: "Valide", headline: "x".repeat(161), code: "headline_too_long" }])("refuse les textes invalides ($code)", async ({ code, ...input }) => {
    const { store, publication } = setup()
    const before = store.getState()
    expect(await publication.updateIdentity!(PERSON, input)).toEqual({ ok: false, code })
    expect(store.getState()).toBe(before)
  })
  it("refuse l'ancienne personne après un changement pendant l'attente", async () => {
    vi.useFakeTimers()
    const { store, publication } = setup({}, 100)
    const pending = publication.updateIdentity!(PERSON, { displayName: "Ancien brouillon", headline: "" })
    const switching = store.switchTo(OTHER)
    await vi.runAllTimersAsync()
    await switching
    // Le changement de session doit être appliqué avant la résolution de la commande.
    // switchTo est immédiat ; aucun texte d'A ne peut atteindre B.
    expect(await pending).toEqual({ ok: false, code: "not_found" })
    expect(store.getState().persons[OTHER]!.profile?.displayName).not.toBe("Ancien brouillon")
  })
})
