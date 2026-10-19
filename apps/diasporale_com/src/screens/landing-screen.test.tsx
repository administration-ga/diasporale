// @vitest-environment jsdom
import { DataSourceProvider, type DiasporaleActions, type DiasporaleDataSource } from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import EnterPage from "@/app/entrer/page"
import HomePage from "@/app/page"
import { routes } from "@/lib/routes"

import { CodeForm, CodeScreen } from "./enter-screens"
import { LandingScreen } from "./landing-screen"

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => navigation }))

const t = getFixedT("fr")

function setup(kind: DiasporaleDataSource["kind"] = "demo") {
  const store = new DemoStore(null, () => Date.UTC(2026, 9, 17, 12), 0)
  const demo = createDemoDataSource(store)
  const requestCode = vi.fn<DiasporaleActions["requestCode"]>().mockResolvedValue({ ok: true, value: { demoCode: "123456" } })
  const verifyCode = vi.fn<DiasporaleActions["verifyCode"]>().mockResolvedValue({ ok: true, value: null })
  const join = vi.fn<DiasporaleActions["join"]>()
  const source: DiasporaleDataSource = {
    ...demo,
    kind,
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
})

describe("Accueil — accès au réseau personnel", () => {
  it("conserve une inscription par code accessible quand IDN n'est pas branchée au moteur", () => {
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

  it("explique l'indisponibilité d'IDN dans le moteur et propose uniquement le courriel", () => {
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
    expect(screen.getByText(t("code.sentTo", { destination: "nouveau@example.com" }))).toBeInTheDocument()
    expect(verifyCode).not.toHaveBeenCalled()
    await user.type(screen.getByRole("textbox", { name: t("code.codeLabel") }), "123456")
    await user.click(screen.getByRole("button", { name: t("code.verify") }))

    await waitFor(() => expect(verifyCode).toHaveBeenCalledExactlyOnceWith("123456"))
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(routes.welcome())
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
    expect(verifyCode).toHaveBeenCalledExactlyOnceWith("123456")
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
    expect(verifyCode).toHaveBeenCalledExactlyOnceWith("654321")
    expect(navigation.push).not.toHaveBeenCalled()
  })
})
