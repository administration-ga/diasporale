import { LOCALE_COOKIE } from "@diasporale/features/i18n"
import { describe, expect, it } from "vitest"

import { localeFromBrowser } from "./browser-locale"

describe("localeFromBrowser — la langue sans le serveur", () => {
  it("suit d'abord le cookie de langue, comme le rendu serveur", () => {
    expect(localeFromBrowser({ cookie: `autre=1; ${LOCALE_COOKIE}=en; dernier=2`, languages: ["fr-FR"] })).toBe("en")
    expect(localeFromBrowser({ cookie: `${LOCALE_COOKIE}=fr`, languages: ["en-US"] })).toBe("fr")
  })

  it("ignore un cookie illisible ou d'une langue non servie, puis lit les langues du navigateur", () => {
    expect(localeFromBrowser({ cookie: `${LOCALE_COOKIE}=de`, languages: ["en-GB", "fr"] })).toBe("en")
    expect(localeFromBrowser({ cookie: `${LOCALE_COOKIE}`, languages: ["en"] })).toBe("en")
    expect(localeFromBrowser({ cookie: `x${LOCALE_COOKIE}=en`, languages: ["fr-CA"] })).toBe("fr")
  })

  it("rend le français quand rien ne correspond", () => {
    expect(localeFromBrowser({ cookie: "", languages: [] })).toBe("fr")
    expect(localeFromBrowser({ cookie: "", languages: ["de-DE", "es"] })).toBe("fr")
  })
})
