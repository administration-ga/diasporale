// @vitest-environment jsdom
import { DataSourceProvider, type DiasporaleActions, type DiasporaleDataSource, type EntryDoorsView, type Loadable } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import EnterPage from "@/app/entrer/page"
import HomePage from "@/app/page"
import { PENDING_CODE_KEY, peekPendingCode } from "@/lib/pending-code"
import { routes } from "@/lib/routes"
import { filledButtons } from "@/test-utils"

import { CodeForm, CodeScreen } from "./enter-screens"
import { LandingScreen } from "./landing-screen"

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => navigation }))

const t = getFixedT("fr")

/** Avec le moteur, la porte suit la configuration du déploiement : ici, IDN fermée et code par e-mail ouvert. */
const IDN_CLOSED: Loadable<EntryDoorsView> = { status: "ready", data: { idn: false, emailCode: true } }

function setup(kind: DiasporaleDataSource["kind"] = "demo") {
  const store = new DemoStore(null, () => Date.UTC(2026, 9, 17, 12), 0)
  const demo = createDemoDataSource(store)
  const requestCode = vi.fn<DiasporaleActions["requestCode"]>().mockResolvedValue({ ok: true, value: { demoCode: "123456" } })
  const verifyCode = vi.fn<DiasporaleActions["verifyCode"]>().mockResolvedValue({ ok: true, value: null })
  const join = vi.fn<DiasporaleActions["join"]>()
  const source: DiasporaleDataSource = {
    ...demo,
    kind,
    ...(kind === "engine" ? { useEntryDoors: () => IDN_CLOSED } : {}),
    actions: { ...demo.actions, requestCode, verifyCode, join },
  }
  const mount = (children: ReactNode = <LandingScreen />) => render(
    <I18nProvider locale="fr">
      <DataSourceProvider source={source}>{children}</DataSourceProvider>
    </I18nProvider>,
  )
  return { store, requestCode, verifyCode, join, mount, user: userEvent.setup() }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  // L'adresse en attente d'un code vit dans l'onglet (EA-08) : chaque essai part d'un onglet neuf.
  window.sessionStorage.clear()
})

