// @vitest-environment node
import { getFixedT } from "@diasporale/features/i18n"
import { describe, expect, it } from "vitest"

import {
  CODE_RESEND_DELAY_MS,
  PENDING_CODE_KEY,
  PENDING_CODE_TTL_MS,
  forgetPendingCode,
  peekPendingCode,
  rememberPendingCode,
  resendWaitSeconds,
} from "./pending-code"
import { RETURN_PATH_KEY, type TabStorage } from "./return-path"

/**
 * L'adresse en attente d'un code (EA-08, MO-04) : gardée dans l'onglet, jamais le code, oubliée
 * à l'échéance, relue telle qu'elle a été écrite ou pas du tout ; le délai du renvoi.
 */

const NOW = Date.UTC(2026, 10, 10, 12)

function memoryStorage(): TabStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

describe("l'adresse en attente — dans l'onglet, jamais le code", () => {
  it("survit à un rechargement : relue telle qu'écrite, avec l'heure de l'envoi", () => {
    const storage = memoryStorage()
    rememberPendingCode({ kind: "email", value: "  ada@exemple.test " }, NOW, storage)

    expect(peekPendingCode(NOW + 1000, storage)).toEqual({ destination: { kind: "email", value: "ada@exemple.test" }, sentAt: NOW })
  })

  it("ne garde que le moyen, l'adresse et l'heure, sous une clé que la sortie du moteur purge", () => {
    const storage = memoryStorage()
    rememberPendingCode({ kind: "email", value: "ada@exemple.test" }, NOW, storage)

    expect([...storage.items.keys()]).toEqual([PENDING_CODE_KEY])
    expect(PENDING_CODE_KEY.startsWith("antsia:")).toBe(true)
    expect(JSON.parse(storage.items.get(PENDING_CODE_KEY) ?? "{}")).toEqual({ kind: "email", value: "ada@exemple.test", sentAt: NOW })
    // La page demandée garde sa propre clé : les deux mémoires ne se recouvrent pas.
    expect(PENDING_CODE_KEY).not.toBe(RETURN_PATH_KEY)
  })

  it("passé l'échéance, la porte repart du début", () => {
    const storage = memoryStorage()
    rememberPendingCode({ kind: "email", value: "ada@exemple.test" }, NOW, storage)

    expect(peekPendingCode(NOW + PENDING_CODE_TTL_MS, storage)).not.toBeNull()
    expect(peekPendingCode(NOW + PENDING_CODE_TTL_MS + 1, storage)).toBeNull()
    // Une heure venue du futur (horloge reculée, valeur forgée) n'est pas crue.
    expect(peekPendingCode(NOW - 1, storage)).toBeNull()
  })

  it("une valeur altérée ne reprend rien", () => {
    const storage = memoryStorage()
    for (const raw of [
      "pas du json",
      "null",
      JSON.stringify({ kind: "courrier", value: "ada@exemple.test", sentAt: NOW }),
      JSON.stringify({ kind: "email", value: "", sentAt: NOW }),
      JSON.stringify({ kind: "email", value: "ada@exem\nple.test", sentAt: NOW }),
      JSON.stringify({ kind: "email", value: `${"a".repeat(320)}@exemple.test`, sentAt: NOW }),
      JSON.stringify({ kind: "email", value: 42, sentAt: NOW }),
      JSON.stringify({ kind: "email", value: "ada@exemple.test", sentAt: "maintenant" }),
    ]) {
      storage.items.set(PENDING_CODE_KEY, raw)
      expect(peekPendingCode(NOW, storage), raw).toBeNull()
    }
  })

  it("s'oublie (connexion, sortie, changement d'adresse), et un stockage refusé ne casse rien", () => {
    const storage = memoryStorage()
    rememberPendingCode({ kind: "phone", value: "+33 6 12 34 56 78" }, NOW, storage)
    forgetPendingCode(storage)
    expect(peekPendingCode(NOW, storage)).toBeNull()

    const refused: TabStorage = {
      getItem: () => { throw new Error("refusé") },
      setItem: () => { throw new Error("refusé") },
      removeItem: () => { throw new Error("refusé") },
    }
    expect(rememberPendingCode({ kind: "email", value: "ada@exemple.test" }, NOW, refused)).toEqual({ destination: { kind: "email", value: "ada@exemple.test" }, sentAt: NOW })
    expect(peekPendingCode(NOW, refused)).toBeNull()
    expect(() => forgetPendingCode(refused)).not.toThrow()
    expect(peekPendingCode(NOW, null)).toBeNull()
  })
})

describe("le délai du renvoi", () => {
  it("une minute après chaque envoi, au compte des secondes entières", () => {
    expect(CODE_RESEND_DELAY_MS).toBe(60_000)
    expect(resendWaitSeconds({ sentAt: NOW }, NOW)).toBe(60)
    expect(resendWaitSeconds({ sentAt: NOW }, NOW + 59_001)).toBe(1)
    expect(resendWaitSeconds({ sentAt: NOW }, NOW + 60_000)).toBe(0)
    expect(resendWaitSeconds(null, NOW)).toBe(0)
  })
})

describe("aucun texte ne dit une durée que le moteur ne tient pas", () => {
  it("la porte du code ne cite aucune durée de validité, ni en français ni en anglais", () => {
    for (const locale of ["fr", "en"] as const) {
      const t = getFixedT(locale)
      expect(t("code.lead"), locale).not.toMatch(/\d/)
      expect(t("code.title"), locale).not.toMatch(/\d/)
    }
  })
})
