/**
 * Détecteur PUR du cliquet « aucun identifiant de déploiement » (lot LX-06) :
 * le dépôt est public, il ne dit ni où ni sous quel nom le service est déployé.
 * Il refuse les FORMES d'identifiants d'hébergeur, de projet, d'équipe et de
 * déploiement, les noms de déploiement de backend, les adresses de
 * déploiement réelles, les valeurs de variables et de clés, les adresses
 * électroniques personnelles.
 *
 * Ce fichier ne contient AUCUN identifiant réel : seulement des expressions
 * régulières. Ses tests n'emploient que des exemples fabriqués.
 *
 * Pour citer un exemple dans un document, écrire une forme que le cliquet
 * reconnaît comme gabarit : `<nom>`, `$VARIABLE`, `${VARIABLE}`, `*`, ou un
 * libellé `exemple` / `example` (`https://exemple.vercel.app`,
 * `contact@organisation.example`). Les adresses de rôle (`contact@`,
 * `support@`, `dpo@`, `noreply@`…) ne sont pas personnelles et passent.
 *
 * Un défaut se signale par son fichier, sa ligne et sa nature, JAMAIS par sa
 * valeur : le journal d'une vérification ne doit pas republier ce qu'il refuse.
 */

export type IdentifierRuleId =
  | "hosted-address"
  | "console-address"
  | "deployment-id"
  | "backend-deployment-name"
  | "named-hosting-project"
  | "cli-scope"
  | "registry-path"
  | "cloud-project-path"
  | "service-account"
  | "secret-value"
  | "variable-value"
  | "personal-email"

export interface IdentifierFinding {
  readonly line: number
  readonly rule: IdentifierRuleId
  readonly reason: string
}

interface IdentifierRule {
  readonly id: IdentifierRuleId
  readonly reason: string
  readonly pattern: RegExp
}

/** Un libellé fabriqué (`exemple`, `example`) fait d'une adresse un gabarit. */
const FABRICATED_LABEL = /(?:^|[.-])(?:exemple|example)(?:[.-]|$)/i

/**
 * Le backend n'a pas de nom choisi : son adresse porte toujours le nom généré
 * (mot-mot-nombre). Une adresse de backend d'une autre forme est fabriquée.
 */
const BACKEND_HOSTING_SUFFIXES = /^(?:convex\.cloud|convex\.site)$/i
const GENERATED_BACKEND_LABEL = /(?:^|\.)[a-z]+-[a-z]+-\d+\.$/i

const HOSTING_SUFFIXES =
  "vercel\\.app|convex\\.cloud|convex\\.site|run\\.app|web\\.app|firebaseapp\\.com|firebaseio\\.com|netlify\\.app|fly\\.dev|onrender\\.com|railway\\.app|supabase\\.co|herokuapp\\.com|pages\\.dev|workers\\.dev|appspot\\.com|cloudfunctions\\.net|azurewebsites\\.net|amplifyapp\\.com|ngrok-free\\.app|ngrok\\.app|ngrok\\.io"

/** Pages publiques de l'hébergeur (documentation, tarifs…), qui ne nomment ni équipe ni projet. */
const VERCEL_PUBLIC_PAGES =
  "docs|guides|blog|templates|new|pricing|changelog|legal|kb|help|support|login|signup|cli|integrations|marketplace|home|features|solutions|contact|enterprise|customers|academy|font|geist|design|ai|v0|security|careers|about|partners|events|resources|frameworks|products|storage|analytics"

const HOSTERS = "Vercel|Convex|Firebase|GCP|Google\\s+Cloud|Cloud\\s+Run|Netlify|Render|Railway|Supabase|Cloudflare|Fly(?:\\.io)?"

/** Un nom cité après un hébergeur : entre guillemets, ou nu s'il a la forme d'un identifiant (tiret ou chiffre). */
const NAMED_VALUE = "\\s*:?\\s*(?:[`\"'«]\\s?(?![<$*{])[a-z0-9][\\w.-]*[`\"'»]|(?=[\\w.]*[-\\d])[a-z][\\w.-]*[a-z0-9])"