describe("Accueil — accès au réseau personnel", () => {
  it("conserve une inscription par code accessible quand le déploiement ne sert pas IDN", () => {
    const { mount } = setup("engine")
    mount(<LandingScreen intent="sign-up" />)
    expect(screen.getByRole("heading", { level: 2, name: t("entry.signUpTitle") })).toBeInTheDocument()
    expect(screen.getByText(t("entry.signUpLead").replace(/\s+/g, " "))).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: t("landing.idnContinue") })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("landing.idnContinue") })).toBeDisabled()
    expect(screen.getByText(t("landing.idnUnavailable"))).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: t("code.emailLabel") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("code.send") })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: t("entry.existingAccount") })).toHaveAttribute("href", routes.enter())
    expect(screen.queryByRole("link", { name: t("landing.createAccount") })).not.toBeInTheDocument()
    // Le moteur n'expose que l'e-mail : aucun SMS proposé, ni ici ni par un lien.
    expect(screen.queryByRole("link", { name: t("entry.smsInstead") })).not.toBeInTheDocument()
  })

  it("propose l'inscription et l'IDN de démonstration avec la connexion par code intégrée", () => {
    const { mount, store, requestCode, join } = setup()
    mount()

    expect(screen.getByRole("link", { name: t("landing.createAccount") })).toHaveAttribute("href", routes.register())
    expect(screen.getByRole("link", { name: t("landing.idnContinue") })).toHaveAttribute("href", routes.enterIdn())
    expect(screen.getByRole("textbox", { name: t("code.emailLabel") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("landing.signIn") })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: t("code.kind.phone") })).not.toBeInTheDocument()
    // Le SMS de démonstration reste joignable, sur la page dédiée au code.
    expect(screen.getByRole("link", { name: t("entry.smsInstead") })).toHaveAttribute("href", routes.enterCode())
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(store.getState().session.personId).toBeNull()
    expect(requestCode).not.toHaveBeenCalled()
    expect(join).not.toHaveBeenCalled()
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it("explique l'indisponibilité d'IDN quand le déploiement ne la sert pas, et propose uniquement le courriel", () => {
    const { mount } = setup("engine")
    mount()

    expect(screen.queryByRole("link", { name: t("landing.idnContinue") })).not.toBeInTheDocument()
    const idn = screen.getByRole("button", { name: t("landing.idnContinue") })
    expect(idn).toBeDisabled()
    expect(idn).toHaveAccessibleDescription(t("landing.idnUnavailable"))
    expect(screen.queryByRole("button", { name: t("code.kind.phone") })).not.toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: t("code.phoneLabel") })).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: t("code.emailLabel") })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: t("landing.createAccount") })).toHaveAttribute("href", routes.register())
  })

  it("refuse une adresse invalide avant de demander un code", async () => {
    const { mount, user, requestCode } = setup()
    mount()
    const destination = screen.getByRole("textbox", { name: t("code.emailLabel") })
    await user.type(destination, "adresse-invalide")
    await user.click(screen.getByRole("button", { name: t("landing.signIn") }))

    expect(await screen.findByText(t("errors.email_invalid"))).toBeInTheDocument()
    expect(destination).toHaveAttribute("aria-invalid", "true")
    expect(requestCode).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it("demande puis vérifie le code depuis l'accueil sans créer d'adhésion ni accorder de consentement", async () => {
    const { mount, user, requestCode, verifyCode, join, store } = setup()
    const consents = store.getState().consents
    mount()
    await user.type(screen.getByRole("textbox", { name: t("code.emailLabel") }), "nouveau@example.com")
    await user.click(screen.getByRole("button", { name: t("landing.signIn") }))

    expect(requestCode).toHaveBeenCalledExactlyOnceWith({ kind: "email", value: "nouveau@example.com" })
    expect(await screen.findByText("123456")).toBeInTheDocument()
    // L'adresse se montre masquée (MO-04).
    expect(screen.getByText(t("code.sentTo", { destination: "n…@example.com" }))).toBeInTheDocument()
    expect(verifyCode).not.toHaveBeenCalled()
    await user.type(screen.getByRole("textbox", { name: t("code.codeLabel") }), "123456")
    await user.click(screen.getByRole("button", { name: t("code.verify") }))

    await waitFor(() => expect(verifyCode).toHaveBeenCalledExactlyOnceWith("123456", { kind: "email", value: "nouveau@example.com" }))
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(routes.welcome())
    // Connecté : l'adresse gardée pour la saisie est oubliée.
    expect(peekPendingCode()).toBeNull()
    expect(join).not.toHaveBeenCalled()
    expect(store.getState().consents).toEqual(consents)
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("garde le formulaire d'adresse et traduit un refus d'envoi du code", async () => {
    const { mount, user, requestCode, verifyCode } = setup("engine")
    requestCode.mockResolvedValue({ ok: false, code: "rate_limited" })
    mount()
    await user.type(screen.getByRole("textbox", { name: t("code.emailLabel") }), "nouveau@example.com")
    await user.click(screen.getByRole("button", { name: t("landing.signIn") }))

    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.rate_limited").replace(/\s+/g, " "))
    expect(screen.getByRole("textbox", { name: t("code.emailLabel") })).toHaveValue("nouveau@example.com")
    expect(screen.queryByRole("textbox", { name: t("code.codeLabel") })).not.toBeInTheDocument()
    expect(verifyCode).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
  })

  it("renvoie une session déjà membre vers son fil sans redemander de code", async () => {
    const { mount, store, requestCode, join } = setup()
    await store.switchTo("p-steeve")
    mount()

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(routes.feed()))
    expect(requestCode).not.toHaveBeenCalled()
    expect(join).not.toHaveBeenCalled()
  })

  it("renvoie un compte connecté sans adhésion vers l'onboarding sans simuler son consentement", async () => {
    const { mount, store, requestCode, join } = setup()
    await store.signInWithIdn({ firstName: "Éloïse", lastName: "NDONG", loa: 2, gaboneseNationality: true })
    const before = store.getState()
    mount()

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(routes.welcome()))
    expect(store.getState().memberships).toEqual(before.memberships)
    expect(store.getState().consents).toEqual(before.consents)
    expect(requestCode).not.toHaveBeenCalled()
    expect(join).not.toHaveBeenCalled()
  })
})

