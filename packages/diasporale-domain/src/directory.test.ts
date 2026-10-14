import { describe, expect, test } from "bun:test"
import {
  DEFAULT_DIRECTORY_VISIBILITY,
  DIRECTORY_PAGE_SIZE_MAX,
  clampDirectoryPageSize,
  isListedInDirectoryFor,
  type DirectoryTarget,
  type DirectoryViewer,
} from "./directory"

const TARGET: DirectoryTarget = { status: "declaree", visibility: "country", consentActive: true, country: "FR" }
const VIEWER: DirectoryViewer = { status: "verifiee", country: "FR", isSelf: false, blockedWithTarget: false }

describe("annuaire opt-in", () => {
  test("masqué par défaut", () => {
    expect(DEFAULT_DIRECTORY_VISIBILITY).toBe("hidden")
    expect(isListedInDirectoryFor({ ...TARGET, visibility: "hidden" }, VIEWER)).toBe(false)
  })

  test("niveau pays : les membres du même pays seulement", () => {
    expect(isListedInDirectoryFor(TARGET, VIEWER)).toBe(true)
    expect(isListedInDirectoryFor(TARGET, { ...VIEWER, country: "BE" })).toBe(false)
  })

  test("niveau réseau : tout membre actif", () => {
    expect(isListedInDirectoryFor({ ...TARGET, visibility: "network" }, { ...VIEWER, country: "CA" })).toBe(true)
  })

  test("sans consentement en vigueur, jamais", () => {
    expect(isListedInDirectoryFor({ ...TARGET, visibility: "network", consentActive: false }, VIEWER)).toBe(false)
  })

  test("un membre en attente ne figure pas et ne consulte pas", () => {
    expect(isListedInDirectoryFor({ ...TARGET, status: "en_attente" }, VIEWER)).toBe(false)
    expect(isListedInDirectoryFor(TARGET, { ...VIEWER, status: "en_attente" })).toBe(false)
  })

  test("suspendus et partis : ni l'un ni l'autre", () => {
    expect(isListedInDirectoryFor({ ...TARGET, status: "suspendue" }, VIEWER)).toBe(false)
    expect(isListedInDirectoryFor(TARGET, { ...VIEWER, status: "partie" })).toBe(false)
  })

  test("le blocage ferme l'annuaire dans les deux sens", () => {
    expect(isListedInDirectoryFor({ ...TARGET, visibility: "network" }, { ...VIEWER, blockedWithTarget: true })).toBe(false)
  })

  test("soi-même : visible si l'on a choisi un niveau et consenti", () => {
    const self = { ...VIEWER, isSelf: true, status: "en_attente" as const }
    expect(isListedInDirectoryFor(TARGET, self)).toBe(true)
    expect(isListedInDirectoryFor({ ...TARGET, visibility: "hidden" }, self)).toBe(false)
    expect(isListedInDirectoryFor({ ...TARGET, consentActive: false }, self)).toBe(false)
  })
})

describe("pagination stricte (anti-extraction)", () => {
  test("bornée entre 1 et la borne", () => {
    expect(clampDirectoryPageSize(5)).toBe(5)
    expect(clampDirectoryPageSize(500)).toBe(DIRECTORY_PAGE_SIZE_MAX)
    expect(clampDirectoryPageSize(0)).toBe(1)
    expect(clampDirectoryPageSize(-3)).toBe(1)
    expect(clampDirectoryPageSize(7.8)).toBe(7)
    expect(clampDirectoryPageSize(Number.NaN)).toBe(DIRECTORY_PAGE_SIZE_MAX)
    expect(clampDirectoryPageSize(Number.POSITIVE_INFINITY)).toBe(DIRECTORY_PAGE_SIZE_MAX)
  })
})
