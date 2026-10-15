import {
  CONSENT_PURPOSES,
  DIRECTORY_VISIBILITY_LEVELS,
  FACET_FIELDS,
  FEED_SCOPES,
  FIELD_VISIBILITY_LEVELS,
  MEMBERSHIP_STATUSES,
} from "@diasporale/domain"
import { BELL_ACTOR_LED_KINDS, BELL_SYSTEM_KINDS, COMMUNITY_TABS } from "@diasporale/features"
import {
  ASSOCIATION_TYPES,
  CLASSIFIED_CATEGORIES,
  COMPANY_SECTORS,
  ERROR_CODES,
  EVENT_CATEGORIES,
  INVITE_OUTCOMES,
  JOB_CONTRACTS,
  MENTOR_DOMAINS,
  REACTION_KINDS,
  REPORT_REASONS,
} from "@diasporale/features/data"
import { DEMO_IDN_IDENTITIES } from "@diasporale/features/demo"
import { SUPPORTED_LOCALES } from "@diasporale/features/i18n"
import { describe, expect, it } from "vitest"

import { productSources, readLocale } from "./sources"

/**
 * Cliquet i18n — chaque clé citée existe, chaque clé existante sert.
 *
 *  · une clé citée en toutes lettres (`t("…")`, tableau, objet, ternaire)
 *    doit exister dans la locale ;
 *  · les familles dynamiques (`t(\`feed.scope.${scope}\`)`) sont énumérées
 *    depuis les constantes du domaine : chaque membre doit exister ;
 *  · les codes d'erreur sont FERMÉS (`ERROR_CODES`) : chaque code a sa phrase,
 *    et aucune phrase d'erreur n'est orpheline ;
 *  · aucune clé de la locale n'est morte.
 * La parité fr / en est tenue par `locales.test.ts` du paquet.
 */

type Tree = { readonly [key: string]: string | Tree }
function flatten(tree: Tree, prefix = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === "string" ? [path] : flatten(value, path)
  })
}

const KEYS = new Set(flatten(readLocale("fr") as Tree))
const NAMESPACES = new Set([...KEYS].map((key) => key.split(".")[0]))
const exists = (key: string) => KEYS.has(key) || KEYS.has(`${key}_one`)
/** Une base de clés (`legal.notice`, complétée à l'exécution) : au moins une clé sous elle. */
const isBase = (key: string) => [...KEYS].some((candidate) => candidate.startsWith(`${key}.`))

const sources = productSources([".ts", ".tsx"])
const code = sources.map((file) => file.text).join("\n")