describe("Entrée — intention d'inscription", () => {
  it.each([
    { label: "inscription explicite", inscription: "1", signUp: true },
    { label: "paramètre absent", inscription: undefined, signUp: false },
    { label: "tableau ignoré", inscription: ["1"], signUp: false },
  ])("présente la carte adaptée pour $label sans créer de compte", async ({ inscription, signUp }) => {
    const { mount, store, requestCode, join } = setup()
    const page = await EnterPage({ searchParams: Promise.resolve({ inscription }) })
    mount(page)

    expect(screen.getByRole("heading", { level: 2, name: t(signUp ? "entry.signUpTitle" : "landing.signInTitle") })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: t("code.emailLabel") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: t(signUp ? "code.send" : "landing.signIn") })).toBeInTheDocument()
    if (signUp) expect(screen.getByRole("link", { name: t("entry.existingAccount") })).toHaveAttribute("href", routes.enter())
    else expect(screen.getByRole("link", { name: t("landing.createAccount") })).toHaveAttribute("href", routes.register())
    expect(store.getState().session.personId).toBeNull()
    expect(requestCode).not.toHaveBeenCalled()
    expect(join).not.toHaveBeenCalled()
  })
})

describe("Porte — une seule pour l'accueil, /entrer et leurs étapes (principe de l'accueil d'ANTSIA)", () => {
  // La promesse tient sur deux lignes (`\n`) : son nom accessible est comparé espaces normalisés.
  const promise = (name: string) => name.replace(/\s+/g, " ") === t("landing.title").replace(/\s+/g, " ")

  it("rend la même vitrine sur l'accueil et sur /entrer", async () => {
    const { mount } = setup()
    const home = mount(HomePage())
    const homeHeading = screen.getByRole("heading", { level: 1 }).textContent
    expect(screen.getByRole("heading", { level: 1, name: promise })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: t("nav.home") })).toHaveAttribute("href", routes.home())
    home.unmount()

    mount(await EnterPage({ searchParams: Promise.resolve({}) }))
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(homeHeading)
    expect(screen.getByRole("link", { name: t("nav.home") })).toHaveAttribute("href", routes.home())
  })

  it("montre le mot-symbole réel, sans canevas, quand WebGL2 et le mouvement ne sont pas disponibles", () => {
    const { mount } = setup()
    mount()

    const brand = screen.getByRole("link", { name: t("nav.home") })
    expect(brand).toHaveTextContent(t("brand.name"))
    expect(brand.querySelector("[data-liquid]")).toHaveAttribute("data-liquid", "off")
    expect(brand.querySelector("canvas")).toBeNull()
  })

  it("monte l'étape du code dans la même porte, avec son retour vers /entrer", () => {
    const { mount } = setup("engine")
    mount(<CodeScreen />)

    expect(screen.getByRole("heading", { level: 1, name: promise })).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 2, name: t("code.title") })).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: t("code.emailLabel") })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("code.send") })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: t("common.back") })).toHaveAttribute("href", routes.enter())
  })
})

