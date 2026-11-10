// Dupliqué de ANTSIA/tests/ratchets/lib/detectors.ts (section public-communication : FORBIDDEN_CLAIMS, GDPR_MENTION, flattenMessages, detectPublicClaims) @ 8e2485a — adaptations : affirmations précises au lieu de mots isolés (« hébergement », « certificat », « agrément », « leader » sont aussi le vocabulaire du logement, des démarches et des associations) ; formes anglaises ; chiffres de communauté (« 12 000 membres », « des milliers de membres ») ; promesses de conformité et de chiffrement de bout en bout ; règles nommées pour des exceptions motivées ; `{{brand}}` lu comme la marque, les autres variables comme des valeurs mesurées ; en-tête de provenance.
/**
 * Détecteur PUR du cliquet « communication publique » de DIASPORALE. Doctrine
 * du programme : aucun chiffre non mesuré, aucun audit, aucune certification,
 * aucun hébergement affirmé, aucune promesse de conformité ni de chiffrement de
 * bout en bout, aucun superlatif ; le RGPD ne se cite que dans les textes
 * légaux relus par un juriste.
 *
 * Il vise des AFFIRMATIONS, pas des mots : « un hébergement d'urgence »,
 * « hébergé chez un proche », « certificat de scolarité », « un groupe compte
 * au plus 256 membres » ou « les messages ne sont pas chiffrés de bout en
 * bout » passent ; « 12 000 membres », « vos données sont hébergées en
 * France » ou « plateforme certifiée » échouent.
 */

/** Une affirmation interdite, nommée pour qu'une exception la vise précisément. */
export type ClaimRuleId =
  | "percentage"
  | "audit"
  | "certification"
  | "hosting"
  | "data-location"
  | "compliance"
  | "end-to-end"
  | "superlative"
  | "community-figure"
  | "gdpr-outside-legal"

export interface PublicClaimFinding {
  /** Clé du texte, en chemin pointé (`landing.title`). */
  readonly key: string
  readonly rule: ClaimRuleId
  readonly reason: string
  /** Début du texte fautif, pour un message d'échec lisible. */
  readonly excerpt: string
}

interface ClaimRule {
  readonly id: ClaimRuleId
  readonly reason: string
  readonly patterns: readonly RegExp[]
  /** Une négation juste avant (« ne sont pas », « not ») retire l'affirmation. */
  readonly negatable?: boolean
}

/** Fin de mot qui tient compte des lettres accentuées (`\\b` ne connaît que l'ASCII). */
const END = "(?![\\p{L}\\d])"

/** Sujets qui désignent le service lui-même ou ce qu'il garde. */
const SERVICE_SUBJECT =
  "(?:plateforme|service|site|application|appli|r[ée]seau|solution|infrastructure|DIASPORALE|serveurs?|donn[ée]es|contenus?|fichiers?|photos?|vid[ée]os?|messages?|comptes?|profils?|platform|network|app|servers?|data|content|files|accounts?|profiles?)"
const SERVICE_ONLY = "(?:plateforme|service|site|application|appli|r[ée]seau|solution|infrastructure|DIASPORALE|platform|network|app|website)"

