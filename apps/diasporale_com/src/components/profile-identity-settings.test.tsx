// @vitest-environment jsdom
import type { ActionResult, DiasporaleDataSource, OwnProfileView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, getDefaultNormalizer, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { ProfileIdentitySettings } from "./profile-identity-settings"

type Publication = NonNullable<DiasporaleDataSource["profilePublication"]>
const t = getFixedT("fr")
const profile: OwnProfileView = { personId: "a", handle: "social.name", displayName: "Nom choisi", headline: "Accroche", published: false, private: true }
function setup() {
  const updateIdentity = vi.fn<NonNullable<Publication["updateIdentity"]>>().mockResolvedValue({ ok: true, value: null })
  const publication: Publication = { useMyProfile: () => ({ status: "ready", data: profile }), setPrivacy: vi.fn(), withdraw: vi.fn(), republish: vi.fn(), updateIdentity }
  const tree = (own = profile, pub = publication, disabled = false) => <I18nProvider locale="fr"><ProfileIdentitySettings profile={own} publication={pub} disabled={disabled} acquire={() => () => {}} /></I18nProvider>
  return { ...render(tree()), tree, publication, updateIdentity }
}
function edit() { fireEvent.click(screen.getByRole("button", { name: t("settings.profileIdentity.edit") })) }
function save() { fireEvent.submit(screen.getByRole("button", { name: t("settings.profileIdentity.save") }).closest("form")!) }
afterEach(cleanup)

describe("Identité sociale — sauvegarde distincte de la republication", () => {
  it("édite un profil retiré avec l'accroche explicite, sans consentement ni publication", async () => {
    const { updateIdentity, publication } = setup()
    edit()
    expect(screen.getByLabelText(t("settings.profileIdentity.name"))).toHaveFocus()
    fireEvent.change(screen.getByLabelText(t("settings.profileIdentity.name")), { target: { value: " Nouveau libre " } })
    fireEvent.change(screen.getByLabelText(t("settings.profileIdentity.headline")), { target: { value: " " } })
    save()
    await waitFor(() => expect(updateIdentity).toHaveBeenCalledExactlyOnceWith("a", { displayName: "Nouveau libre", headline: "" }))
    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument())
    expect(publication.republish).not.toHaveBeenCalled()
    expect(publication.setPrivacy).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: t("settings.profileIdentity.edit") })).toHaveFocus()
  })

  it("annule sans écrire et restaure le focus", () => {
    const { updateIdentity } = setup()
    edit()
    fireEvent.change(screen.getByLabelText(t("settings.profileIdentity.name")), { target: { value: "Brouillon" } })
    fireEvent.click(screen.getByRole("button", { name: t("common.cancel") }))
    expect(updateIdentity).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: t("settings.profileIdentity.edit") })).toHaveFocus()
    edit()
    expect(screen.getByLabelText(t("settings.profileIdentity.name"))).toHaveValue(profile.displayName)
  })

  it.each(["empty", "name", "headline"])("refuse une valeur %s avant toute écriture", async (kind) => {
    const { updateIdentity } = setup()
    edit()
    const field = kind === "headline" ? "headline" : "name"
    fireEvent.change(screen.getByLabelText(t(`settings.profileIdentity.${field}`)), { target: { value: kind === "empty" ? " " : "x".repeat(kind === "headline" ? 161 : 121) } })
    save()
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
    expect(updateIdentity).not.toHaveBeenCalled()
  })

  it("conserve le brouillon sur refus et permet un nouvel essai", async () => {
    const { updateIdentity } = setup()
    updateIdentity.mockResolvedValueOnce({ ok: false, code: "rate_limited" })
    edit()
    fireEvent.change(screen.getByLabelText(t("settings.profileIdentity.name")), { target: { value: "Brouillon gardé" } })
    save()
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(getDefaultNormalizer()(t("errors.rate_limited"))))
    expect(screen.getByLabelText(t("settings.profileIdentity.name"))).toHaveValue("Brouillon gardé")
    save()
    await waitFor(() => expect(updateIdentity).toHaveBeenCalledTimes(2))
  })

  it("verrouille les doubles soumissions pendant la commande", async () => {
    const { updateIdentity } = setup()
    let finish!: (r: ActionResult) => void
    updateIdentity.mockReturnValue(new Promise((r) => { finish = r }))
    edit()
    const form = screen.getByRole("button", { name: t("settings.profileIdentity.save") }).closest("form")!
    fireEvent.submit(form); fireEvent.submit(form)
    await waitFor(() => expect(updateIdentity).toHaveBeenCalledTimes(1))
    expect(screen.getByRole("button", { name: t("common.cancel") })).toBeDisabled()
    await act(async () => { finish({ ok: true, value: null }) })
  })

  it.each(["person", "source", "withdrawal"])("ferme l'ancien brouillon au changement %s et ignore son retour tardif", async (kind) => {
    const ctx = setup()
    let finish!: (r: ActionResult) => void
    ctx.updateIdentity.mockReturnValue(new Promise((r) => { finish = r }))
    edit(); save()
    await waitFor(() => expect(ctx.updateIdentity).toHaveBeenCalledTimes(1))
    const own = kind === "person" ? { ...profile, personId: "b" } : kind === "withdrawal" ? { ...profile, published: true } : profile
    ctx.rerender(ctx.tree(own, kind === "source" ? { ...ctx.publication } : ctx.publication))
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument()
    await act(async () => { finish({ ok: false, code: "not_found" }) })
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("ne propose rien sans contrat ni identité, et respecte le verrou parent", () => {
    const ctx = setup()
    ctx.rerender(ctx.tree(profile, { ...ctx.publication, updateIdentity: undefined }))
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    ctx.rerender(ctx.tree({ ...profile, handle: null }))
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
    ctx.rerender(ctx.tree(profile, ctx.publication, true))
    expect(screen.getByRole("button")).toBeDisabled()
  })
})
