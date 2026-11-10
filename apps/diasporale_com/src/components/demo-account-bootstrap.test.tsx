// @vitest-environment jsdom
import { DAY_MS, DEFAULT_FACET_VISIBILITY, HOUR_MS } from "@diasporale/domain"
import type { DemoEquipmentView, Loadable, MembershipView, SessionView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DEMO_ACCOUNT_KEY } from "@/lib/demo-account-pending"
import { routes } from "@/lib/routes"

import { DemoAccountBootstrap } from "./demo-account-bootstrap"

const t = getFixedT("fr")

const mocks = vi.hoisted(() => ({
  session: { status: "ready", data: { status: "anonymous" } } as Loadable<SessionView>,
  demoAccounts: null as { equip: ReturnType<typeof vi.fn>; welcomeOutsider: ReturnType<typeof vi.fn> } | null,
  join: vi.fn(),
  becomeMentor: vi.fn(),
  saveTalentProfile: vi.fn(),
  createServiceOffer: vi.fn(),
  createJobOffer: vi.fn(),
  createMission: vi.fn(),
  createEvent: vi.fn(),
  associationEvents: true,
  router: { replace: vi.fn() },
  toast: { loading: vi.fn(() => "avis"), success: vi.fn(), error: vi.fn() },
}))

vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }))
vi.mock("sonner", () => ({ toast: mocks.toast }))
vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useSession: () => mocks.session,
  useActions: () => ({ join: mocks.join }),
  useDemoAccounts: () => mocks.demoAccounts,
  useMentoring: () => ({ becomeMentor: mocks.becomeMentor }),
  useJobs: () => ({ saveTalentProfile: mocks.saveTalentProfile, createOffer: mocks.createJobOffer }),
  useServices: () => ({ createOffer: mocks.createServiceOffer }),
  useMutualAid: () => ({ createMission: mocks.createMission }),
  useAssociationEvents: () => (mocks.associationEvents ? { create: mocks.createEvent } : null),
}))

const membership: MembershipView = {
  personId: "persons_fabrice",
  handle: "demo.entreprise",
  displayName: "Fabrice NDONG",
  status: "verifiee",
  badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: 1,
  sponsoredBy: null,
  attestation: { outcome: "verified", postSlug: null, requestedAt: 1 },
  root: { network: "antsia", status: "verifiee", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "reinforced",
  directoryVisibility: "network",
}

function signedIn(member: MembershipView | null): Loadable<SessionView> {
  return { status: "ready", data: { status: "signed_in", account: { id: "account_demo", idn: null, local: null, nameHints: {} }, membership: member } }
}

function equipment(value: Partial<DemoEquipmentView> = {}) {
  return { ok: true as const, value: { status: "verifiee" as const, role: "member" as const, pageId: "pages_saveurs", pageCreated: true, ...value } }
}

function mount() {
  render(<I18nProvider locale="fr"><DemoAccountBootstrap /></I18nProvider>)
}

/** La capacité des comptes de démonstration, avec l'équipement donné. */
function demoAccounts(equipped: unknown = equipment()) {
  return { equip: vi.fn().mockResolvedValue(equipped), welcomeOutsider: vi.fn().mockResolvedValue({ ok: true, value: null }) }
}

beforeEach(() => {
  mocks.session = signedIn(null)
  mocks.demoAccounts = demoAccounts()
  mocks.join.mockResolvedValue({ ok: true, value: { country: "FR" } })
  mocks.associationEvents = true
  for (const gesture of [mocks.becomeMentor, mocks.saveTalentProfile, mocks.createServiceOffer, mocks.createJobOffer, mocks.createMission]) gesture.mockResolvedValue({ ok: true, value: {} })
  mocks.createEvent.mockResolvedValue({ ok: true, value: { eventId: "events_demo", created: true } })
})

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.clearAllMocks()
})

