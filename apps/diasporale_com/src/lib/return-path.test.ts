// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  RETURN_PATH_KEY,
  RETURN_PATH_TTL_MS,
  entryExit,
  forgetReturnPath,
  liveMember,
  parseReturnPath,
  peekReturnPath,
  rememberReturnPath,
  welcomeExit,
  type EntryMember,
  type TabStorage,
} from "./return-path"
import { ROUTE_FILTER_KEYS, routes } from "./routes"

/**
 * La page demandée avant la connexion (UX-02, MO-03) : la fonction pure qui n'accepte qu'un
 * chemin interne connu de la table, les sorties qui y mènent, la mémoire de l'onglet.
 */

const EVENT = routes.associationEvent("amicale-lyon", "evt-42")
const NOW = Date.UTC(2026, 10, 10, 12)

function memoryStorage(): TabStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

describe("parseReturnPath — un chemin interne connu de la table, rien d'autre", () => {
  it("refuse toute adresse externe, double barre, barre inverse et schéma", () => {
    for (const raw of [
      "https://exemple.test/pages/amicale-lyon",
      "//exemple.test/pages/amicale-lyon",
      "/\\exemple.test",
      "\\\\exemple.test",
      "javascript:alert(1)",
      "data:text/html,bonjour",
      "/javascript:alert(1)",
      "pages/amicale-lyon",
      "",
    ]) {
      expect(parseReturnPath(raw), raw).toBeNull()
    }
  })

  it("refuse un chemin inconnu, l'entrée, l'accueil, les pages publiques et ce qui n'est pas une chaîne", () => {
    for (const raw of ["/inconnu", "/pages/amicale-lyon/inconnu", routes.enter(), routes.enterCode(), routes.welcome(), routes.home(), routes.charte(), routes.demo(), "/actus/autre"]) {
      expect(parseReturnPath(raw), raw).toBeNull()
    }
    expect(parseReturnPath(null)).toBeNull()
    expect(parseReturnPath(42)).toBeNull()
    expect(parseReturnPath({ path: EVENT })).toBeNull()
  })

  it("refuse un segment hors charte : blanc, caractère de contrôle, « .. », barre encodée, encodage cassé", () => {
    for (const raw of ["/pages/amicale lyon", "/pages/amicale%0Alyon", "/pages/..", "/pages/amicale%2Flyon", "/pages/%E9", `/pages/${"a".repeat(600)}`]) {
      expect(parseReturnPath(raw), raw).toBeNull()
    }
  })

  it("accepte une page connue avec ses filtres, et retire tout le reste (jeton, code, traceur)", () => {
    expect(parseReturnPath(EVENT)).toEqual({ path: EVENT, needs: "read_network" })
    const filtered = routes.services({ q: "coiffure", country: "FR", city: "Lyon", category: "beaute" })
    expect(parseReturnPath(filtered)).toEqual({ path: filtered, needs: "read_network" })
    expect(parseReturnPath(`${EVENT}?token=secret&code=123456&fbclid=traceur`)?.path).toBe(EVENT)
    expect(parseReturnPath(`${routes.jobs("FR", "Paris")}&jeton=secret`)?.path).toBe(routes.jobs("FR", "Paris"))
  })

  it("garde une ancre simple et les adresses de la table à segment variable", () => {
    expect(parseReturnPath(routes.pageServices("amicale-lyon"))?.path).toBe(routes.pageServices("amicale-lyon"))
    expect(parseReturnPath(`${EVENT}#<script>`)?.path).toBe(EVENT)
    expect(parseReturnPath(routes.profile("mengue.m%C3%A9"))?.path).toBe(routes.profile("mengue.m%C3%A9"))
    expect(parseReturnPath(routes.album("ada", "album-1"))?.path).toBe(routes.album("ada", "album-1"))
    expect(parseReturnPath(routes.hub("FR"))?.path).toBe(routes.hub("FR"))
    expect(parseReturnPath(routes.contextualConversation("fil-1"))?.path).toBe(routes.contextualConversation("fil-1"))
    expect(parseReturnPath(`${routes.feed()}/`)?.path).toBe(routes.feed())
  })

  it("dit ce que la page demande : lire, écrire, l'annuaire, ou seulement une personne connectée", () => {
    expect(parseReturnPath(routes.messages())?.needs).toBe("communicate")
    expect(parseReturnPath(routes.members())?.needs).toBe("view_directory")
    expect(parseReturnPath(routes.newPage("association"))?.needs).toBe("create_page")
    expect(parseReturnPath(routes.newStory())?.needs).toBe("publish")
    expect(parseReturnPath(routes.sponsor())?.needs).toBe("sponsor")
    // La demande de parrainage par lien (EA-10) : même page, son identifiant public survit à l'entrée.
    expect(parseReturnPath(routes.sponsorFor("eloise.ndong"))).toEqual({ path: "/parrainer?pour=eloise.ndong", needs: "sponsor" })
    expect(parseReturnPath(routes.myData())?.needs).toBe("person")
  })

  it("chaque filtre que la table compose est gardé ; l'entrée seule en emploie d'autres", () => {
    const hrefs = [
      routes.feed("diaspora", "Fête", "FR"),
      routes.feedDiscovery(),
      routes.pages({ q: "amicale", ownerKind: "association", associationType: "cultural", country: "FR" }),
      routes.pages({ ownerKind: "company", sector: "food" }),
      routes.pages({ followed: true }),
      routes.services({ q: "x", country: "FR", city: "Lyon", category: "c", delivery: "remote" }),
      routes.profilePreview("ada"),
      routes.profileTab("ada", "albums", true),
      routes.editAlbum("ada", "album-1"),
      routes.newAlbum("ada"),
      routes.relations("received"),
      routes.story("ada"),
      routes.myActivity("offres"),
      routes.newPage("company"),
      routes.pageManage("amicale", "equipe"),
      routes.moderationDesk("recours"),
      routes.mutualAid("FR", "Lyon"),
      routes.talents("FR"),
      routes.sponsorFor("eloise.ndong"),
    ]
    const keys = new Set(hrefs.flatMap((href) => [...new URLSearchParams(href.split("?")[1] ?? "").keys()]))
    expect([...keys].filter((key) => !(ROUTE_FILTER_KEYS as readonly string[]).includes(key))).toEqual([])
    for (const href of hrefs) expect(parseReturnPath(href)?.path, href).toBe(href)
  })
})

