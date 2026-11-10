import { describe, expect, test } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { buildReleasePlan } from "./release.mjs"
import { DIASPORALE_ROOT, SHARED_VARIABLE_NAMES, targetVariableNames } from "./release-lib.mjs"

/**
 * Les documents de publication restent vrais (mêmes variables, mêmes étapes que les
 * scripts) et le dépôt public ne reçoit aucun identifiant : ni projet, ni équipe, ni
 * déploiement, ni nom de backend, ni chemin personnel. Les motifs sont assemblés en
 * morceaux pour que ce fichier ne se signale pas lui-même.
 */
const IDENTIFIER_PATTERNS = [
  ["identifiant de projet d'hébergement", new RegExp(["\\bprj", "_[A-Za-z0-9]{10,}"].join(""))],
  ["identifiant d'équipe d'hébergement", new RegExp(["\\bteam", "_[A-Za-z0-9]{10,}"].join(""))],
  ["identifiant de déploiement", new RegExp(["\\bdpl", "_[A-Za-z0-9]{10,}"].join(""))],
  ["adresse de déploiement de l'hébergeur", new RegExp(["[a-z0-9-]+\\.vercel", "\\.app"].join(""))],
  ["nom de déploiement du backend (adjectif-animal-nombre)", new RegExp(["\\b[a-z]{3,}-[a-z]{3,}", "-\\d{3}\\b"].join(""))],
  ["chemin personnel", new RegExp(["/Users", "/[A-Za-z]"].join(""))],
]

const read = (path) => readFileSync(join(DIASPORALE_ROOT, path), "utf8")
const scriptFiles = () => readdirSync(join(DIASPORALE_ROOT, "scripts")).filter((name) => name.endsWith(".mjs")).map((name) => `scripts/${name}`)
const PUBLICATION_DOC = "docs/37_PUBLICATION_ET_RETOUR_ARRIERE.md"

describe("aucun identifiant dans le dépôt public", () => {
  test("ni les scripts, ni leurs tests, ni le document de publication", () => {
    const findings = []
    for (const path of [...scriptFiles(), PUBLICATION_DOC]) {
      read(path)
        .split("\n")
        .forEach((line, index) => {
          for (const [label, pattern] of IDENTIFIER_PATTERNS) if (pattern.test(line)) findings.push(`${path}:${index + 1} — ${label}`)
        })
    }
    expect(findings).toEqual([])
  })

  test("les motifs attrapent bien ce qu'ils visent", () => {
    const samples = ["prj" + "_AbCdEfGhIjKl", "team" + "_AbCdEfGhIjKl", "dpl" + "_AbCdEfGhIjKl", "site-x.vercel" + ".app", "vivid-otter" + "-123", "/Users" + "/quelquun"]
    samples.forEach((sample, index) => expect(IDENTIFIER_PATTERNS[index][1].test(sample)).toBe(true))
    expect(IDENTIFIER_PATTERNS.some(([, pattern]) => pattern.test("diasporale-111111111111-antsia-222222222222-demo"))).toBe(false)
  })
})

describe("le document de publication dit ce que font les scripts", () => {
  const doc = read(PUBLICATION_DOC)

  test("chaque variable de la machine y est nommée, pour les deux cibles", () => {
    for (const name of Object.values(targetVariableNames("demo"))) expect(doc).toContain(name.replace("DIASPORALE_DEMO_", "DIASPORALE_<CIBLE>_"))
    for (const name of Object.values(SHARED_VARIABLE_NAMES)) expect(doc).toContain(name)
  })

  test("chaque script y figure, avec sa commande", () => {
    for (const path of scriptFiles().filter((file) => !file.endsWith(".test.mjs"))) expect(doc).toContain(path)
    expect(doc).toContain("node scripts/release.mjs --target demo --antsia")
    expect(doc).toContain("node scripts/release-check.mjs --target demo --version")
    expect(doc).toContain("node scripts/rollback.mjs --target demo --to")
  })

  test("le tableau des étapes a autant de lignes que le plan, dans l'ordre", () => {
    const section = doc.slice(doc.indexOf("### 4.2"), doc.indexOf("### 4.3"))
    const rows = section.split("\n").map((line) => /^\| (\d+) \|/.exec(line)?.[1]).filter(Boolean).map(Number)
    const steps = buildReleasePlan({ target: "demo", antsia: { commit: "a".repeat(40), tree: "b".repeat(40) }, diasporale: { commit: "d".repeat(40), tree: "e".repeat(40) } }).steps
    expect(rows).toEqual(steps.map((_, index) => index + 1))
  })

  test("la porte y est écrite : accord écrit, quatre points, aucune option qui la contourne", () => {
    expect(doc).toContain("l'accord écrit et")
    for (const point of ["commit de chaque dépôt", "cible", "ordre", "retour arrière"]) expect(doc).toContain(point)
    expect(doc).toContain("Aucune option\nne contourne la porte")
  })
})