export const DEPLOYMENT_IDENTIFIER_RULES: readonly IdentifierRule[] = [
  {
    id: "hosted-address",
    reason: "adresse d'un déploiement chez un hébergeur",
    pattern: new RegExp(`(?<![\\w.-])((?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+)(${HOSTING_SUFFIXES})\\b`, "gi"),
  },
  {
    id: "console-address",
    reason: "adresse de console qui nomme une équipe, un projet ou un déploiement",
    pattern: new RegExp(
      `\\bvercel\\.com\\/(?!(?:${VERCEL_PUBLIC_PAGES})\\b)[\\w-]+\\/[\\w-]+|\\bdashboard\\.convex\\.dev\\/[tdp]\\/[\\w-]+|\\bconsole\\.cloud\\.google\\.com\\/\\S*?[?&]project=[\\w-]+|\\bconsole\\.firebase\\.google\\.com\\/(?:u\\/\\d+\\/)?project\\/[\\w-]+`,
      "gi",
    ),
  },
  {
    id: "deployment-id",
    reason: "identifiant de projet, d'équipe ou de déploiement d'hébergeur",
    pattern: /\b(?:prj|team|dpl|icfg|oac)_[A-Za-z0-9]{16,}\b/g,
  },
  {
    // Forme des noms de déploiement de backend : mot-mot-nombre à trois chiffres,
    // pris comme un mot entier (ni nom de fichier `capture-fil-390.jpg`, ni date).
    id: "backend-deployment-name",
    reason: "nom de déploiement de backend",
    pattern: /(?<![\w./-])[a-z]{3,}-[a-z]{3,}-\d{3}(?![\w-]|\.\w)/g,
  },
  {
    id: "named-hosting-project",
    reason: "projet, équipe ou déploiement nommé chez un hébergeur",
    pattern: new RegExp(
      `(?<![\\p{L}\\d])(?:projet|project|équipe|team|organisation|organization|compte|account|déploiement|deployment|service|backend)\\s+(?:${HOSTERS})${NAMED_VALUE}|(?<![\\p{L}\\d])(?:${HOSTERS})\\s+(?:project|team|deployment|projet|équipe|déploiement)${NAMED_VALUE}`,
      "giu",
    ),
  },
  {
    id: "cli-scope",
    reason: "équipe, projet ou organisation passés en clair à une commande",
    pattern: /--(?:scope|team|project|project-id|org)(?:=|\s+)["']?(?![<$*{])(?=[\w.]*[-\d])[a-z0-9][\w.-]*[a-z0-9]/gi,
  },
  {
    id: "registry-path",
    reason: "chemin de registre d'images qui nomme un projet",
    pattern: /\b(?:[a-z0-9-]+-docker\.pkg\.dev|(?:[a-z]+\.)?gcr\.io)\/(?![<$*{])[a-z][a-z0-9-]{4,}/gi,
  },
  {
    id: "cloud-project-path",
    reason: "chemin de ressource qui nomme un projet d'hébergeur",
    pattern:
      /\bprojects\/(?![<$*{])[a-z][a-z0-9-]{4,28}[a-z0-9]\/(?:locations|services|secrets|serviceAccounts|databases|topics|subscriptions|instances|buckets|global|zones|regions)\b|\bprojects\/\d{6,}\b/g,
  },
  {
    id: "service-account",
    reason: "compte de service d'hébergeur",
    pattern: /\b[\w.-]+@[\w-]+\.iam\.gserviceaccount\.com\b|\b\d{6,}-compute@developer\.gserviceaccount\.com\b/gi,
  },
  {
    id: "secret-value",
    reason: "valeur de clé ou de secret",
    pattern:
      /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{10,}|\bAIza[0-9A-Za-z_-]{30,}|\bghp_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bxox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:prod|dev|preview|project):[a-z0-9-]+\|[A-Za-z0-9+/=]{20,}|\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9]{12,}/g,
  },
  {
    // Le NOM d'une variable se cite librement ; sa valeur, jamais.
    id: "variable-value",
    reason: "valeur d'une variable de déploiement",
    // Une valeur a la forme d'une adresse, d'un nom de déploiement, d'un identifiant
    // ou d'un numéro ; une expression de code (`envRef(…)`, `process.env.X`) n'en est pas une.
    pattern:
      /\b(?:CONVEX_DEPLOYMENT|CONVEX_DEPLOY_KEY|CONVEX_URL|CONVEX_SITE_URL|NEXT_PUBLIC_CONVEX_URL|NEXT_PUBLIC_CONVEX_SITE_URL|VERCEL_(?:ORG|PROJECT|TEAM)_ID|GCP_PROJECT(?:_ID)?|GOOGLE_CLOUD_PROJECT|FIREBASE_PROJECT_ID)\s*[=:]\s*["'`]?(?:[a-z][a-z0-9+.-]*:\/\/[^\s"'`]+|(?:dev|prod|preview|project):[\w|-]+|[a-z0-9]+(?:-[a-z0-9]+)+|(?:prj|team)_[A-Za-z0-9]+|\d{6,})(?=["'`\s,;)}\]]|$)/g,
  },
]

const EMAIL = /(?<![\w.+-])([\w.+-]+)@((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,})(?![\w-])/g

/** Parties locales d'une adresse de rôle (une fonction, pas une personne). */
const ROLE_LOCAL_PARTS = new Set([
  "contact",
  "support",
  "assistance",
  "aide",
  "help",
  "dpo",
  "privacy",
  "confidentialite",
  "rgpd",
  "gdpr",
  "legal",
  "juridique",
  "noreply",
  "no-reply",
  "ne-pas-repondre",
  "bonjour",
  "hello",
  "info",
  "infos",
  "presse",
  "press",
  "security",
  "securite",
  "abuse",
  "moderation",
  "signalement",
  "webmaster",
  "postmaster",
  "hostmaster",
  "git",
])

/** Domaines réservés aux exemples (RFC 2606) et leurs équivalents français. */
const FABRICATED_DOMAIN = /(?:^|\.)(?:example|exemple)\.[a-z]+$|\.(?:test|invalid|example|localhost)$|^localhost$/i

function personalEmails(line: string): boolean {
  for (const match of line.matchAll(EMAIL)) {
    const local = (match[1] ?? "").toLowerCase()
    const domain = match[2] ?? ""
    if (/\.iam\.gserviceaccount\.com$|^developer\.gserviceaccount\.com$/i.test(domain)) continue
    if (FABRICATED_DOMAIN.test(domain) || ROLE_LOCAL_PARTS.has(local)) continue
    return true
  }
  return false
}

function ruleMatches(rule: IdentifierRule, line: string): boolean {
  for (const match of line.matchAll(rule.pattern)) {
    if (rule.id === "hosted-address") {
      const labels = match[1] ?? ""
      if (FABRICATED_LABEL.test(labels)) continue
      if (BACKEND_HOSTING_SUFFIXES.test(match[2] ?? "") && !GENERATED_BACKEND_LABEL.test(labels)) continue
    }
    if (rule.id === "backend-deployment-name" && FABRICATED_LABEL.test(match[0])) continue
    return true
  }
  return false
}

/** Les identifiants d'un texte, ligne par ligne, sans jamais rendre la valeur trouvée. */
export function detectDeploymentIdentifiers(text: string): IdentifierFinding[] {
  const findings: IdentifierFinding[] = []
  text.split("\n").forEach((line, index) => {
    for (const rule of DEPLOYMENT_IDENTIFIER_RULES) {
      if (ruleMatches(rule, line)) findings.push({ line: index + 1, rule: rule.id, reason: rule.reason })
    }
    if (personalEmails(line)) {
      findings.push({ line: index + 1, rule: "personal-email", reason: "adresse électronique personnelle" })
    }
  })
  return findings
}