describe("Amorçage d'un compte de démonstration", () => {
  it("prépare l'entreprise : vrai accueil, équipement, offres de sa page, puis le fil", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "entreprise")
    mount()

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(routes.feed()))
    expect(mocks.join).toHaveBeenCalledExactlyOnceWith({
      facet: { countryOfResidence: "FR", city: "Paris" },
      handle: "demo.entreprise",
      displayName: "Fabrice NDONG",
      consents: { social_profile: true, directory: true, notifications: false },
      directoryVisibility: "network",
    })
    expect(mocks.demoAccounts?.equip).toHaveBeenCalledExactlyOnceWith("entreprise")
    expect(mocks.createServiceOffer).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ pageId: "pages_saveurs", publish: true, country: "FR", city: "Paris" }))
    expect(mocks.createJobOffer).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ pageId: "pages_saveurs", publish: true, country: "FR", city: "Paris" }))
    expect(mocks.becomeMentor).not.toHaveBeenCalled()
    expect(mocks.createMission).not.toHaveBeenCalled()
    expect(mocks.toast.success).toHaveBeenCalledWith(t("demoAccounts.ready", { name: "Fabrice NDONG" }), { id: "avis" })
    expect(window.sessionStorage.getItem(DEMO_ACCOUNT_KEY)).toBeNull()
  })

  it("publie le profil de la mentore avec son consentement", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "mentor")
    mocks.demoAccounts = demoAccounts(equipment({ pageId: null, pageCreated: false }))
    mount()

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalled())
    expect(mocks.becomeMentor).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ country: "FR", consent: true }))
    expect(mocks.createServiceOffer).not.toHaveBeenCalled()
  })

  it("ne rejoue ni l'accueil ni les gestes d'un membre déjà entré", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "entreprise")
    mocks.session = signedIn(membership)
    mount()

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalled())
    expect(mocks.join).not.toHaveBeenCalled()
    expect(mocks.demoAccounts?.equip).toHaveBeenCalledExactlyOnceWith("entreprise")
    expect(mocks.createServiceOffer).not.toHaveBeenCalled()
    expect(mocks.createJobOffer).not.toHaveBeenCalled()
  })

  it("ne joue pas les gestes d'une page qui existait déjà", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "association")
    mocks.demoAccounts = demoAccounts(equipment({ pageId: "pages_lyon", pageCreated: false }))
    mount()

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalled())
    expect(mocks.join).toHaveBeenCalledTimes(1)
    expect(mocks.createMission).not.toHaveBeenCalled()
    expect(mocks.createEvent).not.toHaveBeenCalled()
  })

  it("EV-01 : l'association crée la mission et deux évènements fictifs de sa page, par la capacité du port", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "association")
    mocks.demoAccounts = demoAccounts(equipment({ pageId: "pages_lyon", pageCreated: true }))
    const before = Date.now()
    mount()

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(routes.feed()))
    const after = Date.now()
    expect(mocks.createMission).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ pageId: "pages_lyon", country: "FR", city: "Lyon" }))
    expect(mocks.createEvent).toHaveBeenCalledTimes(2)
    const [open, members] = mocks.createEvent.mock.calls.map(([input]) => input as Record<string, unknown>)
    // Le premier, ouvert à tout DIASPORALE, deux places, dans sept jours ; le second, réservé aux adhérents, sans limite.
    expect(open).toMatchObject({ pageId: "pages_lyon", audience: "network", capacity: 2, timeZone: "Europe/Paris", idempotencyKey: "diasporale-demo:association-event:accueil" })
    expect(members).toMatchObject({ pageId: "pages_lyon", audience: "association", capacity: null, timeZone: "Europe/Paris", idempotencyKey: "diasporale-demo:association-event:assemblee" })
    for (const [event, leadDays, hours] of [[open, 7, 3], [members, 14, 2]] as const) {
      const startAt = Number(event?.startAt)
      expect(startAt % HOUR_MS).toBe(0)
      expect(startAt).toBeGreaterThanOrEqual(before + leadDays * DAY_MS)
      expect(startAt).toBeLessThanOrEqual(after + leadDays * DAY_MS + HOUR_MS)
      expect(event?.endAt).toBe(startAt + hours * HOUR_MS)
      // Contenus marqués fictifs ; aucune adresse privée.
      expect(String(event?.title)).toContain("(démonstration)")
      expect(String(event?.location)).toContain("(lieu fictif)")
    }
    expect(mocks.toast.success).toHaveBeenCalledWith(t("demoAccounts.ready", { name: "Mireille ENGONE" }), { id: "avis" })
  })

  it("EV-01 : rejoué, le geste renvoie les mêmes clés d'idempotence ; un membre déjà entré ne le rejoue pas", async () => {
    for (let run = 0; run < 2; run += 1) {
      window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "association")
      mocks.demoAccounts = demoAccounts(equipment({ pageId: "pages_lyon", pageCreated: true }))
      mount()
      await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledTimes(run + 1))
      cleanup()
    }
    const keys = mocks.createEvent.mock.calls.map(([input]) => (input as { idempotencyKey: string }).idempotencyKey)
    expect(keys).toEqual([
      "diasporale-demo:association-event:accueil",
      "diasporale-demo:association-event:assemblee",
      "diasporale-demo:association-event:accueil",
      "diasporale-demo:association-event:assemblee",
    ])

    mocks.createEvent.mockClear()
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "association")
    mocks.session = signedIn({ ...membership, handle: "demo.association", displayName: "Mireille ENGONE" })
    mount()
    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledTimes(3))
    expect(mocks.createEvent).not.toHaveBeenCalled()
  })

  it.each([
    ["un évènement refusé par le moteur", () => mocks.createEvent.mockResolvedValueOnce({ ok: false, code: "association_event_invalid" })],
    ["un fournisseur sans évènements d'association", () => { mocks.associationEvents = false }],
  ])("EV-01 : %s se dit, sans bloquer l'arrivée sur le fil", async (_label, arrange) => {
    arrange()
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "association")
    mocks.demoAccounts = demoAccounts(equipment({ pageId: "pages_lyon", pageCreated: true }))
    mount()

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(t("demoAccounts.equipFailed", { name: "Mireille ENGONE" }), { id: "avis" }))
    expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(routes.feed())
    expect(mocks.toast.success).not.toHaveBeenCalled()
  })

  it("l'extérieur au réseau : l'accueil d'ANTSIA seulement, jamais join, puis l'accueil de DIASPORALE", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "exterieur")
    mocks.demoAccounts = demoAccounts(equipment({ status: null, role: null, pageId: null, pageCreated: false }))
    mount()

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(routes.welcome()))
    expect(mocks.demoAccounts?.welcomeOutsider).toHaveBeenCalledExactlyOnceWith({ handle: "demo.exterieur", displayName: "Brice MOUNDOUNGA" })
    expect(mocks.join).not.toHaveBeenCalled()
    expect(mocks.demoAccounts?.equip).toHaveBeenCalledExactlyOnceWith("exterieur")
    expect(mocks.toast.success).toHaveBeenCalledWith(t("demoAccounts.ready", { name: "Brice MOUNDOUNGA" }), { id: "avis" })
    expect(window.sessionStorage.getItem(DEMO_ACCOUNT_KEY)).toBeNull()
  })

  it("l'accueil d'ANTSIA refusé : avis d'échec, aucun équipement, l'acteur oublié", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "exterieur")
    mocks.demoAccounts = demoAccounts()
    mocks.demoAccounts.welcomeOutsider.mockResolvedValue({ ok: false, code: "handle_unavailable" })
    mount()

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(t("demoAccounts.equipFailed", { name: "Brice MOUNDOUNGA" }), { id: "avis" }))
    expect(mocks.demoAccounts.equip).not.toHaveBeenCalled()
    expect(mocks.join).not.toHaveBeenCalled()
    expect(mocks.router.replace).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(DEMO_ACCOUNT_KEY)).toBeNull()
  })

  it.each([
    ["bloque", "Yannick MBADINGA", "verifiee"],
    ["suspendu-racine", "Christelle IVANGA", "suspendue"],
  ] as const)("%s : le vrai accueil puis l'équipement, comme tout membre, et le fil", async (actor, name, status) => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, actor)
    mocks.demoAccounts = demoAccounts(equipment({ status, pageId: null, pageCreated: false }))
    mount()

    await waitFor(() => expect(mocks.router.replace).toHaveBeenCalledExactlyOnceWith(routes.feed()))
    expect(mocks.join).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ handle: `demo.${actor}`, displayName: name, facet: { countryOfResidence: "FR", city: null } }))
    expect(mocks.demoAccounts?.welcomeOutsider).not.toHaveBeenCalled()
    expect(mocks.demoAccounts?.equip).toHaveBeenCalledExactlyOnceWith(actor)
    expect(mocks.toast.success).toHaveBeenCalledWith(t("demoAccounts.ready", { name }), { id: "avis" })
  })

  it("laisse l'accueil au nouvel arrivant", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "nouveau")
    mount()

    await waitFor(() => expect(window.sessionStorage.getItem(DEMO_ACCOUNT_KEY)).toBeNull())
    expect(mocks.join).not.toHaveBeenCalled()
    expect(mocks.demoAccounts?.equip).not.toHaveBeenCalled()
    expect(mocks.router.replace).not.toHaveBeenCalled()
  })

  it("dit l'échec de la préparation, sans quitter l'accueil, et oublie l'acteur", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "verifie")
    mocks.demoAccounts = demoAccounts({ ok: false, code: "feature_unavailable" })
    mount()

    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith(t("demoAccounts.equipFailed", { name: "Patrice MBOUMBA" }), { id: "avis" }))
    expect(mocks.router.replace).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(DEMO_ACCOUNT_KEY)).toBeNull()
  })

  it("ne fait rien sans acteur en attente, ni avant la session", async () => {
    mount()
    mocks.session = { status: "loading" }
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "verifie")
    cleanup()
    mount()

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mocks.join).not.toHaveBeenCalled()
    expect(mocks.demoAccounts?.equip).not.toHaveBeenCalled()
    expect(window.sessionStorage.getItem(DEMO_ACCOUNT_KEY)).toBe("verifie")
  })

  it("ne fait rien quand le fournisseur ne sert pas les comptes de démonstration", async () => {
    window.sessionStorage.setItem(DEMO_ACCOUNT_KEY, "verifie")
    mocks.demoAccounts = null
    mount()

    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mocks.join).not.toHaveBeenCalled()
    expect(mocks.toast.loading).not.toHaveBeenCalled()
  })
})
