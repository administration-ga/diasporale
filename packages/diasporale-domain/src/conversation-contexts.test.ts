import { describe, expect, it } from "bun:test"

import {
  CONVERSATION_KINDS,
  CONVERSATION_PHASES,
  CONVERSATION_SIDES,
  CONVERSATION_TEXT_REFUSALS,
  CONVERSATION_VOICES,
  CONVERSATION_WRITE_MIN_STATUS,
  conversationTextRefusal,
  jobApplicationConversation,
  lowestStatusWith,
  mentoringConversation,
  serviceRequestConversation,
  type ConversationFacts,
} from "./conversation-contexts"
import { JOB_APPLICATION_STATUSES } from "./jobs"
import { MENTORING_REQUEST_STATUSES } from "./mentoring"
import { SERVICE_REQUEST_STATUSES, serviceTextRefusal } from "./service-requests"

/**
 * CC-3a — toutes les correspondances « état effectif → phase » du §6.2 du contrat
 * CONVERSATION-CONTEXTUELLE-V1, pour les trois natures, et la règle de texte D8.
 */
const NOW = Date.UTC(2026, 9, 19, 12)
const HOUR = 60 * 60 * 1000

const NOT_OPEN: ConversationFacts = { phase: "not_open", callsEngaged: false, responderFirst: false, attachments: { requester: false, responder: false } }
const CLOSED: ConversationFacts = { phase: "closed", callsEngaged: false, responderFirst: false, attachments: { requester: false, responder: false } }
const ENGAGED: ConversationFacts = { phase: "open", callsEngaged: true, responderFirst: false, attachments: { requester: true, responder: true } }
const AWAITING: ConversationFacts = { phase: "open", callsEngaged: false, responderFirst: true, attachments: { requester: true, responder: true } }

describe("conversations contextuelles — valeurs du contrat", () => {
  it("reprend à l'identique les natures, phases, côtés et voix du moteur", () => {
    expect(CONVERSATION_KINDS).toEqual(["diasporaServiceRequest", "diasporaMentoring", "diasporaJobApplication"])
    expect(CONVERSATION_PHASES).toEqual(["not_open", "open", "closed"])
    expect(CONVERSATION_SIDES).toEqual(["requester", "responder"])
    expect(CONVERSATION_VOICES).toEqual(["person", "page"])
    expect(CONVERSATION_TEXT_REFUSALS).toEqual(["context_address_forbidden"])
    for (const code of CONVERSATION_TEXT_REFUSALS) expect(code).toMatch(/^[a-z][a-z0-9_]{1,63}$/)
  })

  it("écrit au statut qui porte la capacité « communiquer » de DIASPORALE", () => {
    expect(lowestStatusWith("communicate")).toBe(CONVERSATION_WRITE_MIN_STATUS)
    expect(CONVERSATION_WRITE_MIN_STATUS).toBe("declaree")
    expect(lowestStatusWith("read_network")).toBe("en_attente")
    expect(lowestStatusWith("sponsor")).toBe("verifiee")
  })
})

describe("demande de service — phase", () => {
  const at = (status: (typeof SERVICE_REQUEST_STATUSES)[number], deadlineAt: number | null = null) => serviceRequestConversation({ status, deadlineAt }, NOW)

  it("envoyée : ouverte, le répondant parle d'abord, aucun appel (D4, D5)", () => {
    expect(at("sent")).toEqual(AWAITING)
    expect(at("sent", NOW + HOUR)).toEqual(AWAITING)
  })

  it("proposée ou confirmée : engagée, appels possibles avec les deux accords", () => {
    expect(at("proposed")).toEqual(ENGAGED)
    expect(at("confirmed")).toEqual(ENGAGED)
  })

  it("réalisée, refusée, annulée, expirée ou absence : fermée", () => {
    for (const status of ["completed", "refused", "cancelled", "expired", "no_show"] as const) expect(at(status)).toEqual(CLOSED)
  })

  it("une échéance passée ferme déjà, avant le passage planifié (état effectif, N17)", () => {
    expect(at("sent", NOW)).toEqual(CLOSED)
    expect(at("proposed", NOW - 1)).toEqual(CLOSED)
    // Un rendez-vous confirmé n'expire jamais faute de réponse.
    expect(at("confirmed", NOW - 1)).toEqual(ENGAGED)
  })

  it("chaque statut de la demande a sa phase", () => {
    for (const status of SERVICE_REQUEST_STATUSES) expect(CONVERSATION_PHASES).toContain(at(status).phase)
  })
})

