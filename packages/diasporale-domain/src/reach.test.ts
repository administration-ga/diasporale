import { describe, expect, test } from "bun:test"
import {
  DEFAULT_FEED_SCOPE,
  DEFAULT_REACH,
  DEFAULT_VISIBILITY,
  FEED_SCOPES,
  POST_AUDIENCES,
  admitsInFeedScope,
  canAlsoPublishOnRoot,
  defaultScopeFor,
  isReach,
  isShownInHub,
  originCountryBadge,
  parseContentScope,
  parseFeedScope,
  resolveVisibility,
  type FeedRelation,
} from "./reach"

describe("visibilité — network par défaut, root seulement par geste sur une audience publique", () => {
  test("défauts", () => {
    expect(DEFAULT_VISIBILITY).toBe("network")
    expect(DEFAULT_REACH).toBe("local")
  })

  test("la case « aussi sur ANTIA » n'existe que pour l'audience publique", () => {
    for (const audience of POST_AUDIENCES) {
      expect(canAlsoPublishOnRoot(audience)).toBe(audience === "public")
    }
  })

  test("root exige audience publique ET geste explicite (R4)", () => {
    expect(resolveVisibility({ audience: "public", alsoOnRoot: true })).toBe("root")
    expect(resolveVisibility({ audience: "public", alsoOnRoot: false })).toBe("network")
    for (const audience of ["connections", "group", "page"] as const) {
      expect(resolveVisibility({ audience, alsoOnRoot: true })).toBe("network")
      expect(resolveVisibility({ audience, alsoOnRoot: false })).toBe("network")
    }
  })
})

describe("portée d'un contenu", () => {
  test("isReach", () => {
    expect(isReach("local")).toBe(true)
    expect(isReach("diaspora")).toBe(true)
    expect(isReach("global")).toBe(false)
  })

  test("local exige un pays de résidence ; diaspora le garde comme origine facultative", () => {
    expect(parseContentScope({ reach: "local", country: "fr" })).toEqual({ ok: true, value: { reach: "local", country: "FR" } })
    expect(parseContentScope({ reach: "local" })).toEqual({ ok: false, code: "scope_country_required" })
    expect(parseContentScope({ reach: "local", country: null })).toEqual({ ok: false, code: "scope_country_required" })
    expect(parseContentScope({ reach: "diaspora" })).toEqual({ ok: true, value: { reach: "diaspora" } })
    expect(parseContentScope({ reach: "diaspora", country: "CA" })).toEqual({
      ok: true,
      value: { reach: "diaspora", country: "CA" },
    })
  })

  test("refus : portée inconnue, pays invalide ou Gabon", () => {
    expect(parseContentScope({ reach: "monde", country: "FR" })).toEqual({ ok: false, code: "scope_reach_invalid" })
    expect(parseContentScope({ reach: "local", country: "GA" })).toEqual({ ok: false, code: "scope_country_invalid" })
    expect(parseContentScope({ reach: "diaspora", country: "Narnia" })).toEqual({ ok: false, code: "scope_country_invalid" })
  })

  test("portée par défaut du composeur : le pays de résidence", () => {
    expect(defaultScopeFor("BE")).toEqual({ reach: "local", country: "BE" })
  })

  test("hub : le local du pays + toute la portée diaspora (R7)", () => {
    expect(isShownInHub({ reach: "local", country: "FR" }, "FR")).toBe(true)
    expect(isShownInHub({ reach: "local", country: "FR" }, "CA")).toBe(false)
    expect(isShownInHub({ reach: "diaspora", country: "FR" }, "CA")).toBe(true)
    expect(isShownInHub({ reach: "diaspora" }, "CA")).toBe(true)
  })

  test("pastille d'origine : seulement pour un contenu diaspora venu d'ailleurs", () => {
    expect(originCountryBadge({ reach: "diaspora", country: "FR" }, "CA")).toBe("FR")
    expect(originCountryBadge({ reach: "diaspora", country: "CA" }, "CA")).toBeNull()
    expect(originCountryBadge({ reach: "diaspora" }, "CA")).toBeNull()
    expect(originCountryBadge({ reach: "local", country: "FR" }, "CA")).toBeNull()
  })
})

describe("portées du fil (EXF-DG-13)", () => {
  test("quatre portées, « Mon pays » par défaut", () => {
    expect([...FEED_SCOPES]).toEqual(["mon_pays", "diaspora", "recents", "pour_vous"])
    expect(DEFAULT_FEED_SCOPE).toBe("mon_pays")
  })

  test("parseFeedScope : valeurs, synonymes, et jamais une valeur morte", () => {
    for (const scope of FEED_SCOPES) expect(parseFeedScope(scope)).toBe(scope)
    expect(parseFeedScope(" Mon-Pays ")).toBe("mon_pays")
    expect(parseFeedScope("pays")).toBe("mon_pays")
    expect(parseFeedScope("country")).toBe("mon_pays")
    expect(parseFeedScope("toute-la-diaspora")).toBe("diaspora")
    expect(parseFeedScope("global")).toBe("diaspora")
    expect(parseFeedScope("recent")).toBe("recents")
    expect(parseFeedScope("pour-vous")).toBe("pour_vous")
    expect(parseFeedScope("pourvous")).toBe("pour_vous")
    expect(parseFeedScope("foryou")).toBe("pour_vous")
    expect(parseFeedScope("inconnue")).toBe("mon_pays")
    expect(parseFeedScope("")).toBe("mon_pays")
    expect(parseFeedScope(null)).toBe("mon_pays")
    expect(parseFeedScope(undefined)).toBe("mon_pays")
  })

  const NONE: FeedRelation = { own: false, connection: false, follow: false, followedPage: false, memberGroup: false }
  const lyonPost = { scope: { reach: "local", country: "FR" } as const, relation: NONE }
  const diasporaPost = { scope: { reach: "diaspora", country: "CA" } as const, relation: NONE }

  test("mon_pays : local de mon pays + diaspora", () => {
    expect(admitsInFeedScope("mon_pays", lyonPost, "FR")).toBe(true)
    expect(admitsInFeedScope("mon_pays", lyonPost, "CA")).toBe(false)
    expect(admitsInFeedScope("mon_pays", diasporaPost, "FR")).toBe(true)
  })

  test("diaspora : la seule couche commune", () => {
    expect(admitsInFeedScope("diaspora", lyonPost, "FR")).toBe(false)
    expect(admitsInFeedScope("diaspora", diasporaPost, "FR")).toBe(true)
  })

  test("recents : tout ce qui est déjà visible", () => {
    expect(admitsInFeedScope("recents", lyonPost, "CA")).toBe(true)
  })

  test("pour_vous : un lien choisi, et un seul suffit", () => {
    expect(admitsInFeedScope("pour_vous", lyonPost, "FR")).toBe(false)
    for (const key of Object.keys(NONE) as (keyof FeedRelation)[]) {
      expect(admitsInFeedScope("pour_vous", { ...lyonPost, relation: { ...NONE, [key]: true } }, "FR")).toBe(true)
    }
  })
})
