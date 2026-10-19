import { DIASPORALE_NETWORK_SLUG } from "@diasporale/domain"
import { describe, expect, it } from "vitest"

import { ICOM_DEMO, resolveIcomState } from "./icom-state"

describe("resolveIcomState — iCom pour une session (PD7)", () => {
  it("la démonstration est l'état par défaut : fermé, raison « demo »", () => {
    expect(ICOM_DEMO).toEqual({ status: "off", reason: "demo" })
  })

  it("en cours tant que la session n'est pas résolue, quel que soit le reste", () => {
    expect(resolveIcomState({ sessionReady: false, personId: null, networkId: undefined })).toEqual({ status: "loading" })
    expect(resolveIcomState({ sessionReady: false, personId: "p1", networkId: "n1" })).toEqual({ status: "loading" })
  })

  it("fermé pour qui ne peut pas écrire, sans attendre le réseau", () => {
    expect(resolveIcomState({ sessionReady: true, personId: null, networkId: undefined })).toEqual({ status: "off", reason: "not_allowed" })
    expect(resolveIcomState({ sessionReady: true, personId: null, networkId: "n1" })).toEqual({ status: "off", reason: "not_allowed" })
  })

  it("en cours pendant la lecture du réseau, introuvable s'il n'existe pas", () => {
    expect(resolveIcomState({ sessionReady: true, personId: "p1", networkId: undefined })).toEqual({ status: "loading" })
    expect(resolveIcomState({ sessionReady: true, personId: "p1", networkId: null })).toEqual({ status: "off", reason: "unavailable" })
  })

  it("ouvert sur le réseau DIASPORALE, au nom de la personne qui écrit", () => {
    expect(resolveIcomState({ sessionReady: true, personId: "p1", networkId: "n1" })).toEqual({
      status: "on",
      network: { networkId: "n1", slug: DIASPORALE_NETWORK_SLUG, personId: "p1" },
    })
  })
})