export const PUBLIC_CLAIM_RULES: readonly ClaimRule[] = [
  {
    id: "percentage",
    reason: "pourcentage en dur (aucun chiffre non mesuré)",
    patterns: [/\d+(?:[.,]\d+)?\s?(?:%|pour\s?cent\b|percent\b)/i],
  },
  {
    // Une AFFIRMATION d'audit, pas la fonction « journal d'audit » d'une console.
    id: "audit",
    reason: "audit affirmé",
    patterns: [
      /\baudit[ée]e?s?(?![\p{L}\d])|\baudited\b/iu,
      /\baudits?\s+(?:de\s+s[ée]curit[ée]|ind[ée]pendants?|externes?|de\s+conformit[ée])/i,
      /\b(?:security|independent|external|third[-\s]party)\s+audits?\b/i,
    ],
  },
  {
    id: "certification",
    reason: "certification, agrément ou homologation affirmés",
    patterns: [
      // Normes de sécurité et de qualité seulement : un code pays ISO 3166 n'affirme rien.
      /\bISO\s?(?:\/\s?IEC\s?)?(?:27\d{3}|9001|14001|22301)\b|\bSecNumCloud\b|\bSOC\s?[12]\b|\bHDS\b|\bPCI[\s-]?DSS\b/,
      new RegExp(`\\b${SERVICE_ONLY}\\s+(?:est\\s+|is\\s+)?(?:certifi[ée]e?|homologu[ée]e?|agr[ée][ée]e?|labellis[ée]e?|certified|accredited)${END}`, "iu"),
      /\b(?:certifi[ée]e?s?|homologu[ée]e?s?|agr[ée][ée]e?s?|labellis[ée]e?s?|certified|accredited|approved)\s+(?:par|by)\s+(?:l['’]\s?|la\s+|le\s+|the\s+)?(?:ANSSI|ARCEP|APDPVP|CNIL|[ée]tat|gouvernement|government|minist[èe]re|ministry|state)\b/i,
      /\bcertification\s+(?:ISO|officielle|de\s+s[ée]curit[ée]|HDS|SecNumCloud)\b|\b(?:officially|fully)\s+certified\b/i,
    ],
  },
  {
    id: "hosting",
    reason: "hébergement affirmé",
    patterns: [
      new RegExp(`\\b${SERVICE_SUBJECT}\\b[^.;:!?]{0,40}?\\bh[ée]berg(?:é|ée|és|ées|ee|ees)${END}`, "iu"),
      /\bh[ée]bergement\s+(?:des\s+donn[ée]es|souverain|s[ée]curis[ée]|certifi[ée]|HDS|local|national|en\s+(?:France|Europe|Afrique)|au\s+Gabon|dans\s+l['’]Union)/i,
      new RegExp(`\\b${SERVICE_SUBJECT}\\b[^.;:!?]{0,40}?\\bhosted\\b`, "i"),
    ],
  },
  {
    id: "data-location",
    reason: "localisation des données affirmée",
    patterns: [
      /\bdonn[ée]es\b[^.;:!?]{0,30}?\b(?:rest(?:ent|e)|stock[ée]es?|conserv[ée]es?|sont|localis[ée]es?|demeurent)\s+(?:au\s+Gabon|en\s+(?:France|Europe|Afrique)|dans\s+l['’]Union\s+europ[ée]enne|sur\s+le\s+(?:sol|territoire)\s+\p{L}+)/iu,
      /\bdata\b[^.;:!?]{0,30}?\b(?:stays?|remains?|stored|kept|resides?|is|are)\s+(?:in|within)\s+(?:Gabon|France|Europe|the\s+EU|the\s+European\s+Union|Africa)\b/i,
    ],
  },
  {
    id: "compliance",
    reason: "promesse de conformité",
    patterns: [
      /\bconformes?\s+(?:au|à\s+la|à\s+l['’]|aux)\s*(?:RGPD|GDPR|APDPVP|CNIL|normes?\s+(?:ISO|de\s+s[ée]curit[ée]|internationales|europ[ée]ennes)|r[èe]glement\s+(?:g[ée]n[ée]ral|europ[ée]en))/i,
      new RegExp(`\\b(?:${SERVICE_ONLY}|nous\\s+sommes)\\s+(?:est\\s+|sont\\s+)?(?:enti[èe]rement\\s+|pleinement\\s+|totalement\\s+)?conformes?\\b`, "i"),
      /\b(?:respecte|respectons)\s+(?:le|la|les)\s+(?:RGPD|GDPR|APDPVP)\b|\ben\s+conformit[ée]\s+avec\s+(?:le|la|l['’])\s*(?:RGPD|GDPR|APDPVP)/i,
      /\b(?:GDPR|RGPD)[\s-]?(?:compliant|conforme|ready|friendly)\b/i,
      /\bcompliant\s+with\s+(?:the\s+)?(?:GDPR|RGPD|APDPVP|ISO|regulations?|data\s+protection)|\b(?:complies|comply)\s+with\s+(?:the\s+)?(?:GDPR|RGPD|APDPVP|regulations?|data\s+protection)/i,
      new RegExp(`\\b(?:${SERVICE_ONLY}|we\\s+are)\\s+(?:is\\s+)?(?:fully\\s+)?compliant\\b`, "i"),
    ],
  },
  {
    // Le propriétaire a refusé cette promesse ; dire qu'il n'y en a pas reste permis.
    id: "end-to-end",
    reason: "chiffrement de bout en bout promis",
    negatable: true,
    patterns: [/\bchiffr(?:[ée]e?s?|ement)\s+de\s+bout\s+en\s+bout\b/i, /\bend[-\s]to[-\s]end(?:\s+|-)encrypt/i, /\bE2EE\b/],
  },
  {
    id: "superlative",
    reason: "superlatif non mesurable",
    patterns: [
      /\binviolable\b|\bunbreakable\b|\br[ée]volutionnaire\b|\brevolutionary\b|\bunique\s+au\s+monde\b|\bfirst\s+of\s+its\s+kind\b/i,
      /\bleader\s+(?:du\s+march[ée]|mondial|incontest[ée]|europ[ée]en|africain|national)|\bmarket\s+leader\b/i,
      /\bnum[ée]ro\s+(?:un|1)\s+(?:du|des|de\s+la|en|mondial)\b|\bn°\s?1\s+(?:du|des|de\s+la|en)\b|\bnumber\s+one\s+(?:platform|network|app|social)\b/i,
      /\b(?:le\s+)?premier\s+r[ée]seau\s+social\b|\bthe\s+first\s+social\s+network\b|\ble\s+plus\s+grand\s+r[ée]seau\b|\bla\s+plus\s+grande\s+communaut[ée]|\bthe\s+(?:largest|biggest)\s+(?:network|community|platform)\b/i,
    ],
  },
]

/** Noms dont un nombre fait une affirmation sur la communauté ou l'activité. */
const COMMUNITY_NOUNS =
  "(?:membres?|members?|utilisateurs?|utilisatrices?|users?|inscrits?|inscrites?|abonn[ée]e?s?|followers?|gabonais(?:es)?|gabonese|personnes?|people|familles?|families|adh[ée]rents?|b[ée]n[ée]voles?|volunteers?|pays|countries|villes|cities|associations?|entreprises?|companies|businesses|professionnels?|professionals?|prestataires?|providers?|talents?|mentors?|t[ée]l[ée]chargements?|downloads?|[ée]toiles?|stars?|avis|reviews?|offres?|offers?|emplois?|jobs?|annonces?|listings?|[ée]v[ée]nements?|[ée]v[èe]nements?|events?|rendez-vous|appointments?|publications?|posts?|messages?|services?)"

/** Un nombre écrit (« 12 000 », « 12,000 », « 1.5 », « 10k », « 2 M ») suivi, à un mot près, d'un nom de communauté. */
const NUMBER_FIGURE = new RegExp(
  `(?<![\\p{L}\\d])(\\d{1,3}(?:[\\s\\u00a0\\u202f.,]\\d{3})+|\\d+(?:[.,]\\d+)?)\\s?(k|K|M|000)?\\s*\\+?\\s+(?:de\\s+|d['’]\\s*|of\\s+)?(?:[\\p{L}-]+\\s+)?${COMMUNITY_NOUNS}${END}`,
  "giu",
)
/** Un ordre de grandeur sans chiffre (« des milliers de membres », « thousands of users »). */
const WORDED_FIGURE = new RegExp(
  `\\b(?:milliers|centaines|millions|dizaines|thousands|hundreds|millions|dozens|tens\\s+of\\s+thousands)\\s+(?:de\\s+|d['’]\\s*|of\\s+)(?:[\\p{L}-]+\\s+)?${COMMUNITY_NOUNS}${END}`,
  "iu",
)
/** Une borne de règle (« au plus 256 membres ») n'est pas une affirmation. */
const LIMIT_BEFORE = /(?:au\s+plus|au\s+maximum|jusqu['’]\s*[àa]|maximum|max\.?|au\s+moins|minimum|limit[ée]e?s?\s+[àa]|up\s+to|at\s+most|at\s+least|no\s+more\s+than|limited\s+to)\s*$/i
/** Une annonce de volume (« plus de », « déjà », « over ») en fait une affirmation, même petite. */
const CLAIM_BEFORE = /(?:plus\s+de|pr[èe]s\s+de|d[ée]j[àa]|over|more\s+than|already|nearly|almost|rejoignez|join)\s*$/i

const NEGATION_BEFORE = /\b(?:ne|n['’]|pas|aucun|aucune|jamais|sans|not|no|never|without|isn['’]t|aren['’]t)\b[^.;:!?]{0,30}$/i

export interface PublicClaimOptions {
  /** Préfixes de clés où le RGPD peut être cité (textes légaux relus par un juriste). */
  readonly legalPrefixes: readonly string[]
  /** Préfixes de clés de la vitrine : tout chiffre de communauté y échoue, même borné ou petit. */
  readonly showcasePrefixes: readonly string[]
}

/** Toutes les feuilles texte d'un arbre de messages, en chemins pointés. */
export function flattenMessages(value: unknown, prefix = ""): { key: string; text: string }[] {
  if (typeof value === "string") return [{ key: prefix, text: value }]
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flattenMessages(child, prefix ? `${prefix}.${key}` : key))
  }
  return []
}

function hasPrefix(key: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => key === prefix || key.startsWith(`${prefix}.`))
}

/** `{{brand}}` est la marque ; toute autre variable est une valeur lue dans le système, donc mesurée. */
export function readableText(text: string): string {
  return text.replace(/\{\{\s*brand\s*\}\}/g, "DIASPORALE").replace(/\{\{[^}]*\}\}/g, "")
}

function communityFigure(text: string, showcase: boolean): boolean {
  if (WORDED_FIGURE.test(text)) return true
  for (const match of text.matchAll(NUMBER_FIGURE)) {
    if (showcase) return true
    const before = text.slice(0, match.index)
    if (LIMIT_BEFORE.test(before)) continue
    const value = Number((match[1] ?? "").replace(/[\s  .,]/g, ""))
    const scaled = match[2] !== undefined || value >= 100
    if (scaled || CLAIM_BEFORE.test(before)) return true
  }
  return false
}

function matchesRule(rule: ClaimRule, text: string): boolean {
  return rule.patterns.some((pattern) => {
    const match = pattern.exec(text)
    if (!match) return false
    if (!rule.negatable) return true
    return !NEGATION_BEFORE.test(text.slice(0, match.index))
  })
}

/** Les affirmations interdites d'un arbre de messages (un fragment de langue). */
export function detectPublicClaims(messages: unknown, options: PublicClaimOptions): PublicClaimFinding[] {
  const findings: PublicClaimFinding[] = []
  for (const { key, text } of flattenMessages(messages)) {
    const readable = readableText(text)
    const report = (rule: ClaimRuleId, reason: string) => findings.push({ key, rule, reason, excerpt: text.slice(0, 80) })
    for (const rule of PUBLIC_CLAIM_RULES) {
      if (matchesRule(rule, readable)) report(rule.id, rule.reason)
    }
    if (communityFigure(readable, hasPrefix(key, options.showcasePrefixes))) {
      report("community-figure", "chiffre de communauté en dur — il doit être lu depuis le système")
    }
    if (!hasPrefix(key, options.legalPrefixes) && /\bRGPD\b|\bGDPR\b/.test(readable)) {
      report("gdpr-outside-legal", "le RGPD n'est cité que dans les textes légaux relus par un juriste")
    }
  }
  return findings
}
