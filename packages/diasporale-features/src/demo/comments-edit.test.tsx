// @vitest-environment jsdom
import { LIGHT_ACCOUNT_GROUNDS } from "@diasporale/domain"
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { COMMENT_MAX_LENGTH } from "../data/types"
import { commentsView, repliesView } from "./selectors"
import { createDemoDataSource } from "./source"
import { createDemoSeed, DEMO_STATE_VERSION, type DemoComment, type DemoPost, type DemoState } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

const NOW = Date.UTC(2026, 9, 17, 12)
const PERSON = "p-prisca"
const AUTHOR = "p-mireille"
const POST = "post-comment-edit"
const ROOT = "comment-edit-root"
const REPLY = "comment-edit-reply"
const OTHER = "comment-edit-other"

function setup(change: (state: DemoState) => DemoState = (state) => state, latency = 0) {
  const seed = createDemoSeed(NOW)
  const post: DemoPost = {
    id: POST, author: { kind: "person", id: AUTHOR }, body: "Publication fictive conservée", audience: "public", visibility: "network",
    scope: { reach: "diaspora" }, moderation: "published", createdAt: NOW - 100, editedAt: null, reactions: {}, baseReactions: 0,
  }
  const comment: DemoComment = { id: ROOT, postId: POST, authorId: PERSON, body: "Texte initial", createdAt: NOW - 50, parentId: null, removedAt: null }
  const state = change({
    ...seed, session: { personId: PERSON }, posts: [...seed.posts, post],
    comments: [...seed.comments, comment, { ...comment, id: REPLY, body: "Réponse initiale", parentId: ROOT, createdAt: NOW - 40 }, { ...comment, id: OTHER, authorId: AUTHOR, body: "Autre auteur", parentId: ROOT }],
  })
  const stored = new Map([[DEMO_STORAGE_KEY, JSON.stringify(state)]])
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value) },
    removeItem: vi.fn((key: string) => { stored.delete(key) }),
  }
  const store = new DemoStore(storage, () => NOW, latency)
  const source = createDemoDataSource(store)
  if (!source.actions.editComment) throw new Error("Capacité d'édition absente du fournisseur démo")
  return { store, source, edit: source.actions.editComment, storage, stored }
}

afterEach(() => { cleanup(); vi.useRealTimers() })

