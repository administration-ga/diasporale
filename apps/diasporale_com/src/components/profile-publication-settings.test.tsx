// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import type { ActionResult, DiasporaleDataSource, Loadable, MembershipView, OwnProfileView } from "@diasporale/features/data"
import { getFixedT } from "@diasporale/features/i18n"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, getDefaultNormalizer, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ProfilePublicationSettings } from "./profile-publication-settings"

type Publication = NonNullable<DiasporaleDataSource["profilePublication"]>

const mocks = vi.hoisted(() => ({
  source: { kind: "engine" } as Pick<DiasporaleDataSource, "kind" | "profilePublication">,
  profile: { status: "loading" } as Loadable<OwnProfileView | null>,
  read: vi.fn(),
  setPrivacy: vi.fn<Publication["setPrivacy"]>(),
  withdraw: vi.fn<Publication["withdraw"]>(),
  republish: vi.fn<Publication["republish"]>(),
  reload: vi.fn(),
}))

vi.mock("@diasporale/features/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@diasporale/features/data")>()),
  useDataSource: () => mocks.source,
}))

const publication: Publication = {
  useMyProfile: () => { mocks.read(); return mocks.profile },
  setPrivacy: mocks.setPrivacy,
  withdraw: mocks.withdraw,
  republish: mocks.republish,
}
const membership: MembershipView = {
  personId: "persons_awa",
  handle: "awa.demo",
  displayName: "Awa",
  status: "declaree",
  badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1,
  verifiedSince: null,
  sponsoredBy: null,
  attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" },
  canPublish: true,
  rateTier: "reinforced",
  directoryVisibility: "hidden",
}
const own: OwnProfileView = {
  personId: membership.personId,
  handle: membership.handle,
  displayName: membership.displayName,
  headline: "Accroche choisie et conservée",
  published: true,
  private: false,
}
const t = getFixedT("fr")
// Les requêtes de texte et jest-dom normalisent les espaces, y compris insécables.
const normalizeText = getDefaultNormalizer()

function tree(member = membership, locale: "fr" | "en" = "fr") {
  return <I18nProvider key={locale} locale={locale}><ProfilePublicationSettings membership={member} /></I18nProvider>
}

function pendingResult() {
  let finish: (result: ActionResult) => void = () => {}
  const promise = new Promise<ActionResult>((resolve) => { finish = resolve })
  return { promise, finish }
}

