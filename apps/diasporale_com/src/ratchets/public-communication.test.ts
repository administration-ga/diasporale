import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { type ClaimRuleId, detectPublicClaims, type PublicClaimOptions } from "./public-claims"
import { REPO_ROOT } from "./sources"

/**
 * Cliquet « communication publique » de DIASPORALE (lot LX-06) : aucun texte de
 * l'application — vitrine, écrans, pages légales, en français comme en
 * anglais — n'affirme un chiffre non mesuré, un audit, une certification, un
 * hébergement, une conformité ou un chiffrement de bout en bout. Le cliquet du
 * moteur ne relit que les dossiers d'ANTSIA ; celui-ci relit chaque fragment
 * de langue de DIASPORALE, fichier par fichier.
 */
const OPTIONS: PublicClaimOptions = {
  // Textes légaux relus par un juriste : seul endroit où le RGPD se cite.
  legalPrefixes: ["legal"],
  // La vitrine (porte, accueil, métadonnées) : tout chiffre de communauté y échoue.
  showcasePrefixes: ["landing", "meta", "brand"],
}

/**
 * Exceptions nommées : une clé, une règle, une raison. Chacune doit encore
 * servir (une exception morte échoue). Aucune n'est posée au 10/11/2026.
 */
interface ClaimException {
  /** Fragment de langue, relatif au dossier des locales (`fr/diasporale.json`). */
  readonly file: string
  readonly key: string
  readonly rule: ClaimRuleId
  readonly reason: string
}
const EXCEPTIONS: readonly ClaimException[] = []

const LOCALES_DIRECTORY = join(REPO_ROOT, "packages/diasporale-features/src/i18n/locales")

function localeFragments(): { file: string; messages: unknown }[] {
  return (["fr", "en"] as const).flatMap((locale) =>
    readdirSync(join(LOCALES_DIRECTORY, locale))
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => ({ file: `${locale}/${name}`, messages: JSON.parse(readFileSync(join(LOCALES_DIRECTORY, locale, name), "utf8")) as unknown })),
  )
}

const isExcepted = (file: string, key: string, rule: ClaimRuleId) =>
  EXCEPTIONS.some((exception) => exception.file === file && exception.key === key && exception.rule === rule)

describe("cliquet communication publique — ce que les textes de DIASPORALE n'affirment pas", () => {
  const fragments = localeFragments()
  const findings = fragments.flatMap(({ file, messages }) => detectPublicClaims(messages, OPTIONS).map((finding) => ({ file, ...finding })))

  it("relit bien chaque fragment, en français et en anglais", () => {
    expect(fragments.filter((fragment) => fragment.file.startsWith("fr/")).length).toBeGreaterThan(40)
    expect(fragments.filter((fragment) => fragment.file.startsWith("en/")).length).toBe(fragments.filter((fragment) => fragment.file.startsWith("fr/")).length)
  })

  it("aucune affirmation interdite dans les textes de l'application", () => {
    const remaining = findings.filter((finding) => !isExcepted(finding.file, finding.key, finding.rule))
    expect(remaining.map((finding) => `${finding.file} › ${finding.key} : ${finding.reason} — « ${finding.excerpt} »`)).toEqual([])
  })

  it("chaque exception sert encore et dit pourquoi", () => {
    for (const exception of EXCEPTIONS) {
      expect(exception.reason.length, `${exception.file} › ${exception.key}`).toBeGreaterThanOrEqual(20)
      expect(
        findings.some((finding) => finding.file === exception.file && finding.key === exception.key && finding.rule === exception.rule),
        `exception morte : ${exception.file} › ${exception.key} (${exception.rule})`,
      ).toBe(true)
    }
  })

  it("test du test : « 12 000 membres » dans la vitrine fait échouer le cliquet", () => {
    const rules = detectPublicClaims({ landing: { hero: "Rejoignez déjà 12 000 membres" } }, OPTIONS).map((finding) => finding.rule)
    expect(rules).toEqual(["community-figure"])
  })

  it("test du test : chaque affirmation interdite, en français et en anglais, est vue", () => {
    const messages = {
      landing: {
        uptime: "99,9 % de disponibilité",
        audit: "Plateforme auditée",
        hosting: "Vos données sont hébergées en France",
        certification: "{{brand}} est certifiée ISO 27001",
        location: "Vos données restent au Gabon",
        compliance: "Conforme au RGPD",
        endToEnd: "Vos messages sont chiffrés de bout en bout",
        superlative: "Le premier réseau social de la diaspora",
        worded: "Des milliers de Gabonais nous font confiance",
        small: "3 associations relais",
      },
      app: {
        figure: "1 500 associations inscrites",
        over: "Over 50 countries",
        hostedEn: "Your data is hosted in the EU",
        compliantEn: "GDPR-compliant",
        approved: "Plateforme homologuée par l'État",
      },
    }
    const byKey = new Map<string, ClaimRuleId[]>()
    for (const finding of detectPublicClaims(messages, OPTIONS)) byKey.set(finding.key, [...(byKey.get(finding.key) ?? []), finding.rule])
    expect(Object.fromEntries(byKey)).toEqual({
      "landing.uptime": ["percentage"],
      "landing.audit": ["audit"],
      "landing.hosting": ["hosting"],
      "landing.certification": ["certification"],
      "landing.location": ["data-location"],
      "landing.compliance": ["compliance", "gdpr-outside-legal"],
      "landing.endToEnd": ["end-to-end"],
      "landing.superlative": ["superlative"],
      "landing.worded": ["community-figure"],
      "landing.small": ["community-figure"],
      "app.figure": ["community-figure"],
      "app.over": ["community-figure"],
      "app.hostedEn": ["hosting"],
      "app.compliantEn": ["compliance", "gdpr-outside-legal"],
      "app.approved": ["certification"],
    })
  })

  it("test du test : un texte sain passe (logement, démarches, bornes, négations, valeurs lues)", () => {
    const messages = {
      app: {
        lodging: "Proposer un hébergement d'urgence",
        hostedByFamily: "Vous êtes hébergé chez un proche ?",
        paperwork: "Certificat de scolarité, attestation d'hébergement, copie certifiée conforme",
        limit: "Un groupe compte au plus 256 membres",
        notEncrypted: "Les messages ne sont pas chiffrés de bout en bout",
        auditLog: "Le journal d'audit des actes sensibles",
        measured: "{{count}} membres · {{rate}} %",
        code: "Code à 6 chiffres",
        rule: "Un pays ouvre avec deux associations relais et un modérateur",
        threshold: "Moins de 5 avis : part masquée",
        leader: "Leader associatif, il anime sa communauté",
        hostedEvent: "Hosted by {{page}}",
        law: "Les publications doivent être conformes à la loi",
        childcare: "Agrément d'assistante maternelle",
        countryCode: "Code pays ISO 3166-1 alpha-2",
      },
      legal: {
        gdpr: "Le RGPD pour les résidents de l'Union européenne.",
        hostingTitle: "Hébergement",
        hostingPending: "Le prestataire et la région d'hébergement seront indiqués ici une fois choisis et contractualisés.",
      },
    }
    expect(detectPublicClaims(messages, OPTIONS)).toEqual([])
  })
})