describe("mentorat — phase", () => {
  const at = (status: (typeof MENTORING_REQUEST_STATUSES)[number], expiresAt = NOW + HOUR, removed = false) => mentoringConversation({ status, expiresAt }, NOW, removed)

  it("acceptée : engagée ; close : fermée", () => {
    expect(at("accepted")).toEqual(ENGAGED)
    expect(at("closed")).toEqual(CLOSED)
  })

  it("envoyée, déclinée, annulée ou expirée : jamais ouverte", () => {
    for (const status of ["sent", "declined", "cancelled", "expired"] as const) expect(at(status)).toEqual(NOT_OPEN)
    // L'échéance d'une demande envoyée ne l'ouvre ni ne la ferme : elle reste « jamais ouverte ».
    expect(at("sent", NOW)).toEqual(NOT_OPEN)
    // Un mentorat accepté n'expire pas.
    expect(at("accepted", NOW - 1)).toEqual(ENGAGED)
  })

  it("retirée par la modération : une conversation ouverte se ferme, une jamais ouverte le reste", () => {
    expect(at("accepted", NOW + HOUR, true)).toEqual(CLOSED)
    expect(at("sent", NOW + HOUR, true)).toEqual(NOT_OPEN)
    expect(at("closed", NOW + HOUR, true)).toEqual(CLOSED)
  })

  it("chaque statut du mentorat a sa phase", () => {
    for (const status of MENTORING_REQUEST_STATUSES) expect(CONVERSATION_PHASES).toContain(at(status).phase)
  })
})

describe("candidature — phase", () => {
  const at = (status: (typeof JOB_APPLICATION_STATUSES)[number], removed = { application: false, offer: false }) => jobApplicationConversation({ status }, removed)

  it("présélectionnée : engagée ; non retenue ou retirée : fermée ; envoyée ou vue : jamais ouverte", () => {
    expect(at("shortlisted")).toEqual(ENGAGED)
    expect(at("not_selected")).toEqual(CLOSED)
    expect(at("withdrawn")).toEqual(CLOSED)
    expect(at("sent")).toEqual(NOT_OPEN)
    expect(at("seen")).toEqual(NOT_OPEN)
  })

  it("la candidature ou son offre retirées par la modération ferment ; une offre close ne ferme rien (D6)", () => {
    expect(at("shortlisted", { application: true, offer: false })).toEqual(CLOSED)
    expect(at("shortlisted", { application: false, offer: true })).toEqual(CLOSED)
    expect(at("seen", { application: false, offer: true })).toEqual(NOT_OPEN)
  })

  it("chaque statut de candidature a sa phase", () => {
    for (const status of JOB_APPLICATION_STATUSES) expect(CONVERSATION_PHASES).toContain(at(status).phase)
  })
})

describe("règle de texte (D8)", () => {
  const addresses = ["Je suis au 12 rue de la Paix, sonnez fort", "3 bis, avenue Foch", "221B Baker Street"]

  it("refuse une adresse exacte en voix de personne, des deux côtés", () => {
    for (const text of addresses) expect(conversationTextRefusal({ text, voice: "person" })).toBe("context_address_forbidden")
  })

  it("admet l'adresse professionnelle en voix de page : le salon, le bureau, le local", () => {
    for (const text of addresses) expect(conversationTextRefusal({ text, voice: "page" })).toBeNull()
  })

  it("permet les coordonnées et le texte ordinaire : la conversation est le canal de contact", () => {
    expect(conversationTextRefusal({ text: "Appelez-moi au 06 12 34 56 78 ou écrivez à awa@example.org", voice: "person" })).toBeNull()
    expect(conversationTextRefusal({ text: "Rendez-vous à la sortie du métro Château-Rouge, 14 h.", voice: "person" })).toBeNull()
  })

  it("la même détection que les textes de la demande de service", () => {
    for (const text of addresses) expect(serviceTextRefusal(text)).toBe("request_address_forbidden")
  })
})