function openWithdrawal() {
  const trigger = screen.getByRole("button", { name: t("settings.profilePublication.withdraw") })
  fireEvent.click(trigger)
  const dialog = screen.getByRole("dialog", { name: t("settings.profilePublication.confirm.withdraw.title") })
  return { trigger, dialog, confirm: within(dialog).getByRole("button", { name: t("settings.profilePublication.confirm.withdraw.confirm") }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.source = { kind: "engine", profilePublication: publication }
  mocks.profile = { status: "ready", data: own }
  mocks.setPrivacy.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.withdraw.mockReset().mockResolvedValue({ ok: true, value: null })
  mocks.republish.mockReset().mockResolvedValue({ ok: true, value: null })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("ProfilePublicationSettings — profil commun et commandes personnelles", () => {
  it.each(["engine", "demo"] as const)("sans capacité %s, ne monte aucun panneau ni lecture personnelle", (kind) => {
    mocks.source = { kind }
    const { container } = render(tree())

    expect(container).toBeEmptyDOMElement()
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it.each(["fr", "en"] as const)("nomme le panneau et la portée globale en %s, avec les trois conséquences distinctes", (locale) => {
    const translate = getFixedT(locale)
    render(tree(membership, locale))

    expect(screen.getByRole("region", { name: translate("settings.profilePublication.title") })).toHaveAttribute("id", "profil")
    expect(screen.getByText(normalizeText(translate("settings.profilePublication.globalScope")))).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent(normalizeText(translate("settings.profilePublication.state.published")))
    expect(screen.getByText(normalizeText(translate("settings.profilePublication.privateLead")))).toBeInTheDocument()
    expect(screen.getByText(normalizeText(translate("settings.profilePublication.withdrawLead")))).toBeInTheDocument()
    expect(screen.getByRole("button", { name: translate("settings.profilePublication.makePrivate") })).toBeEnabled()
    expect(screen.queryByRole("button", { name: translate("settings.profilePublication.republish") })).not.toBeInTheDocument()
  })

  it.each(["engine", "demo"] as const)("en attente, conserve la protection personnelle avec la capacité %s", async (kind) => {
    mocks.source = { kind, profilePublication: publication }
    render(tree({ ...membership, status: "en_attente", canPublish: false }))

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("settings.profilePublication.makePrivate") })) })

    expect(mocks.setPrivacy).toHaveBeenCalledExactlyOnceWith(membership.personId, true)
    expect(mocks.withdraw).not.toHaveBeenCalled()
    expect(mocks.republish).not.toHaveBeenCalled()
  })

  it("le profil privé publié peut redevenir découvrable, sans republication", async () => {
    mocks.profile = { status: "ready", data: { ...own, private: true } }
    render(tree())

    expect(screen.getByRole("status")).toHaveTextContent(normalizeText(t("settings.profilePublication.state.private")))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("settings.profilePublication.makeDiscoverable") })) })
    expect(mocks.setPrivacy).toHaveBeenCalledExactlyOnceWith(membership.personId, false)
    expect(mocks.republish).not.toHaveBeenCalled()
  })

  it("le chargement n'offre aucune commande ; une erreur reste générique et se recharge réellement", () => {
    mocks.profile = { status: "loading" }
    const view = render(tree())
    expect(screen.getByRole("status")).toHaveTextContent(normalizeText(t("common.pleaseWait")))
    expect(screen.queryByRole("button")).not.toBeInTheDocument()

    mocks.profile = { status: "error", code: "diagnostic personnel à ne pas afficher" }
    view.rerender(tree())
    expect(screen.getByRole("alert")).toHaveTextContent(normalizeText(t("settings.profilePublication.loadError")))
    expect(screen.queryByText(/diagnostic personnel/)).not.toBeInTheDocument()
    vi.stubGlobal("window", new Proxy(window, {
      get(target, property) { return property === "location" ? { reload: mocks.reload } : Reflect.get(target, property, target) },
    }))
    fireEvent.click(screen.getByRole("button", { name: t("settings.profilePublication.reload") }))
    expect(mocks.reload).toHaveBeenCalledOnce()
    expect(mocks.setPrivacy).not.toHaveBeenCalled()
  })

  it.each([null, { ...own, personId: "persons_autre", displayName: "Identité étrangère" }])("ferme toute commande pour une fiche absente ou étrangère", (profile) => {
    mocks.profile = { status: "ready", data: profile }
    render(tree())

    expect(screen.getByText(normalizeText(t("settings.profilePublication.unavailable")))).toBeInTheDocument()
    expect(screen.queryByText("Identité étrangère")).not.toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("le retrait exige une confirmation décrite, donne d'abord le focus à Annuler et le restitue après Échap", async () => {
    render(tree())
    const { trigger, dialog } = openWithdrawal()

    expect(dialog).toHaveAccessibleDescription(t("settings.profilePublication.confirm.withdraw.body"))
    await waitFor(() => expect(within(dialog).getByRole("button", { name: t("common.cancel") })).toHaveFocus())
    expect(mocks.withdraw).not.toHaveBeenCalled()
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" })
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    expect(mocks.withdraw).not.toHaveBeenCalled()
  })

  it("Annuler ferme immédiatement l'autorisation, même si l'ancien bouton de confirmation est actionné dans le même rendu", () => {
    render(tree())
    const { dialog, confirm } = openWithdrawal()

    act(() => {
      within(dialog).getByRole("button", { name: t("common.cancel") }).dispatchEvent(new MouseEvent("click", { bubbles: true }))
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })

    expect(mocks.withdraw).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("un verrou immédiat empêche deux retraits et une commande de confidentialité concurrente", async () => {
    const pending = pendingResult()
    mocks.withdraw.mockReturnValueOnce(pending.promise)
    render(tree())
    const privacy = screen.getByRole("button", { name: t("settings.profilePublication.makePrivate") })
    const { confirm } = openWithdrawal()

    act(() => {
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      confirm.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      privacy.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    expect(mocks.withdraw).toHaveBeenCalledExactlyOnceWith(membership.personId)
    expect(mocks.setPrivacy).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: t("settings.profilePublication.working") })).toBeDisabled()

    await act(async () => { pending.finish({ ok: true, value: null }); await pending.promise })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("la confidentialité porte le même verrou avant le rendu suivant", async () => {
    const pending = pendingResult()
    mocks.setPrivacy.mockReturnValueOnce(pending.promise)
    render(tree())
    const button = screen.getByRole("button", { name: t("settings.profilePublication.makePrivate") })

    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
    })
    expect(mocks.setPrivacy).toHaveBeenCalledExactlyOnceWith(membership.personId, true)
    expect(screen.getByRole("button", { name: t("settings.profilePublication.withdraw") })).toBeDisabled()
    await act(async () => { pending.finish({ ok: true, value: null }); await pending.promise })
  })

  it("un retrait refusé garde la confirmation ouverte, traduit le refus et permet un réessai explicite", async () => {
    mocks.withdraw.mockResolvedValueOnce({ ok: false, code: "rate_limited" })
    render(tree())
    const { confirm } = openWithdrawal()
    await act(async () => { fireEvent.click(confirm) })

    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent(normalizeText(t("errors.rate_limited")))
    const retry = screen.getByRole("button", { name: t("settings.profilePublication.confirm.withdraw.confirm") })
    expect(retry).toBeEnabled()
    await act(async () => { fireEvent.click(retry) })

    expect(mocks.withdraw).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("une exception reste générique et déverrouille la confidentialité", async () => {
    mocks.setPrivacy.mockRejectedValueOnce(new Error("contenu privé du transport"))
    render(tree())
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("settings.profilePublication.makePrivate") })) })

    expect(screen.getByRole("alert")).toHaveTextContent(normalizeText(t("errors.unknown")))
    expect(screen.queryByText(/contenu privé/)).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("settings.profilePublication.makePrivate") })).toBeEnabled()
  })

  it("le profil retiré reste accessible en attente et exige une republication distincte, sans changer le mode privé", async () => {
    mocks.profile = { status: "ready", data: { ...own, published: false, private: true } }
    const member = { ...membership, status: "en_attente" as const, canPublish: false }
    const view = render(tree(member))

    expect(screen.getByRole("status")).toHaveTextContent(normalizeText(t("settings.profilePublication.state.withdrawn")))
    expect(screen.getByRole("button", { name: t("settings.profilePublication.makeDiscoverable") })).toBeEnabled()
    expect(screen.getByText(normalizeText(t("settings.profilePublication.privacyOn")))).toBeInTheDocument()
    expect(screen.getByText(normalizeText(t("settings.profilePublication.republishLead")))).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: t("settings.profilePublication.republish") }))
    const dialog = screen.getByRole("dialog", { name: t("settings.profilePublication.confirm.republish.title") })
    expect(dialog).toHaveAccessibleDescription(t("settings.profilePublication.confirm.republish.body"))
    expect(mocks.republish).not.toHaveBeenCalled()
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: t("settings.profilePublication.confirm.republish.confirm") })) })

    expect(mocks.republish).toHaveBeenCalledExactlyOnceWith(membership.personId)
    expect(mocks.setPrivacy).not.toHaveBeenCalled()
    expect(mocks.withdraw).not.toHaveBeenCalled()
    mocks.profile = { status: "ready", data: { ...own, private: true } }
    view.rerender(tree(member))
    expect(screen.getByRole("status")).toHaveTextContent(normalizeText(t("settings.profilePublication.state.private")))
  })

  it("un profil retiré encore public peut activer le privé avant toute republication", async () => {
    mocks.profile = { status: "ready", data: { ...own, published: false } }
    const view = render(tree())
    expect(screen.getByText(normalizeText(t("settings.profilePublication.privacyOff")))).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("settings.profilePublication.makePrivate") })) })

    expect(mocks.setPrivacy).toHaveBeenCalledExactlyOnceWith(membership.personId, true)
    expect(mocks.republish).not.toHaveBeenCalled()
    mocks.profile = { status: "ready", data: { ...own, published: false, private: true } }
    view.rerender(tree())
    expect(screen.getByRole("status")).toHaveTextContent(normalizeText(t("settings.profilePublication.state.withdrawn")))
    expect(screen.getByText(normalizeText(t("settings.profilePublication.privacyOn")))).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: t("settings.profilePublication.republish") }))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t("settings.profilePublication.confirm.republish.confirm") })) })

    expect(mocks.republish).toHaveBeenCalledExactlyOnceWith(membership.personId)
    expect(mocks.setPrivacy).toHaveBeenCalledOnce()
  })

  it("ne fabrique pas de republication quand l'identité conservée manque", () => {
    mocks.profile = { status: "ready", data: { ...own, published: false, handle: null, displayName: null } }
    render(tree())

    expect(screen.getByRole("status")).toHaveTextContent(normalizeText(t("settings.profilePublication.state.unpublished")))
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it.each([{ private: true }, { published: false }, { headline: "Nouvelle accroche" }])("un changement pertinent du profil ferme la confirmation : %o", (patch) => {
    const view = render(tree())
    openWithdrawal()
    mocks.profile = { status: "ready", data: { ...own, ...patch } }
    view.rerender(tree())

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.withdraw).not.toHaveBeenCalled()
  })

  it("le remplacement du fournisseur ferme une ancienne confirmation sans appeler l'ancienne ni la nouvelle commande", () => {
    const view = render(tree())
    openWithdrawal()
    const replacement = { ...publication, withdraw: vi.fn<Publication["withdraw"]>() }
    mocks.source = { kind: "engine", profilePublication: replacement }
    view.rerender(tree())

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(mocks.withdraw).not.toHaveBeenCalled()
    expect(replacement.withdraw).not.toHaveBeenCalled()
  })

  it("le résultat d'un fournisseur remplacé est ignoré même pour la même personne", async () => {
    const pending = pendingResult()
    mocks.setPrivacy.mockReturnValueOnce(pending.promise)
    const view = render(tree())
    fireEvent.click(screen.getByRole("button", { name: t("settings.profilePublication.makePrivate") }))
    mocks.source = { kind: "engine", profilePublication: { ...publication } }
    view.rerender(tree())
    await act(async () => { pending.finish({ ok: false, code: "rate_limited" }); await pending.promise })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("settings.profilePublication.makePrivate") })).toBeEnabled()
    expect(mocks.setPrivacy).toHaveBeenCalledExactlyOnceWith(membership.personId, true)
  })

  it("un résultat tardif du lecteur précédent ne produit aucun avis ni commande pour le nouveau lecteur", async () => {
    const pending = pendingResult()
    mocks.withdraw.mockReturnValueOnce(pending.promise)
    const view = render(tree())
    fireEvent.click(openWithdrawal().confirm)

    const other = { ...membership, personId: "persons_autre", handle: "autre.demo", displayName: "Autre" }
    mocks.profile = { status: "ready", data: { ...own, personId: other.personId, handle: other.handle, displayName: other.displayName } }
    view.rerender(tree(other))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await act(async () => { pending.finish({ ok: false, code: "rate_limited" }); await pending.promise })

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: t("settings.profilePublication.makePrivate") })).toBeEnabled()
    expect(mocks.withdraw).toHaveBeenCalledExactlyOnceWith(membership.personId)
    expect(mocks.setPrivacy).not.toHaveBeenCalled()
    expect(mocks.republish).not.toHaveBeenCalled()
  })
})

