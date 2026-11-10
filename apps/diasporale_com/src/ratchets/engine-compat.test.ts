import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { REPO_ROOT } from "./sources"

/**
 * Le couple de versions vérifié (lot LX-06) : `engine-compat.json`, à la racine,
 * dit quel commit de DIASPORALE et quel commit du moteur ont passé ENSEMBLE la
 * vérification commune. Une modification du moteur peut casser DIASPORALE sans
 * qu'aucun contrôle ne le dise : ce fichier donne le dernier point sûr, et sa
 * preuve. Ce cliquet ne relance rien ; il garde le fichier lisible et adossé à
 * un rapport qui cite les deux commits.
 */
const FIELDS = ["description", "verifiedOn", "diasporaleCommit", "antsiaCommit", "command", "result", "evidence"] as const
const COMMIT = /^[0-9a-f]{7,40}$/
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Les défauts d'un enregistrement ; `readEvidence` rend le texte du rapport cité, ou `undefined` s'il manque. */
function engineCompatProblems(record: unknown, readEvidence: (path: string) => string | undefined, today: Date): string[] {
  if (!record || typeof record !== "object" || Array.isArray(record)) return ["le fichier doit être un objet JSON"]
  const value = record as Record<string, unknown>
  const problems: string[] = []
  const keys = Object.keys(value).sort()
  if (keys.join(",") !== [...FIELDS].sort().join(",")) problems.push(`champs attendus : ${FIELDS.join(", ")}`)
  const text = (key: (typeof FIELDS)[number]) => (typeof value[key] === "string" ? (value[key] as string) : "")
  for (const key of ["diasporaleCommit", "antsiaCommit"] as const) {
    if (!COMMIT.test(text(key))) problems.push(`${key} : un commit abrégé ou complet, en hexadécimal minuscule`)
  }
  const day = text("verifiedOn")
  const date = new Date(`${day}T00:00:00Z`)
  if (!ISO_DAY.test(day) || Number.isNaN(date.getTime())) problems.push("verifiedOn : une date AAAA-MM-JJ")
  else if (date.getTime() > today.getTime()) problems.push("verifiedOn : une vérification ne se date pas dans le futur")
  if (!text("command").includes("verify")) problems.push("command : la commande de la vérification commune")
  if (text("result") !== "green") problems.push("result : seul un couple vérifié vert s'écrit ici")
  if (text("description").length < 40) problems.push("description : dire ce que le fichier garde et qui le met à jour")
  const evidence = text("evidence")
  if (!evidence.startsWith("docs/")) problems.push("evidence : un rapport du dossier docs/")
  else {
    const report = readEvidence(evidence)
    if (report === undefined) problems.push(`evidence : ${evidence} introuvable`)
    else {
      for (const key of ["diasporaleCommit", "antsiaCommit"] as const) {
        if (COMMIT.test(text(key)) && !report.includes(text(key).slice(0, 7))) problems.push(`evidence : le rapport ne cite pas ${key}`)
      }
    }
  }
  return problems
}

const readRepoEvidence = (path: string) => {
  const full = join(REPO_ROOT, path)
  return existsSync(full) ? readFileSync(full, "utf8") : undefined
}

describe("couple de versions vérifié — engine-compat.json", () => {
  it("le fichier est complet et adossé à un rapport qui cite les deux commits", () => {
    const record = JSON.parse(readFileSync(join(REPO_ROOT, "engine-compat.json"), "utf8")) as unknown
    expect(engineCompatProblems(record, readRepoEvidence, new Date())).toEqual([])
  })

  it("test du test : un couple non vérifié, mal daté ou sans preuve est refusé", () => {
    const record = {
      description: "Couple fabriqué pour le test du cliquet, jamais vérifié ensemble.",
      verifiedOn: "2999-01-01",
      diasporaleCommit: "PAS-UN-COMMIT",
      antsiaCommit: "abc1234",
      command: "bun run test",
      result: "red",
      evidence: "docs/recette/rapport-fictif.md",
    }
    expect(engineCompatProblems(record, () => undefined, new Date("2026-11-10T12:00:00Z"))).toEqual([
      "diasporaleCommit : un commit abrégé ou complet, en hexadécimal minuscule",
      "verifiedOn : une vérification ne se date pas dans le futur",
      "command : la commande de la vérification commune",
      "result : seul un couple vérifié vert s'écrit ici",
      "evidence : docs/recette/rapport-fictif.md introuvable",
    ])
  })

  it("test du test : un rapport qui ne cite pas le commit du moteur est refusé, un rapport complet passe", () => {
    const record = {
      description: "Couple fabriqué pour le test du cliquet : deux commits fictifs et leur rapport.",
      verifiedOn: "2026-11-01",
      diasporaleCommit: "1111111",
      antsiaCommit: "2222222",
      command: "bun run --cwd ../ANTSIA verify",
      result: "green",
      evidence: "docs/recette/rapport-fictif.md",
    }
    const today = new Date("2026-11-10T12:00:00Z")
    expect(engineCompatProblems(record, () => "DIASPORALE `1111111` seulement", today)).toEqual(["evidence : le rapport ne cite pas antsiaCommit"])
    expect(engineCompatProblems(record, () => "ANTSIA `2222222`, DIASPORALE `1111111`", today)).toEqual([])
  })
})
