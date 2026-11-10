// @vitest-environment node
import { describe, expect, it } from "vitest"

import {
  ACCOUNT_DESTINATIONS,
  PERSONAL_DESTINATIONS,
  PRIMARY_DESTINATIONS,
  ROUTE_DESTINATIONS,
  navDestinationOf,
  type NavDestination,
  type RouteKey,
} from "./nav-destinations"
import { routes } from "./routes"

/**
 * La table des destinations (UX-05) : toute adresse de la table des routes, hors porte et pages
 * publiques, se range sous une entrée de la navigation, et une seule.
 */

const OWN = "awa.demo"
const KEYS = Object.keys(routes) as RouteKey[]

/** Hors de la coque de membre : la porte, l'accueil, « Mes données » hors adhésion, les pages publiques. */
const OUTSIDE_SHELL: readonly RouteKey[] = [
  "home",
  "enter",
  "register",
  "enterAfterSignOut",
  "enterIdn",
  "enterCode",
  "welcome",
  "myData",
  "demo",
  "charte",
  "legalNotice",
  "privacy",
  "terms",
  "communityRules",
  "contact",
  "health",
  "healthApi",
  "appIcon",
]

/**
 * Compose une adresse de la table en donnant la même valeur à chaque paramètre (identifiant, pays,
 * onglet, filtre) : la route elle-même dit son chemin, sans liste écrite à la main.
 */
function compose(key: RouteKey, value: string): string {
  const route = routes[key] as unknown as (...values: readonly string[]) => string
  return route(value, value, value)
}

function pathOf(href: string): string {
  const end = href.search(/[?#]/)
  return end === -1 ? href : href.slice(0, end)
}

describe("table des destinations — complétude", () => {
  it("une ligne par adresse de la table des routes, ni plus ni moins", () => {
    expect(Object.keys(ROUTE_DESTINATIONS).sort()).toEqual([...KEYS].sort())
  })

  it("hors de la porte et des pages publiques, chaque adresse a une destination", () => {
    for (const key of KEYS) {
      expect(ROUTE_DESTINATIONS[key].kind === "outside", key).toBe(OUTSIDE_SHELL.includes(key))
    }
  })

  it("chaque ligne porte le gabarit de sa propre route", () => {
    for (const key of KEYS) {
      const home = ROUTE_DESTINATIONS[key]
      if (home.kind === "outside") continue
      expect(home.path, key).toBe(pathOf(compose(key, "segment")))
    }
  })

  it("une destination et une seule : le chemin de chaque adresse revient à sa ligne", () => {
    for (const key of KEYS) {
      const home = ROUTE_DESTINATIONS[key]
      const href = compose(key, "valeur-1")
      if (home.kind === "outside") {
        expect(navDestinationOf(href, OWN), key).toBeNull()
      } else if (home.kind === "person") {
        expect(navDestinationOf(href, "valeur-1"), key).toBe("profile")
        expect(navDestinationOf(href, OWN), key).toBe("explore")
      } else {
        expect(navDestinationOf(href, OWN), key).toBe(home.destination)
      }
    }
  })

  it("chaque entrée de la navigation a au moins une adresse à marquer", () => {
    const reached = new Set<NavDestination>()
    for (const key of KEYS) {
      const home = ROUTE_DESTINATIONS[key]
      if (home.kind === "member") reached.add(home.destination)
      if (home.kind === "person") {
        reached.add("profile")
        reached.add("explore")
      }
    }
    expect([...PRIMARY_DESTINATIONS, ...PERSONAL_DESTINATIONS, ...ACCOUNT_DESTINATIONS].filter((destination) => !reached.has(destination))).toEqual([])
  })
})

describe("table des destinations — décision 5 du plan 02", () => {
  it.each([
    [routes.mutualAid("FR", "Lyon"), "communities"],
    [routes.mutualAidItem("question-1"), "communities"],
    [routes.arrivalKit(), "communities"],
    [routes.arrivalKitResource("ressource-1"), "communities"],
    [routes.mentoring("FR"), "communities"],
    [routes.mentorProfile("mentor-1"), "communities"],
    [routes.jobs(), "communities"],
    [routes.jobOffer("offre-1"), "communities"],
    [routes.talents("FR"), "communities"],
    [routes.agenda(), "communities"],
    [routes.associationGroup("amicale-lyon"), "communities"],
    [routes.associationEvent("amicale-lyon", "evt-42"), "communities"],
    [routes.pages({ followed: true }), "explore"],
    [routes.page("amicale-lyon"), "explore"],
    [routes.pageServices("amicale-lyon"), "explore"],
    [routes.pageClaim("amicale-lyon"), "explore"],
    [routes.profile("autre.membre"), "explore"],
    [routes.album("autre.membre", "album-1"), "explore"],
  ] as const)("%s relève de « %s »", (href, destination) => {
    expect(navDestinationOf(href, OWN)).toBe(destination)
  })

  it("son propre profil, ses albums et son aperçu relèvent du compte, pas d'Explorer", () => {
    for (const href of [routes.profile(OWN), routes.profilePreview(OWN), routes.profileTab(OWN, "albums"), routes.album(OWN, "album-1"), routes.newAlbum(OWN)]) {
      expect(navDestinationOf(href, OWN), href).toBe("profile")
    }
    // Sans identifiant publié, aucun profil n'est le sien.
    expect(navDestinationOf(routes.profile(OWN), null)).toBe("explore")
  })
})

describe("table des destinations — chemins", () => {
  it.each([
    ["/messages/conversation-7", "messages"],
    [routes.contextualConversation("fil-1"), "messages"],
    ["/pages/amicale-lyon/gerer", "myActivity"],
    [routes.pageDecisions("amicale-lyon"), "myActivity"],
    [routes.associationMembers("amicale-lyon"), "myActivity"],
    ["/services/offre-coiffure", "services"],
    ["/pays/ca", "communities"],
    ["/actus/nouvelle", "feed"],
    ["/fil/", "feed"],
    [routes.settingsData(), "settings"],
    [routes.attestation(), "settings"],
  ] as const)("une page sous un gabarit en relève : %s → « %s »", (pathname, destination) => {
    expect(navDestinationOf(pathname, OWN)).toBe(destination)
  })

  it.each(["/servicesx", "/filtre", "/messagesx", "/pays", "/inconnu", "/", ""])("%s ne relève d'aucune entrée", (pathname) => {
    expect(navDestinationOf(pathname, OWN)).toBeNull()
  })
})
