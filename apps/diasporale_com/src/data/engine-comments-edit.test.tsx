import type { EngineAuthClient } from "@antsia/api/auth-client"
import type { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { ConvexError } from "convex/values"
import { describe, expect, it, vi } from "vitest"

import { createEngineActions } from "./engine-source"
import { toCommentThreadView } from "./engine-views"

function setup() {
  const calls: { name: string; args: unknown }[] = []
  const query = vi.fn().mockImplementation(async (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    calls.push({ name: getFunctionName(ref), args })
    return { _id: "network-diasporale" }
  })
  const mutation = vi.fn().mockImplementation(async (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    calls.push({ name: getFunctionName(ref), args })
    return { editedAt: 123 }
  })
  const actions = createEngineActions({ convex: { query, mutation } as unknown as ConvexReactClient, authClient: {} as EngineAuthClient })
  if (!actions.editComment) throw new Error("Capacité d'édition absente du fournisseur moteur")
  return { edit: actions.editComment, query, mutation, calls }
}

describe("commentaires — édition publique du moteur", () => {
  it("modifie le commentaire existant dans DIASPORALE, sans créer ni retirer de commentaire", async () => {
    const { edit, calls } = setup()
    expect(await edit("comment-recette", "  Corps corrigé #Gabon @awa.recette  ")).toEqual({ ok: true, value: null })
    expect(calls).toEqual([
      { name: "modules/networks/networks:getBySlug", args: { slug: "diasporale" } },
      { name: "modules/engagement/engagement:editComment", args: { networkId: "network-diasporale", commentId: "comment-recette", body: "  Corps corrigé #Gabon @awa.recette  " } },
    ])
  })

  it.each([
    { code: "notFound", error: "not_found" },
    { code: "unauthenticated", error: "not_signed_in" },
    { code: "membershipSuspended", error: "suspended" },
    { code: "statusInsufficient", error: "status_insufficient" },
    { code: "rateLimited", error: "rate_limited" },
    { code: "invalidArgument", rule: "COMMENT_EMPTY", error: "comment_empty" },
    { code: "invalidArgument", rule: "COMMENT_TOO_LONG", error: "comment_too_long" },
  ])("rend le refus fermé $error sans opération compensatoire", async ({ code, rule, error }) => {
    const { edit, mutation, calls } = setup()
    mutation.mockRejectedValueOnce(new ConvexError({ code, ...(rule ? { rule } : {}), detail: "PRIVATE_DETAIL" }))
    expect(await edit("comment-recette", "Brouillon conservé par l'éditeur")).toEqual({ ok: false, code: error })
    expect(mutation).toHaveBeenCalledOnce()
    expect(calls.map((call) => call.name)).toEqual(["modules/networks/networks:getBySlug"])
  })

  it("un échec inattendu n'expose aucun détail et peut être repris par un nouvel appel explicite", async () => {
    const { edit, mutation } = setup()
    mutation.mockRejectedValueOnce(new Error("PRIVATE_DETAIL"))
    expect(await edit("comment-recette", "Correction")).toEqual({ ok: false, code: "unknown" })
    expect(await edit("comment-recette", "Correction")).toEqual({ ok: true, value: null })
    expect(mutation).toHaveBeenCalledTimes(2)
  })

  it("n'écrit rien si le réseau DIASPORALE n'est pas disponible", async () => {
    const { edit, query, mutation } = setup()
    query.mockResolvedValueOnce(null)
    expect(await edit("comment-recette", "Correction")).toEqual({ ok: false, code: "network_unavailable" })
    expect(mutation).not.toHaveBeenCalled()
  })

  it("projette l'édition d'une racine et d'une réponse sans déplacer leur date de création", () => {
    type Thread = Parameters<typeof toCommentThreadView>[0]
    const reply: Thread["replies"][number] = {
      commentId: "reply-recette" as Thread["commentId"],
      author: { personId: "person-recette" as Thread["author"]["personId"], handle: null, displayName: null, avatarUrl: null },
      body: "Réponse corrigée", createdAt: 2, editedAt: 4, isMine: true,
    }
    const thread: Thread = { ...reply, commentId: "root-recette" as Thread["commentId"], body: "Racine", createdAt: 1, editedAt: null, replyCount: 1, replies: [reply] }
    expect(toCommentThreadView(thread)).toMatchObject({
      id: "root-recette", body: "Racine", createdAt: 1, edited: false, replyCount: 1,
      replies: [{ id: "reply-recette", body: "Réponse corrigée", createdAt: 2, edited: true, author: { handle: null, displayName: null } }],
    })
  })
})
