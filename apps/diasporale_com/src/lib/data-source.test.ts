import { describe, expect, it } from "vitest"

import { parseDataSource, resolveDataSource } from "./data-source"

describe("source de données", () => {
  it("ne reconnaît que « engine » et « demo », à la lettre", () => {
    expect(parseDataSource("engine")).toBe("engine")
    expect(parseDataSource("demo")).toBe("demo")
    for (const raw of [undefined, "", "Engine", "DEMO", " engine", "moteur"]) expect(parseDataSource(raw), String(raw)).toBeNull()
  })

  it("sert la démonstration sans déclaration (développement : toute construction déclare, garde de construction)", () => {
    expect(resolveDataSource(undefined)).toBe("demo")
    expect(resolveDataSource("Engine")).toBe("demo")
    expect(resolveDataSource("engine")).toBe("engine")
  })
})
