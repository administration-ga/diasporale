/**
 * « Pourquoi cette publication ? » (DG-019) : les raisons se déduisent de la seule
 * publication, dans un ordre stable, et la règle du fil est toujours dite.
 */
import { describe, expect, it } from "vitest"

import { postReasons } from "./post-explanation"

describe("raisons d'une publication", () => {
  it("un hub pays, une audience publique, lue aussi dans ANTSIA", () => {
    expect(postReasons({ scope: { reach: "local", country: "FR" }, audience: "public", visibility: "root" })).toEqual([
      { key: "postWhy.reach.local", country: "FR" },
      { key: "postWhy.audience.public" },
      { key: "postWhy.root" },
      { key: "postWhy.order" },
    ])
  })

  it("toute la diaspora, avec ou sans pays d'origine", () => {
    expect(postReasons({ scope: { reach: "diaspora", country: "BE" }, audience: "public", visibility: "network" })[0]).toEqual({ key: "postWhy.reach.diasporaOrigin", country: "BE" })
    expect(postReasons({ scope: { reach: "diaspora" }, audience: "public", visibility: "network" })[0]).toEqual({ key: "postWhy.reach.diaspora" })
  })

  it("chaque audience a sa raison ; la règle du fil vient toujours en dernier", () => {
    for (const audience of ["public", "connections", "group", "page"] as const) {
      const reasons = postReasons({ scope: { reach: "local", country: "FR" }, audience, visibility: "network" })
      expect(reasons[1]).toEqual({ key: `postWhy.audience.${audience}` })
      expect(reasons.at(-1)).toEqual({ key: "postWhy.order" })
      expect(reasons.some((reason) => reason.key === "postWhy.root")).toBe(false)
    }
  })
})
