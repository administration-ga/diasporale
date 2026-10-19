// @vitest-environment jsdom
import { DIASPORALE_DEMO_ACTORS, diasporaleDemoEmailOf } from "@diasporale/domain"
import {
  DataSourceProvider,
  type DemoAccountEntry,
  type DemoAccountsCapability,
  type DiasporaleActions,
  type DiasporaleDataSource,
} from "@diasporale/features/data"
import { DemoStore, createDemoDataSource } from "@diasporale/features/demo"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { DEMO_ACCOUNT_KEY } from "@/lib/demo-account-pending"
import { routes } from "@/lib/routes"

import { DemoAccountsButton } from "./demo-accounts-panel"

const t = getFixedT("fr")
const ALL: readonly DemoAccountEntry[] = DIASPORALE_DEMO_ACTORS.map((actor) => ({ actor, email: diasporaleDemoEmailOf(actor) }))

function capability(entries: readonly DemoAccountEntry[] = ALL) {
  const readLocalCode = vi.fn<DemoAccountsCapability["readLocalCode"]>().mockResolvedValue("654321")
  const equip = vi.fn<DemoAccountsCapability["equip"]>()
  const value: DemoAccountsCapability = { useCatalogue: () => ({ status: "ready", data: entries }), readLocalCode, equip }
  return { value, readLocalCode, equip }
}

function setup(options: { kind?: DiasporaleDataSource["kind"]; demoAccounts?: DemoAccountsCapability } = {}) {
  const demo = createDemoDataSource(new DemoStore(null, () => Date.UTC(2026, 9, 19, 12), 0))
  const requestCode = vi.fn<DiasporaleActions["requestCode"]>().mockResolvedValue({ ok: true, value: { demoCode: "123456" } })
  const verifyCode = vi.fn<DiasporaleActions["verifyCode"]>().mockResolvedValue({ ok: true, value: null })
  const source: DiasporaleDataSource = {
    ...demo,
    kind: options.kind ?? "engine",
    actions: { ...demo.actions, requestCode, verifyCode },
    ...(options.demoAccounts ? { demoAccounts: options.demoAccounts } : {}),
  }
  render(
    <I18nProvider locale="fr">
      <DataSourceProvider source={source}>
        <DemoAccountsButton />
      </DataSourceProvider>
    </I18nProvider>,
  )
  return { requestCode, verifyCode, user: userEvent.setup() }
}

/** La ligne d'un acteur dans la feuille, par son titre. */
function actorButton(title: string) {
  return screen.getByRole("button", { name: new RegExp(`^${title}`) })
}

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.clearAllMocks()
})

describe("Porte — bouton des comptes de démonstration", () => {
  it("n'affiche rien quand le fournisseur ne sert pas les comptes de démonstration", () => {
    setup()
    expect(screen.queryByRole("button", { name: new RegExp(t("demoAccounts.open")) })).not.toBeInTheDocument()
  })

  it("n'affiche rien hors des outils de développement locaux (catalogue vide)", () => {
    setup({ demoAccounts: capability([]).value })
    expect(screen.queryByRole("button", { name: new RegExp(t("demoAccounts.open")) })).not.toBeInTheDocument()
  })

  it("mène aux comptes fictifs en démonstration", () => {
    setup({ kind: "demo" })
    expect(screen.getByRole("link", { name: new RegExp(t("demoAccounts.open")) })).toHaveAttribute("href", routes.demo())
  })

  it("ouvre la feuille des acteurs, groupés en membres, pages, rôles et services", async () => {
    const { user } = setup({ demoAccounts: capability().value })
    await user.click(screen.getByRole("button", { name: new RegExp(t("demoAccounts.open")) }))

    const sheet = screen.getByRole("dialog", { name: t("demoAccounts.title") })
    for (const group of ["members", "pages", "roles"] as const) {
      expect(within(sheet).getByRole("heading", { name: t(`demoAccounts.groups.${group}`) })).toBeInTheDocument()
    }
    expect(within(sheet).getAllByRole("button", { name: /./ }).filter((button) => button.closest("li"))).toHaveLength(DIASPORALE_DEMO_ACTORS.length)
    expect(actorButton(t("demoAccounts.actors.verifie.title"))).toHaveAccessibleName(/Patrice MBOUMBA/)
    expect(actorButton(t("demoAccounts.actors.nouveau.title"))).toHaveAccessibleName(new RegExp(t("demoAccounts.newcomer")))
    expect(actorButton(t("demoAccounts.actors.suspendu.title"))).toHaveAccessibleName(new RegExp(t("membership.status.suspendue")))
  })

  it("connecte l'acteur par le vrai code : envoi à son adresse réservée, code lu, vérification", async () => {
    const { user, requestCode, verifyCode } = setup({ demoAccounts: capability().value })
    await user.click(screen.getByRole("button", { name: new RegExp(t("demoAccounts.open")) }))
    await user.click(actorButton(t("demoAccounts.actors.entreprise.title")))

    await waitFor(() => expect(verifyCode).toHaveBeenCalledExactlyOnceWith("123456"))
    expect(requestCode).toHaveBeenCalledExactlyOnceWith({ kind: "email", value: "entreprise@demo.diasporale.test" })
    // L'acteur reste mémorisé pour l'amorçage, après le rechargement de la connexion.
    expect(window.sessionStorage.getItem(DEMO_ACCOUNT_KEY)).toBe("entreprise")
  })

  it("relit le code local quand l'envoi ne le rend pas", async () => {
    const demoAccounts = capability()
    const { user, requestCode, verifyCode } = setup({ demoAccounts: demoAccounts.value })
    requestCode.mockResolvedValue({ ok: true, value: { demoCode: null } })
    await user.click(screen.getByRole("button", { name: new RegExp(t("demoAccounts.open")) }))
    await user.click(actorButton(t("demoAccounts.actors.mentor.title")))

    await waitFor(() => expect(verifyCode).toHaveBeenCalledExactlyOnceWith("654321"))
    expect(demoAccounts.readLocalCode).toHaveBeenCalledExactlyOnceWith("mentor@demo.diasporale.test")
  })

  it("annonce l'échec, oublie l'acteur et rend la main", async () => {
    const { user, verifyCode } = setup({ demoAccounts: capability().value })
    verifyCode.mockResolvedValue({ ok: false, code: "code_invalid" })
    await user.click(screen.getByRole("button", { name: new RegExp(t("demoAccounts.open")) }))
    await user.click(actorButton(t("demoAccounts.actors.media.title")))

    expect(await screen.findByRole("alert")).toHaveTextContent(t("demoAccounts.failed").replace(/\s+/g, " "))
    expect(window.sessionStorage.getItem(DEMO_ACCOUNT_KEY)).toBeNull()
    expect(actorButton(t("demoAccounts.actors.media.title"))).toBeEnabled()
  })
})
