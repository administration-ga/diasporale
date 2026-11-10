// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { COMMENT_REPLIES_PAGE, COMMENTS_PAGE } from "../data/types"
import { commentsPageView, demoCommentCursor, demoRepliesList, readDemoCommentCursor, repliesPageView } from "./selectors"
import { createDemoDataSource } from "./source"
import { createDemoSeed, type DemoComment, type DemoPost, type DemoState } from "./state"
import { DEMO_STORAGE_KEY, DemoStore } from "./store"

/**
 * FD-03 — la démonstration pagine les commentaires comme le moteur : vingt racines par page,
 * cinquante réponses par page, un curseur opaque propre à chaque liste ; ce qu'on vient
 * d'envoyer paraît dans la dernière page lue.
 */
const NOW = Date.UTC(2026, 10, 10, 12)
const READER = "p-steeve"
const AUTHOR = "p-mireille"
const POST = "post-fd03"
const ROOT = "fd03-racine-01"

function fixture(): DemoState {
  const seed = createDemoSeed(NOW)
  const post: DemoPost = {
    id: POST, author: { kind: "person", id: AUTHOR }, body: "Publication fictive très commentée", audience: "public", visibility: "network",
    scope: { reach: "diaspora" }, moderation: "published", createdAt: NOW - 10_000_000, editedAt: null, reactions: {}, baseReactions: 0,
  }
  const comment = (id: string, createdAt: number, parentId: string | null): DemoComment => ({ id, postId: POST, authorId: AUTHOR, body: `Texte fictif ${id}`, createdAt, parentId, removedAt: null })
  const roots = Array.from({ length: 21 }, (_, index) => comment(`fd03-racine-${String(index + 1).padStart(2, "0")}`, NOW - 1_000_000 + index * 1000, null))
  const replies = Array.from({ length: 51 }, (_, index) => comment(`fd03-reponse-${String(index + 1).padStart(2, "0")}`, NOW - 500_000 + index * 1000, ROOT))
  return { ...seed, session: { personId: READER }, posts: [...seed.posts, post], comments: [...seed.comments, ...roots, ...replies] }
}

function setup() {
  const stored = new Map([[DEMO_STORAGE_KEY, JSON.stringify(fixture())]])
  const storage = {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => { stored.set(key, value) },
    removeItem: (key: string) => { stored.delete(key) },
  }
  const store = new DemoStore(storage, () => NOW, 0)
  return { store, source: createDemoDataSource(store) }
}

afterEach(cleanup)

describe("commentaires de démonstration paginés (FD-03)", () => {
  it("21 racines : vingt, puis la 21e par le curseur de la page ; la fin est dite", () => {
    const { store } = setup()
    const first = commentsPageView(store.getState(), POST, READER, NOW)!
    expect(first.items).toHaveLength(COMMENTS_PAGE)
    expect(first.isDone).toBe(false)
    expect(first.items.at(-1)?.id).toBe("fd03-racine-20")
    const after = readDemoCommentCursor(POST, first.continueCursor)
    expect(after).toEqual({ at: first.items.at(-1)!.createdAt, id: "fd03-racine-20" })
    const second = commentsPageView(store.getState(), POST, READER, NOW, after)!
    expect(second.items.map((item) => item.id)).toEqual(["fd03-racine-21"])
    expect(second.isDone).toBe(true)
    // L'aperçu des réponses et leur nombre suivent chaque racine.
    expect(first.items[0]).toMatchObject({ id: ROOT, replyCount: 51 })
    expect(first.items[0]?.replies).toHaveLength(3)
  })

  it("51 réponses : cinquante, puis la 51e", () => {
    const { store } = setup()
    const first = repliesPageView(store.getState(), POST, ROOT, READER, NOW)!
    expect(first.items).toHaveLength(COMMENT_REPLIES_PAGE)
    expect(first.isDone).toBe(false)
    const second = repliesPageView(store.getState(), POST, ROOT, READER, NOW, readDemoCommentCursor(demoRepliesList(POST, ROOT), first.continueCursor))!
    expect(second.items.map((item) => item.id)).toEqual(["fd03-reponse-51"])
    expect(second.isDone).toBe(true)
  })

  it("un curseur illisible, ou d'une autre liste, n'est jamais pris pour une position", () => {
    expect(readDemoCommentCursor(POST, null)).toBeNull()
    expect(readDemoCommentCursor(POST, "{pas du json")).toBeUndefined()
    expect(readDemoCommentCursor(POST, demoCommentCursor("autre-publication", { at: 1, id: "x" }))).toBeUndefined()
    expect(readDemoCommentCursor(demoRepliesList(POST, ROOT), demoCommentCursor(POST, { at: 1, id: "x" }))).toBeUndefined()
  })

  it("le fournisseur sert chaque page par son curseur, et refuse un curseur étranger", () => {
    const { source } = setup()
    const first = renderHook(() => source.useCommentsPage({ postId: POST }))
    expect(first.result.current).toMatchObject({ isLoading: false, error: null, data: { isDone: false } })
    const cursor = first.result.current.data!.continueCursor
    const second = renderHook(() => source.useCommentsPage({ postId: POST, cursor }))
    expect(second.result.current.data?.items.map((item) => item.id)).toEqual(["fd03-racine-21"])
    const foreign = renderHook(() => source.useCommentsPage({ postId: POST, cursor: demoCommentCursor("autre", { at: 0, id: "x" }) }))
    expect(foreign.result.current).toMatchObject({ data: undefined, error: "unknown" })
    const replies = renderHook(() => source.useRepliesPage({ postId: POST, commentId: ROOT }))
    expect(replies.result.current.data?.items).toHaveLength(COMMENT_REPLIES_PAGE)
    const missing = renderHook(() => source.useRepliesPage({ postId: POST, commentId: "inconnu" }))
    expect(missing.result.current).toMatchObject({ data: undefined, error: "not_found" })
  })

  it("le commentaire envoyé paraît dans la dernière page lue, avec son identifiant", async () => {
    const { store, source } = setup()
    const cursor = commentsPageView(store.getState(), POST, READER, NOW)!.continueCursor
    const last = renderHook(() => source.useCommentsPage({ postId: POST, cursor }))
    let created = ""
    await act(async () => {
      const result = await source.actions.comment({ postId: POST, body: "  Mon commentaire fictif  " })
      if (!result.ok) throw new Error(result.code)
      created = result.value.commentId
    })
    expect(last.result.current.data?.items.map((item) => item.id)).toEqual(["fd03-racine-21", created])
    expect(last.result.current.data?.items.at(-1)).toMatchObject({ body: "Mon commentaire fictif", isMine: true })
  })

  it("un autre lecteur, ou personne : la page se relit pour lui", async () => {
    const { store, source } = setup()
    const page = renderHook(() => source.useCommentsPage({ postId: POST }))
    expect(page.result.current.data?.items[0]?.isMine).toBe(false)
    await act(async () => { await store.switchTo(AUTHOR) })
    expect(page.result.current.data?.items[0]?.isMine).toBe(true)
    await act(async () => { await store.signOutEverywhere() })
    expect(page.result.current).toMatchObject({ data: undefined, error: "not_signed_in" })
  })
})