describe("les sorties — porte, code, IDN, fin de l'accueil", () => {
  const declared: EntryMember = { status: "declaree", country: "FR" }
  const pending: EntryMember = { status: "en_attente", country: "CA" }
  const event = parseReturnPath(EVENT)
  const messages = parseReturnPath(routes.messages())
  const myData = parseReturnPath(routes.myData())

  it("un membre va à la page demandée ; sans page demandée, à son fil", () => {
    expect(entryExit(declared, event)).toBe(EVENT)
    expect(entryExit(declared, null)).toBe(routes.feed())
    expect(entryExit({ status: "suspendue", country: "FR" }, event)).toBe(EVENT)
  })

  it("un compte en attente : la page si elle lui est lisible, sinon son hub", () => {
    expect(entryExit(pending, event)).toBe(EVENT)
    expect(entryExit(pending, messages)).toBe(routes.hub("CA"))
    expect(entryExit(pending, parseReturnPath(routes.members()))).toBe(routes.hub("CA"))
  })

  it("sans adhésion : l'accueil d'abord, sauf pour « Mes données »", () => {
    expect(entryExit(null, event)).toBe(routes.welcome())
    expect(entryExit(null, null)).toBe(routes.welcome())
    expect(entryExit(null, myData)).toBe(routes.myData())
  })

  it("la fin de l'accueil : la page demandée s'il peut la lire, sinon son hub et l'avis de bienvenue", () => {
    expect(welcomeExit(declared, event)).toBe(EVENT)
    expect(welcomeExit(declared, null)).toBe(routes.hubWelcome("FR"))
    expect(welcomeExit(pending, messages)).toBe(routes.hubWelcome("CA"))
  })

  it("une adhésion partie n'est plus vivante", () => {
    const facet = { countryOfResidence: "FR" as const }
    expect(liveMember({ status: "partie", facet })).toBeNull()
    expect(liveMember(null)).toBeNull()
    expect(liveMember({ status: "en_attente", facet })).toEqual({ status: "en_attente", country: "FR" })
  })
})

describe("la mémoire de l'onglet", () => {
  it("retient la page où la garde a arrêté la personne, la rend revalidée, l'oublie", () => {
    const storage = memoryStorage()
    rememberReturnPath({ pathname: "/pages/amicale-lyon/evenements/evt-42", search: "?token=secret", hash: "" }, NOW, storage)
    expect(JSON.parse(storage.items.get(RETURN_PATH_KEY) ?? "{}")).toEqual({ path: EVENT, at: NOW })
    expect(peekReturnPath(NOW + 1000, storage)).toEqual({ path: EVENT, needs: "read_network" })
    // Lire ne consomme pas : toutes les sorties mènent au même endroit.
    expect(peekReturnPath(NOW + 2000, storage)?.path).toBe(EVENT)
    forgetReturnPath(storage)
    expect(peekReturnPath(NOW + 3000, storage)).toBeNull()
  })

  it("une page inconnue n'est pas retenue et ne remplace pas la précédente", () => {
    const storage = memoryStorage()
    rememberReturnPath({ pathname: EVENT, search: "", hash: "" }, NOW, storage)
    rememberReturnPath({ pathname: routes.welcome(), search: "", hash: "" }, NOW, storage)
    rememberReturnPath({ pathname: "//exemple.test", search: "", hash: "" }, NOW, storage)
    expect(peekReturnPath(NOW, storage)?.path).toBe(EVENT)
  })

  it("une mémoire échue, datée du futur ou altérée ne mène nulle part", () => {
    const storage = memoryStorage()
    rememberReturnPath({ pathname: EVENT, search: "", hash: "" }, NOW, storage)
    expect(peekReturnPath(NOW + RETURN_PATH_TTL_MS + 1, storage)).toBeNull()
    expect(peekReturnPath(NOW - 1, storage)).toBeNull()
    storage.items.set(RETURN_PATH_KEY, JSON.stringify({ path: "https://exemple.test/", at: NOW }))
    expect(peekReturnPath(NOW, storage)).toBeNull()
    storage.items.set(RETURN_PATH_KEY, "pas du JSON")
    expect(peekReturnPath(NOW, storage)).toBeNull()
  })

  it("un stockage refusé n'empêche ni d'entrer ni de sortir", () => {
    const refused: TabStorage = {
      getItem: () => { throw new Error("refusé") },
      setItem: () => { throw new Error("refusé") },
      removeItem: () => { throw new Error("refusé") },
    }
    expect(() => rememberReturnPath({ pathname: EVENT, search: "", hash: "" }, NOW, refused)).not.toThrow()
    expect(peekReturnPath(NOW, refused)).toBeNull()
    expect(() => forgetReturnPath(refused)).not.toThrow()
    expect(peekReturnPath(NOW, null)).toBeNull()
  })
})
