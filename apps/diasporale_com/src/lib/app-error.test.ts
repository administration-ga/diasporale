import { describe, expect, it } from "vitest"

import { isStaleBuildError } from "./app-error"

function named(name: string, message: string): Error {
  const error = new Error(message)
  error.name = name
  return error
}

describe("isStaleBuildError — une version publiée pendant la visite", () => {
  it.each([
    ["Turbopack", named("ChunkLoadError", "Failed to load chunk /_next/static/chunks/abc.js from module 123")],
    ["webpack, script", named("ChunkLoadError", "Loading chunk 731 failed.\n(error: /_next/static/chunks/731.js)")],
    ["webpack, feuille de style", new Error("Loading CSS chunk 12 failed.\n(missing: /_next/static/css/12.css)")],
    ["Chrome, import dynamique", new TypeError("Failed to fetch dynamically imported module: /_next/static/chunks/x.js")],
    ["Firefox, import dynamique", new TypeError("error loading dynamically imported module: /_next/static/chunks/x.js")],
    ["Safari, import dynamique", new TypeError("Importing a module script failed.")],
    ["nom seul, sans message lisible", named("ChunkLoadError", "")],
  ])("reconnaît %s", (_case, error) => {
    expect(isStaleBuildError(error)).toBe(true)
  })

  it("lit la cause d'une erreur enveloppée", () => {
    expect(isStaleBuildError(new Error("Rendu interrompu", { cause: named("ChunkLoadError", "Failed to load chunk x") }))).toBe(true)
  })

  it.each([
    ["une erreur de rendu ordinaire", new Error("Cannot read properties of undefined (reading 'map')")],
    ["une erreur réseau de lecture", new TypeError("Failed to fetch")],
    ["une valeur qui n'est pas une erreur", "Failed to load chunk"],
    ["null", null],
    ["undefined", undefined],
    ["un objet sans message", { code: 42 }],
  ])("ne confond pas %s avec une nouvelle version", (_case, error) => {
    expect(isStaleBuildError(error)).toBe(false)
  })

  it("ne boucle pas sur une cause qui se cite elle-même", () => {
    const error = new Error("Rendu interrompu") as Error & { cause?: unknown }
    error.cause = error
    expect(isStaleBuildError(error)).toBe(false)
  })
})
