import { describe, expect, it } from "vitest"

import { normalizeFeedTag, routes } from "./routes"

describe("routes du fil — mots-dièse", () => {
  it("préserve les adresses existantes sans filtre", () => {
    expect(routes.feed()).toBe("/fil")
    expect(routes.feed("mon_pays")).toBe("/fil?scope=mon_pays")
  })
  it("encode le jeton canonique sans perdre portée ni pays", () => {
    expect(routes.feed("mon_pays", " ÉTÉ ", "CA")).toBe("/fil?scope=mon_pays&tag=%C3%A9t%C3%A9&country=CA")
    expect(routes.feed("diaspora", "gabon", "CA")).toBe("/fil?scope=diaspora&tag=gabon&country=CA")
    expect(routes.feed("mon_pays", undefined, "CA")).toBe("/fil?scope=mon_pays&country=CA")
  })
  it("ne redécoupe pas un jeton canonique Unicode dont la minuscule s'allonge", () => {
    expect(normalizeFeedTag(" İSTANBUL ")).toBe("i̇stanbul")
    expect(routes.feed(undefined, "i̇stanbul")).toBe("/fil?tag=i%CC%87stanbul")
  })
  it("un jeton ne peut pas injecter de paramètre ou de fragment", () => {
    const href = routes.feed("recents", "gabon&country=GA#fragment", "CA")
    const query = new URL(href, "https://exemple.test").searchParams
    expect(query.get("tag")).toBe("gabon&country=ga#fragment")
    expect(query.get("country")).toBe("CA")
    expect(new URL(href, "https://exemple.test").hash).toBe("")
  })
  it("un filtre vide ne s'invente aucun jeton", () => {
    expect(normalizeFeedTag(null)).toBeUndefined()
    expect(normalizeFeedTag(" \n\t ")).toBeUndefined()
    expect(routes.feed("recents", " ")).toBe("/fil?scope=recents")
  })
})
