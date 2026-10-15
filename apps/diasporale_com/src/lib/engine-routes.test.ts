import { describe, expect, it } from "vitest"

import { engineRoutes } from "./engine-routes"
import { routes } from "./routes"

describe("engineRoutes — les adresses que lisent les surfaces du moteur", () => {
  it("l'accueil du moteur est le fil : la carte iCom y consomme les adresses de messagerie au bureau", () => {
    expect(engineRoutes.home()).toBe(routes.feed())
  })

  it("chaque base vient de la table de l'application", () => {
    expect(engineRoutes.messages()).toBe("/messages")
    expect(engineRoutes.stories()).toBe("/actus")
    expect(engineRoutes.profile("awa.demo")).toBe(routes.profile("awa.demo"))
    expect(engineRoutes.page("asso-lyon")).toBe(routes.page("asso-lyon"))
    expect(engineRoutes.settings?.()).toBe(routes.settings())
    expect(engineRoutes.conference("s 1")).toBe("/direct/s%201")
  })
})