describe("commentaires de démonstration — édition auteur et lecture réactive", () => {
  it.each([ROOT, REPLY])("corrige %s sans créer de commentaire, changer les compteurs ou la parenté", async (commentId) => {
    const { store, source, edit } = setup()
    const before = store.getState()
    const original = before.comments.find((item) => item.id === commentId)!
    const { result } = renderHook(() => ({ comments: source.useComments(POST), replies: source.useReplies({ postId: POST, commentId: ROOT }) }))
    expect(before.comments.find((item) => item.id === commentId)?.editedAt).toBeUndefined()
    await act(async () => { expect(await edit(commentId, "  Correction #Gabon @mireille.ivindo  ")).toEqual({ ok: true, value: null }) })
    const after = store.getState()
    expect(after).toEqual({ ...before, comments: before.comments.map((item) => item.id === commentId ? { ...item, body: "Correction #Gabon @mireille.ivindo", editedAt: NOW } : item) })
    const view = commentId === ROOT
      ? result.current.comments.status === "ready" ? result.current.comments.data?.find((item) => item.id === ROOT) : null
      : result.current.replies.status === "ready" ? result.current.replies.data?.find((item) => item.id === REPLY) : null
    expect(view).toMatchObject({ id: commentId, body: "Correction #Gabon @mireille.ivindo", createdAt: original.createdAt, edited: true, isMine: true })
    expect(commentsView(after, POST, PERSON, NOW)?.[0]?.replyCount).toBe(2)
    expect(after.notifications).toBe(before.notifications)
  })

  it("relit l'instantané v7 puis persiste la correction sans remise à zéro ni perte voisine", async () => {
    const { store, edit, storage } = setup()
    const before = store.getState()
    expect(commentsView(before, POST, PERSON, NOW)?.[0]?.edited).toBe(false)
    expect(repliesView(before, POST, ROOT, PERSON, NOW)?.[0]?.edited).toBe(false)
    await edit(REPLY, "Réponse corrigée")
    const reloaded = new DemoStore(storage, () => NOW, 0)
    expect(reloaded.getState()).toEqual(store.getState())
    expect(reloaded.getState().version).toBe(DEMO_STATE_VERSION)
    expect(reloaded.getState().sequence).toBe(before.sequence)
    expect(repliesView(reloaded.getState(), POST, ROOT, PERSON, NOW)?.find((item) => item.id === REPLY)).toMatchObject({ body: "Réponse corrigée", edited: true, createdAt: NOW - 40 })
    expect(storage.removeItem).not.toHaveBeenCalled()
  })

  it("le propriétaire du post ne peut pas éditer le commentaire d'un autre auteur", async () => {
    const { store, edit } = setup()
    await store.switchTo(AUTHOR)
    const before = store.getState()
    expect(await edit(ROOT, "Correction interdite")).toEqual({ ok: false, code: "not_found" })
    expect(store.getState()).toBe(before)
  })

  it.each([
    { body: " \n\t ", code: "comment_empty" },
    { body: "x".repeat(COMMENT_MAX_LENGTH + 1), code: "comment_too_long" },
  ])("refuse $code sans toucher au texte ni au stockage", async ({ body, code }) => {
    const { store, edit, stored } = setup()
    const before = store.getState()
    const snapshot = stored.get(DEMO_STORAGE_KEY)
    expect(await edit(ROOT, body)).toEqual({ ok: false, code })
    expect(store.getState()).toBe(before)
    expect(stored.get(DEMO_STORAGE_KEY)).toBe(snapshot)
  })

  it("accepte la limite commune après trim, sans tronquer le commentaire", async () => {
    const { store, edit } = setup()
    const body = "é".repeat(COMMENT_MAX_LENGTH)
    expect(await edit(ROOT, `  ${body}  `)).toEqual({ ok: true, value: null })
    expect(store.getState().comments.find((item) => item.id === ROOT)?.body).toBe(body)
  })

  it.each(["unknown", "removed", "foreign"] as const)("rend le même refus pour le commentaire %s", async (kind) => {
    const { store, edit } = setup((state) => kind === "removed" ? { ...state, comments: state.comments.map((item) => item.id === ROOT ? { ...item, removedAt: NOW - 1 } : item) } : state)
    const before = store.getState()
    expect(await edit(kind === "unknown" ? "absent" : kind === "foreign" ? OTHER : ROOT, "Correction")).toEqual({ ok: false, code: "not_found" })
    expect(store.getState()).toBe(before)
  })

  it("ne réanime pas une réponse dont la racine a été retirée", async () => {
    const { store, edit } = setup()
    await store.removeComment(ROOT)
    const before = store.getState()
    expect(await edit(REPLY, "Réponse retirée avec sa racine")).toEqual({ ok: false, code: "not_found" })
    expect(store.getState()).toBe(before)
  })

  it.each(["absent", "private", "moderated", "blocked-by-me", "blocked-by-author", "author-left"] as const)("ne modifie rien quand la publication est devenue %s", async (kind) => {
    const { store, edit } = setup((state) => ({
      ...state,
      posts: kind === "absent" ? state.posts.filter((item) => item.id !== POST) : state.posts.map((item) => item.id !== POST ? item
        : kind === "private" ? { ...item, audience: "connections" }
          : kind === "moderated" ? { ...item, moderation: "rejected" } : item),
      connections: kind === "private" ? [] : state.connections,
      blocks: kind === "blocked-by-me" || kind === "blocked-by-author"
        ? [...state.blocks, { id: "recette-block", byId: kind === "blocked-by-me" ? PERSON : AUTHOR, targetId: kind === "blocked-by-me" ? AUTHOR : PERSON, createdAt: NOW - 1 }]
        : state.blocks,
      memberships: kind === "author-left" ? { ...state.memberships, [AUTHOR]: { ...state.memberships[AUTHOR]!, grounds: { ...state.memberships[AUTHOR]!.grounds, leftAt: NOW - 1 } } } : state.memberships,
    }))
    const before = store.getState()
    expect(await edit(ROOT, "Correction")).toEqual({ ok: false, code: "not_found" })
    expect(store.getState()).toBe(before)
  })

  it.each([
    { kind: "anonymous", code: "not_signed_in" },
    { kind: "not-member", code: "not_found" },
    { kind: "left", code: "not_found" },
    { kind: "pending", code: "status_insufficient" },
    { kind: "suspended", code: "suspended" },
  ])("applique le refus d'accès $kind avant toute modification", async ({ kind, code }) => {
    const { store, edit } = setup((state) => {
      const member = state.memberships[PERSON]!
      const memberships = { ...state.memberships }
      if (kind === "not-member") delete memberships[PERSON]
      else memberships[PERSON] = { ...member, grounds: kind === "pending" ? LIGHT_ACCOUNT_GROUNDS
        : kind === "left" ? { ...member.grounds, leftAt: NOW - 1 }
          : kind === "suspended" ? { ...member.grounds, suspension: { until: null, readAccess: "read_only" } } : member.grounds }
      return { ...state, memberships, session: { personId: kind === "anonymous" ? null : PERSON } }
    })
    const before = store.getState()
    expect(await edit(ROOT, "Correction")).toEqual({ ok: false, code })
    expect(store.getState()).toBe(before)
  })

  it("refuse une commande de l'ancien lecteur après un changement de session pendant la latence", async () => {
    vi.useFakeTimers()
    const { store, edit } = setup(undefined, 20)
    const pending = edit(ROOT, "Correction ancienne session")
    await store.switchTo(AUTHOR)
    const before = store.getState()
    await vi.advanceTimersByTimeAsync(20)
    expect(await pending).toEqual({ ok: false, code: "not_found" })
    expect(store.getState()).toBe(before)
  })
})