/** Toute chaîne littérale qui a la forme d'une clé d'un espace connu. */
const literalKeys = new Set(
  [...code.matchAll(/["'`]([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)["'`]/g)]
    .map((match) => match[1]!)
    .filter((candidate) => NAMESPACES.has(candidate.split(".")[0]!)),
)

const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1)
const each = <T extends string>(values: readonly T[], keys: (value: T) => string[]) => values.flatMap(keys)

/** Les familles dynamiques, énumérées depuis les constantes qui les pilotent. */
const FAMILIES: string[] = [
  ...each(SUPPORTED_LOCALES, (locale) => [`preferences.locale.${locale}`]),
  ...each(["light", "dark", "system"] as const, (theme) => [`preferences.themeOption.${theme}`]),
  ...each(DEMO_IDN_IDENTITIES.map((identity) => identity.key), (preset) => [`idn.preset.${preset}`]),
  ...each(["email", "phone"] as const, (kind) => [`code.kind.${kind}`]),
  ...range(3).flatMap((step) => [`welcome.step${step}Title`, `welcome.step${step}Lead`]),
  ...each(CONSENT_PURPOSES, (purpose) => [`consentPurpose.${purpose}.title`, `consentPurpose.${purpose}.body`]),
  ...each(MEMBERSHIP_STATUSES, (status) => [`membership.status.${status}`]),
  ...each(["r1", "r2", "r3"] as const, (scenario) => [`demo.scenario.${scenario}.title`, ...range(4).map((step) => `demo.scenario.${scenario}.step${step}`)]),
  ...each(FEED_SCOPES, (scope) => [`feed.scope.${scope}`, `feed.scopeHint.${scope}`, `feed.empty.${scope}.title`, `feed.empty.${scope}.body`]),
  ...each(REACTION_KINDS, (kind) => [`post.reaction.${kind}`]),
  ...each(EVENT_CATEGORIES, (category) => [`event.category.${category}`]),
  ...each(ASSOCIATION_TYPES, (type) => [`association.type.${type}`]),
  ...each(COMPANY_SECTORS, (sector) => [`company.sector.${sector}`]),
  ...each(JOB_CONTRACTS, (contract) => [`job.contract.${contract}`]),
  ...each(CLASSIFIED_CATEGORIES, (category) => [`classified.category.${category}`]),
  ...each(MENTOR_DOMAINS, (domain) => [`mentor.domain.${domain}`]),
  ...each(COMMUNITY_TABS, (tab) => [`hub.tab.${tab}`]),
  ...each(BELL_ACTOR_LED_KINDS, (kind) => [`bell.kind.${kind}`]),
  ...each(BELL_SYSTEM_KINDS, (kind) => [`bell.system.${kind}`]),
  ...each(INVITE_OUTCOMES, (outcome) => [`bell.outcome.${outcome}`]),
  ...each(REPORT_REASONS, (reason) => [`report.reason.${reason}`]),
  ...each(FACET_FIELDS, (field) => [`facet.field.${field}`]),
  ...each(FIELD_VISIBILITY_LEVELS, (level) => [`facet.visibility.${level}`]),
  ...each(DIRECTORY_VISIBILITY_LEVELS, (level) => [`settings.directoryLevel.${level}`]),
  ...each(["notice", "privacy"] as const, (kind) => [
    `legal.${kind}.title`,
    ...range(4).flatMap((section) => [`legal.${kind}.section${section}.title`, `legal.${kind}.section${section}.body`]),
  ]),
  ...[...ERROR_CODES].map((errorCode) => `errors.${errorCode}`),
]

describe("cliquet i18n — clés", () => {
  it("chaque clé citée dans les sources existe dans la locale", () => {
    expect([...literalKeys].filter((key) => !exists(key) && !isBase(key)).sort()).toEqual([])
  })

  it("chaque membre des familles dynamiques existe", () => {
    expect(FAMILIES.filter((key) => !exists(key))).toEqual([])
  })

  it("aucune phrase d'erreur n'est orpheline d'un code fermé", () => {
    const orphans = [...KEYS].filter((key) => key.startsWith("errors.") && !ERROR_CODES.has(key.slice("errors.".length) as never))
    expect(orphans).toEqual([])
  })

  it("les codes posés par les formulaires appartiennent aux codes fermés", () => {
    const formCodes = [
      ...code.matchAll(/\.(?:min|max|length|regex|refine|email)\((?:[^()]|\([^()]*\))*,\s*"([a-z][a-z0-9_]*)"\s*\)/g),
      ...code.matchAll(/\bmessage:\s*(?:[^,}]*\?\s*)?"([a-z][a-z0-9_]*)"/g),
      ...code.matchAll(/\bset[A-Z]?\w*Error\(\s*"([a-z][a-z0-9_]*)"\s*\)/g),
    ].map((match) => match[1]!)
    expect(formCodes.length).toBeGreaterThan(5)
    expect([...new Set(formCodes)].filter((formCode) => !ERROR_CODES.has(formCode as never))).toEqual([])
  })

  it("aucune clé de la locale n'est morte", () => {
    const covered = new Set([...literalKeys, ...FAMILIES])
    const dead = [...KEYS].filter((key) => !covered.has(key) && !covered.has(key.replace(/_(one|other)$/, "")))
    expect(dead).toEqual([])
  })
})
