import { HOME_COUNTRY } from "@diasporale/domain"
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

describe("routes de l'arborescence — cinq destinations et espace personnel (DG-005)", () => {
  it("donne une adresse fixe à chaque destination principale", () => {
    expect([routes.feed(), routes.explore(), routes.services(), routes.communities(), routes.messages()]).toEqual([
      "/fil",
      "/explorer",
      "/services",
      "/communautes",
      "/messages",
    ])
  })

  it("CC-6 : une conversation de mise en relation vit sous la messagerie, son identifiant encodé une fois", () => {
    expect(routes.contextualConversation("fil-1")).toBe("/messages/mise-en-relation/fil-1")
    expect(routes.contextualConversation("fil 2")).toBe("/messages/mise-en-relation/fil%202")
  })

  it("Communautés ne dépend pas du pays de résidence ; le hub d'un pays garde son code en minuscules", () => {
    expect(routes.communities()).toBe("/communautes")
    expect(routes.hub("CA")).toBe("/pays/ca")
  })

  it("Mon agenda possède sa propre route sans modifier Communautés", () => {
    expect(routes.agenda()).toBe("/agenda")
    expect(routes.communities()).toBe("/communautes")
  })

  it("porte les filtres du catalogue dans l'adresse, sans valeur vide ni pays invalide", () => {
    expect(routes.services({})).toBe("/services")
    expect(routes.services({ q: "  coiffure ", country: "FR", city: " Paris ", category: "beaute", delivery: "onsite" })).toBe(
      "/services?q=coiffure&pays=FR&ville=Paris&categorie=beaute&mode=onsite",
    )
    expect(routes.services({ q: "   ", city: "" })).toBe("/services")
    // Le Gabon n'est pas un pays de résidence : il n'entre jamais comme zone de recherche.
    expect(routes.services({ country: HOME_COUNTRY })).toBe("/services")
  })

  it("une recherche ne peut pas injecter de paramètre ou de fragment", () => {
    const href = routes.services({ q: "tresses&pays=GA#ancre", city: "Paris&mode=remote" })
    const url = new URL(href, "https://exemple.test")
    expect(url.searchParams.get("q")).toBe("tresses&pays=GA#ancre")
    expect(url.searchParams.get("ville")).toBe("Paris&mode=remote")
    expect(url.searchParams.get("pays")).toBeNull()
    expect(url.searchParams.get("mode")).toBeNull()
    expect(url.hash).toBe("")
  })

  it("encode les identifiants des offres et des demandes dans un seul segment", () => {
    expect(routes.serviceOffer("offre/1?x")).toBe("/services/offre%2F1%3Fx")
    expect(routes.serviceRequest("demande 7")).toBe("/mes-demandes/demande%207")
    expect(routes.activityRequest("d#2")).toBe("/mon-activite/demandes/d%232")
  })

  it("Mes demandes, Mon activité et ses onglets", () => {
    expect(routes.myServiceRequests()).toBe("/mes-demandes")
    expect(routes.myActivity()).toBe("/mon-activite")
    expect(routes.myActivity("offres")).toBe("/mon-activite?onglet=offres")
    expect(routes.myActivity("demandes")).toBe("/mon-activite?onglet=demandes")
    expect(routes.myActivity("pages")).toBe("/mon-activite?onglet=pages")
  })

  it("pages : création, gestion et revendication", () => {
    expect(routes.newPage()).toBe("/nouvelle-page")
    expect(routes.newPage("association")).toBe("/nouvelle-page?type=association")
    expect(routes.newPage("company")).toBe("/nouvelle-page?type=company")
    expect(routes.pageManage("asso-lyon")).toBe("/pages/asso-lyon/gerer")
    expect(routes.pageManage("asso-lyon", "equipe")).toBe("/pages/asso-lyon/gerer?onglet=equipe")
    expect(routes.pageManage("asso-lyon", "emplois")).toBe("/pages/asso-lyon/gerer?onglet=emplois")
    expect(routes.pageDecisions("asso-lyon")).toBe("/pages/asso-lyon/gerer?onglet=decisions")
    expect(routes.pageDecisions("asso-lyon")).toBe(routes.pageManage("asso-lyon", "decisions"))
    expect(routes.pageClaim("asso-lyon")).toBe("/pages/asso-lyon/revendiquer")
  })

  it("les entrées du menu du compte restent des ancres des réglages", () => {
    expect(routes.settings()).toBe("/parametres")
    expect(routes.settingsFeed()).toBe("/parametres#mon-fil")
    expect(routes.settingsData()).toBe("/parametres#mes-donnees")
    expect(routes.settingsReports()).toBe("/parametres#mes-signalements")
    expect(routes.sponsorHelp()).toBe("/parametres#parrainage")
    expect(routes.register()).toBe("/entrer?inscription=1")
  })
})
