// @vitest-environment jsdom
import { getFixedT, LOCALE_COOKIE, type Locale } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { catchError, type ErrorInfo } from "next/error"
import type { ComponentProps } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import AppError from "@/app/error"
import GlobalError from "@/app/global-error"
import NotFound from "@/app/not-found"
import { APPEARANCE } from "@/lib/appearance"
import { routes } from "@/lib/routes"

import { AppErrorScreen, GlobalErrorProviders, useBrowserLocale } from "./app-error"

const mocks = vi.hoisted(() => ({ locale: "fr" as "fr" | "en" }))

// La page introuvable est un composant serveur : sa langue vient de la requête.
vi.mock("@/i18n/server", async () => {
  const { getFixedT: fixed } = await import("@diasporale/features/i18n")
  return { getAppT: async () => ({ locale: mocks.locale, t: fixed(mocks.locale) }) }
})

// La feuille de la charte que la page globale importe : PostCSS n'a rien à faire dans ces tests.
vi.mock("../app/globals.css", () => ({}))

// Un lien ordinaire, marqué : suivre un lien dans un test ne déclenche aucune navigation de
// jsdom, et le marqueur distingue une navigation du routeur d'un lien de document.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: Omit<ComponentProps<"a">, "href"> & { href: string }) => (
    <a href={href} data-router-link="" {...rest}>
      {children}
    </a>
  ),
}))

const PRIVATE_DETAIL = "Cannot read properties of undefined (reading 'secret_42')"

function chunkError(): Error {
  const error = new Error("Failed to load chunk /_next/static/chunks/ancien.js from module 9")
  error.name = "ChunkLoadError"
  return error
}

/** Les erreurs volontaires de ces tests : React les signale en console, sans intérêt ici. */
function silenceCaughtErrors() {
  vi.spyOn(console, "error").mockImplementation(() => {})
}

/** La navigation de page (`window.location.reload`), que jsdom n'exécute pas. */
function stubReload() {
  const reload = vi.fn()
  vi.stubGlobal("window", new Proxy(window, {
    get(target, property) {
      return property === "location" ? { reload } : Reflect.get(target, property, target)
    },
  }))
  return reload
}

function renderAppError(locale: Locale, error: unknown, retry = vi.fn()) {
  render(
    <I18nProvider locale={locale}>
      <AppError error={error} retry={retry} reset={vi.fn()} />
    </I18nProvider>,
  )
  return retry
}

beforeEach(() => {
  mocks.locale = "fr"
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.cookie = `${LOCALE_COOKIE}=; max-age=0; path=/`
  window.localStorage.clear()
  delete document.documentElement.dataset.charte
})

