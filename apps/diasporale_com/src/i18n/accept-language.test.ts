import { describe, expect, it } from "vitest"

import { localeFromAcceptLanguage } from "./accept-language"

describe("langue d'une première visite (Accept-Language)", () => {
  it("prend la première langue prise en charge, région ignorée", () => {
    expect(localeFromAcceptLanguage("en-CA,en;q=0.9,fr;q=0.8")).toBe("en")
    expect(localeFromAcceptLanguage("fr-BE,fr;q=0.9")).toBe("fr")
  })

  it("respecte les poids, puis l'ordre", () => {
    expect(localeFromAcceptLanguage("de;q=0.9,en;q=0.5,fr;q=0.7")).toBe("fr")
    expect(localeFromAcceptLanguage("es,en,fr")).toBe("en")
  })

  it("ignore une langue refusée (q=0) et un poids illisible", () => {
    expect(localeFromAcceptLanguage("en;q=0,fr;q=0.1")).toBe("fr")
    expect(localeFromAcceptLanguage("en;q=abc,fr")).toBe("fr")
  })

  it("rien qui corresponde, ou pas d'en-tête : la langue par défaut décidera", () => {
    expect(localeFromAcceptLanguage("de-DE,es;q=0.8")).toBeNull()
    expect(localeFromAcceptLanguage("")).toBeNull()
    expect(localeFromAcceptLanguage(null)).toBeNull()
    expect(localeFromAcceptLanguage(undefined)).toBeNull()
  })
})