describe("CodeForm — formulaire réutilisable", () => {
  it("rétablit l'envoi après une exception réseau et conserve l'adresse sans rediriger", async () => {
    const { mount, user, requestCode, verifyCode } = setup("engine")
    requestCode.mockRejectedValueOnce(new Error("Network request failed"))
    mount(<CodeForm compact />)
    const destination = screen.getByRole("textbox", { name: t("code.emailLabel") })
    await user.type(destination, "nouveau@example.com")
    await user.click(screen.getByRole("button", { name: t("landing.signIn") }))

    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.network_unavailable").replace(/\s+/g, " "))
    await waitFor(() => expect(screen.getByRole("button", { name: t("landing.signIn") })).toBeEnabled())
    expect(destination).toBeEnabled()
    expect(destination).toHaveValue("nouveau@example.com")
    expect(verifyCode).not.toHaveBeenCalled()
    expect(navigation.push).not.toHaveBeenCalled()
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it("rétablit la vérification après une exception réseau et conserve le code sans rediriger", async () => {
    const { mount, user, verifyCode } = setup("engine")
    verifyCode.mockRejectedValueOnce(new Error("Network request failed"))
    mount(<CodeForm />)
    await user.type(screen.getByRole("textbox", { name: t("code.emailLabel") }), "nouveau@example.com")
    await user.click(screen.getByRole("button", { name: t("code.send") }))
    const code = await screen.findByRole("textbox", { name: t("code.codeLabel") })
    await user.type(code, "123456")
    await user.click(screen.getByRole("button", { name: t("code.verify") }))

    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.network_unavailable").replace(/\s+/g, " "))
    await waitFor(() => expect(screen.getByRole("button", { name: t("code.verify") })).toBeEnabled())
    expect(code).toBeEnabled()
    expect(code).toHaveValue("123456")
    expect(verifyCode).toHaveBeenCalledExactlyOnceWith("123456", { kind: "email", value: "nouveau@example.com" })
    expect(navigation.push).not.toHaveBeenCalled()
    expect(navigation.replace).not.toHaveBeenCalled()
  })

  it("conserve le SMS de démonstration sur le formulaire dédié", async () => {
    const { mount, user, requestCode } = setup()
    mount(<CodeForm />)
    await user.click(screen.getByRole("button", { name: t("code.kind.phone") }))
    await user.type(screen.getByRole("textbox", { name: t("code.phoneLabel") }), "+33 6 12 34 56 78")
    await user.click(screen.getByRole("button", { name: t("code.send") }))

    expect(requestCode).toHaveBeenCalledExactlyOnceWith({ kind: "phone", value: "+33 6 12 34 56 78" })
    expect(await screen.findByRole("textbox", { name: t("code.codeLabel") })).toBeInTheDocument()
  })

  it("valide le format puis affiche un code refusé sans naviguer, même sans indice de démonstration", async () => {
    const { mount, user, requestCode, verifyCode } = setup("engine")
    requestCode.mockResolvedValue({ ok: true, value: { demoCode: null } })
    verifyCode.mockResolvedValue({ ok: false, code: "code_invalid" })
    mount(<CodeForm />)
    await user.type(screen.getByRole("textbox", { name: t("code.emailLabel") }), "nouveau@example.com")
    await user.click(screen.getByRole("button", { name: t("code.send") }))
    const code = await screen.findByRole("textbox", { name: t("code.codeLabel") })

    expect(screen.queryByText(t("code.demoCode"))).not.toBeInTheDocument()
    fireEvent.change(code, { target: { value: "12" } })
    await user.click(screen.getByRole("button", { name: t("code.verify") }))
    expect(await screen.findByText(t("errors.code_format"))).toBeInTheDocument()
    expect(verifyCode).not.toHaveBeenCalled()

    await user.clear(code)
    await user.type(code, "654321")
    await user.click(screen.getByRole("button", { name: t("code.verify") }))
    expect(await screen.findByText(t("errors.code_invalid"))).toBeInTheDocument()
    expect(verifyCode).toHaveBeenCalledExactlyOnceWith("654321", { kind: "email", value: "nouveau@example.com" })
    expect(navigation.push).not.toHaveBeenCalled()
  })
})

describe("Porte fiable — reprise après un rechargement, renvoi du code (EA-08, MO-04)", () => {
  /** Un code parti il y a `ago` millisecondes, tel que l'onglet le garde. */
  function pendingSince(ago: number, value = "nouveau@example.com") {
    window.sessionStorage.setItem(PENDING_CODE_KEY, JSON.stringify({ kind: "email", value, sentAt: Date.now() - ago }))
  }

  it("rechargement entre l'envoi et la saisie : la saisie du code reprend, sans redemander de code", async () => {
    const store = new DemoStore(null, () => Date.UTC(2026, 9, 17, 12), 0)
    const source = createDemoDataSource(store)
    const requestCode = vi.fn(source.actions.requestCode)
    const verifyCode = vi.fn(source.actions.verifyCode)
    const demo: DiasporaleDataSource = { ...source, actions: { ...source.actions, requestCode, verifyCode } }
    const mount = () => render(<I18nProvider locale="fr"><DataSourceProvider source={demo}><CodeForm /></DataSourceProvider></I18nProvider>)
    const user = userEvent.setup()
    mount()
    await user.type(screen.getByRole("textbox", { name: t("code.emailLabel") }), "nouveau@example.com")
    await user.click(screen.getByRole("button", { name: t("code.send") }))
    await screen.findByRole("textbox", { name: t("code.codeLabel") })
    const code = store.getState().pendingCode?.code ?? ""
    expect(code).toMatch(/^\d{6}$/)
    // L'onglet ne garde jamais le code, seulement l'adresse et l'heure de l'envoi.
    expect(window.sessionStorage.getItem(PENDING_CODE_KEY)).not.toContain(code)

    // Rechargement (ou retour depuis la messagerie, l'onglet fermé par le système) : un nouveau montage.
    cleanup()
    mount()
    const resumed = await screen.findByRole("textbox", { name: t("code.codeLabel") })
    expect(screen.getByText(t("code.sentTo", { destination: "n…@example.com" }))).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: t("code.emailLabel") })).not.toBeInTheDocument()
    await user.type(resumed, code)
    await user.click(screen.getByRole("button", { name: t("code.verify") }))

    await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith(routes.welcome()))
    expect(requestCode).toHaveBeenCalledTimes(1)
    expect(verifyCode).toHaveBeenCalledExactlyOnceWith(code, { kind: "email", value: "nouveau@example.com" })
    expect(store.getState().session.personId).not.toBeNull()
    expect(peekPendingCode()).toBeNull()
  })

  it("renvoi refusé avant le délai, même après un rechargement ; le décompte se lit à côté du bouton", async () => {
    const { mount, user, requestCode } = setup("engine")
    requestCode.mockResolvedValue({ ok: true, value: { demoCode: null } })
    mount(<CodeForm />)
    await user.type(screen.getByRole("textbox", { name: t("code.emailLabel") }), "nouveau@example.com")
    await user.click(screen.getByRole("button", { name: t("code.send") }))
    await screen.findByRole("textbox", { name: t("code.codeLabel") })

    const resend = screen.getByRole("button", { name: t("entryCode.resend") })
    expect(resend).toBeDisabled()
    expect(resend).toHaveAccessibleDescription(/\d+ s\.$/)
    await user.click(resend)
    cleanup()
    mount(<CodeForm />)
    const again = await screen.findByRole("button", { name: t("entryCode.resend") })
    expect(again).toBeDisabled()
    await user.click(again)
    expect(requestCode).toHaveBeenCalledTimes(1)
    // Un seul bouton plein dans la zone : « Valider le code ».
    expect(filledButtons(document.body)).toEqual([screen.getByRole("button", { name: t("code.verify") })])
  })

  it("après le délai, le code repart à la même adresse et l'écran l'annonce", async () => {
    pendingSince(61_000)
    const { mount, user, requestCode } = setup("engine")
    requestCode.mockResolvedValue({ ok: true, value: { demoCode: null } })
    mount(<CodeForm />)
    const resend = await screen.findByRole("button", { name: t("entryCode.resend") })
    expect(resend).toBeEnabled()
    expect(resend).toHaveAccessibleDescription(t("entryCode.resendReady"))
    await user.click(resend)

    await waitFor(() => expect(requestCode).toHaveBeenCalledExactlyOnceWith({ kind: "email", value: "nouveau@example.com" }))
    expect(await screen.findByText(t("entryCode.resent"))).toBeInTheDocument()
    // Le délai repart du nouvel envoi.
    expect(screen.getByRole("button", { name: t("entryCode.resend") })).toBeDisabled()
    expect(peekPendingCode()?.sentAt).toBeGreaterThan(Date.now() - 5_000)
  })

  it("un refus de débit au renvoi se dit tel quel, sans durée que le moteur ne donne pas", async () => {
    pendingSince(61_000)
    const { mount, user, requestCode } = setup("engine")
    requestCode.mockResolvedValue({ ok: false, code: "rate_limited" })
    mount(<CodeForm />)
    await user.click(await screen.findByRole("button", { name: t("entryCode.resend") }))

    expect(await screen.findByRole("alert")).toHaveTextContent(t("errors.rate_limited").replace(/\s+/g, " "))
    // La saisie du code reste ouverte : le code déjà reçu vaut peut-être encore.
    expect(screen.getByRole("textbox", { name: t("code.codeLabel") })).toBeInTheDocument()
  })

  it("changer d'adresse oublie l'adresse en attente, et la reprend dans le champ pour la corriger", async () => {
    pendingSince(10_000)
    const { mount, user } = setup("engine")
    mount(<CodeForm />)
    await user.click(await screen.findByRole("button", { name: t("code.changeDestination") }))

    expect(screen.getByRole("textbox", { name: t("code.emailLabel") })).toHaveValue("nouveau@example.com")
    expect(peekPendingCode()).toBeNull()
  })

  it("passé l'échéance de l'onglet, la porte repart du début", async () => {
    pendingSince(31 * 60 * 1000)
    const { mount } = setup("engine")
    mount(<CodeForm />)

    expect(await screen.findByRole("textbox", { name: t("code.emailLabel") })).toHaveValue("")
    expect(screen.queryByRole("textbox", { name: t("code.codeLabel") })).not.toBeInTheDocument()
  })

  it("une session déjà ouverte oublie l'adresse en attente en quittant la porte", async () => {
    pendingSince(10_000)
    const { mount, store } = setup()
    await store.switchTo("p-steeve")
    mount()

    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith(routes.feed()))
    expect(peekPendingCode()).toBeNull()
  })
})