describe("page d'erreur de l'application (error.tsx)", () => {
  it.each([
    { locale: "fr" as const, title: "Cet écran n’a pas pu s’afficher.", retry: "Réessayer", back: "Revenir au fil" },
    { locale: "en" as const, title: "This screen couldn’t be displayed.", retry: "Try again", back: "Back to the feed" },
  ])("dit l'incident en $locale, focus sur le titre, sans aucun détail technique", async ({ locale, title, retry, back }) => {
    const error = Object.assign(new Error(PRIVATE_DETAIL), { digest: "4242424242" })
    const onRetry = renderAppError(locale, error)

    const heading = screen.getByRole("heading", { level: 1, name: title })
    expect(heading).toHaveFocus()
    expect(screen.getByText(getFixedT(locale)("appError.body"))).toBeInTheDocument()
    const feed = screen.getByRole("link", { name: back })
    expect(feed).toHaveAttribute("href", routes.feed())
    // Sous la mise en page racine, le retour au fil passe par le routeur (la limite d'erreur se lève).
    expect(feed).toHaveAttribute("data-router-link")
    expect(document.body).not.toHaveTextContent(/secret_42|4242424242|Cannot read/)

    // Un seul bouton plein : « Réessayer » ; le retour au fil est le bouton neutre.
    expect(screen.getAllByRole("button")).toHaveLength(1)
    await userEvent.setup().click(screen.getByRole("button", { name: retry }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it("une exception dans un écran montre la page d'erreur dans la langue de la personne, et « Réessayer » relance l'écran", async () => {
    silenceCaughtErrors()
    const screenState = { broken: true }
    function FeedProbe() {
      if (screenState.broken) throw new Error(PRIVATE_DETAIL)
      return <h1>Fil rendu</h1>
    }
    // La limite d'erreur du cadre (même mécanisme que error.tsx : `retry`, puis nouveau rendu).
    const Boundary = catchError((_props: Record<string, unknown>, info: ErrorInfo) => <AppError {...info} />)
    render(
      <I18nProvider locale="en">
        <Boundary>
          <FeedProbe />
        </Boundary>
      </I18nProvider>,
    )

    expect(screen.getByRole("heading", { level: 1, name: "This screen couldn’t be displayed." })).toHaveFocus()
    expect(screen.queryByText(PRIVATE_DETAIL)).toBeNull()

    screenState.broken = false
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("heading", { level: 1, name: "Fil rendu" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull()
  })

  it("après une publication du site, dit « nouvelle version disponible » et « Recharger » suffit", async () => {
    const reload = stubReload()
    const onRetry = renderAppError("fr", chunkError())

    expect(screen.getByRole("heading", { level: 1, name: "Une nouvelle version du site est disponible." })).toHaveFocus()
    expect(screen.getByText("DIASPORALE a été mis à jour pendant votre visite. Rechargez la page pour continuer.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Réessayer" })).toBeNull()
    expect(screen.getByRole("link", { name: "Revenir au fil" })).toHaveAttribute("href", routes.feed())

    await userEvent.setup().click(screen.getByRole("button", { name: "Recharger" }))
    expect(reload).toHaveBeenCalledOnce()
    expect(onRetry).not.toHaveBeenCalled()
  })
})

describe("page d'erreur globale (global-error.tsx)", () => {
  it("pose son propre document : langue, charte Sable, amorçage de l'apparence, page à la marque", () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error(PRIVATE_DETAIL)} retry={() => {}} reset={() => {}} />)

    expect(html).toMatch(/^<html lang="fr" data-charte="diasporale"/)
    expect(html).toContain(`${APPEARANCE.storagePrefix}theme`)
    expect(html).toContain(getFixedT("fr")("meta.title").replace(/'/g, "&#x27;"))
    expect(html).toContain("Cet écran n’a pas pu s’afficher.")
    // La sortie remonte toute l'application : un lien de document, pas une navigation du routeur.
    expect(html).toContain(`<a href="${routes.feed()}" data-slot="button"`)
    expect(html).not.toContain("data-router-link")
    expect(html).not.toMatch(/secret_42|Cannot read/)
  })

  it("dans le navigateur, retrouve la langue et le thème de la personne", async () => {
    document.cookie = `${LOCALE_COOKIE}=en; path=/`
    window.localStorage.setItem(`${APPEARANCE.storagePrefix}theme`, "gaboma")
    function Probe() {
      const locale = useBrowserLocale()
      return (
        <GlobalErrorProviders locale={locale}>
          <AppErrorScreen error={new Error(PRIVATE_DETAIL)} onRetry={() => {}} documentNavigation />
        </GlobalErrorProviders>
      )
    }
    render(<Probe />)

    expect(screen.getByRole("heading", { level: 1, name: "This screen couldn’t be displayed." })).toHaveFocus()
    expect(screen.getByRole("link", { name: "Back to the feed" })).toHaveAttribute("href", routes.feed())
    expect(screen.getByRole("link", { name: "Back to the feed" })).not.toHaveAttribute("data-router-link")
    await act(async () => {})
    expect(document.documentElement.dataset.charte).toBe("diasporale-gaboma")
  })
})

describe("page introuvable (not-found.tsx)", () => {
  it.each([
    { locale: "fr" as const, feed: "Revenir au fil", home: "Revenir à l'accueil", title: "Cette page n'existe pas." },
    { locale: "en" as const, feed: "Back to the feed", home: "Back to the home page", title: "This page doesn't exist." },
  ])("gagne un lien vers le fil en $locale, et garde l'accueil", async ({ locale, feed, home, title }) => {
    mocks.locale = locale
    render(await NotFound())

    expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: feed })).toHaveAttribute("href", routes.feed())
    expect(screen.getByRole("link", { name: home })).toHaveAttribute("href", routes.home())
  })
})