it("verrouille la republication dès la validation d'une édition et jusqu'à sa réponse", async () => {
  const pending = pendingResult()
  const updateIdentity = vi.fn().mockReturnValue(pending.promise)
  mocks.source = { kind: "engine", profilePublication: { ...publication, updateIdentity } }
  mocks.profile = { status: "ready", data: { ...own, published: false } }
  render(tree())
  fireEvent.click(screen.getByRole("button", { name: t("settings.profileIdentity.edit") }))
  fireEvent.change(screen.getByLabelText(t("settings.profileIdentity.name")), { target: { value: "Correction conservée" } })
  const save = screen.getByRole("button", { name: t("settings.profileIdentity.save") })
  fireEvent.submit(save.closest("form")!)
  const republish = screen.getByRole("button", { name: t("settings.profilePublication.republish") })
  expect(republish).toBeDisabled()
  fireEvent.click(republish)
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  await waitFor(() => expect(updateIdentity).toHaveBeenCalledExactlyOnceWith(own.personId, { displayName: "Correction conservée", headline: own.headline }))
  expect(mocks.republish).not.toHaveBeenCalled()
  await act(async () => { pending.finish({ ok: false, code: "rate_limited" }) })
  expect(screen.getByLabelText(t("settings.profileIdentity.name"))).toHaveValue("Correction conservée")
  expect(republish).toBeEnabled()
})
