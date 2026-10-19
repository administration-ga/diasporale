// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import {
  DataSourceProvider,
  type ArrivalKitCapability,
  type ArrivalKitResourceDetailView,
  type DiasporaleDataSource,
  type MembershipView,
} from "@diasporale/features/data"
import { createDemoDataSource, createDemoSeed, DemoStore } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"

import { routes } from "@/lib/routes"

import { ArrivalKitResourceScreen, ArrivalKitScreen, zoneFromParams } from "./arrival-kit-screens"

const mocks = vi.hoisted(() => ({
  params: new URLSearchParams(),
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, prefetch: vi.fn() }),
  usePathname: () => "/kit-arrivee",
  useSearchParams: () => mocks.params,
  useParams: () => ({}),
}))
// La garde et le chrome sont isolés : ces tests vérifient l'écran branché sur la vraie
// démonstration ; l'autorisation reste jugée par le fournisseur.
vi.mock("@/components/gate", () => ({
  Gate: (props: { children: (session: { membership: MembershipView | null }) => ReactNode }) => <>{props.children({ membership: MEMBER })}</>,
  GateSkeleton: () => <div role="status" />,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: (props: { children: ReactNode }) => <>{props.children}</> }))

const NOW = Date.UTC(2026, 9, 18, 9)
const MEMBER: MembershipView = {
  personId: "p-viewer", handle: "recette", displayName: "Recette", status: "declaree", badges: ["community"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
}

function memoryStorage(): Storage {
  const items = new Map<string, string>()
  return {
    get length() { return items.size },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  }
}

function mount(viewer: string, node: ReactNode, options: { source?: DiasporaleDataSource; locale?: "fr" | "en" } = {}) {
  const state = { ...createDemoSeed(NOW), session: { personId: viewer } }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
  const source = options.source ?? createDemoDataSource(store)
  render(
    <I18nProvider locale={options.locale ?? "fr"}>
      <DataSourceProvider source={source}>{node}</DataSourceProvider>
    </I18nProvider>,
  )
  return store
}

/** Les onglets Radix s'activent à la pression du bouton principal. */
function openTab(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false })
}

function titles(list: HTMLElement) {
  return within(list).getAllByRole("article").map((card) => within(card).getByRole("heading", { level: 3 }).textContent)
}

/** Les avis (sonner) sont observés, pas affichés : aucune pile n'est montée dans ces tests. */
let toastSuccess: MockInstance<typeof toast.success>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  mocks.params = new URLSearchParams()
  mocks.push.mockReset()
  mocks.replace.mockReset()
  toastSuccess = vi.spyOn(toast, "success").mockImplementation(() => "avis")
  Object.defineProperty(window, "localStorage", { value: memoryStorage(), configurable: true })
})
afterEach(() => {
  cleanup()
  toastSuccess.mockRestore()
  vi.useRealTimers()
})

describe("la zone de l'adresse", () => {
  it("lit le pays et la ville saisie ; une valeur illisible est ignorée", () => {
    expect(zoneFromParams(new URLSearchParams("pays=ca&ville=%20Montr%C3%A9al%20"), "FR")).toEqual({ country: "CA", city: "Montréal" })
    expect(zoneFromParams(new URLSearchParams("pays=GA"), "FR")).toEqual({ country: "FR", city: null })
    expect(zoneFromParams(new URLSearchParams(`ville=${"x".repeat(81)}`), "BE")).toEqual({ country: "BE", city: null })
  })
})

describe("/kit-arrivee — le kit d'un pays et d'une ville", () => {
  it("la ville saisie, puis tout le pays : date de vérification, « à revoir » et ressource officielle se voient", async () => {
    mocks.params = new URLSearchParams("pays=FR&ville=Paris")
    mount("p-rodrigue", <ArrivalKitScreen />)
    expect(screen.getByRole("heading", { level: 1, name: "Kit d'arrivée" })).toBeInTheDocument()
    const paris = await screen.findByRole("list", { name: "À Paris" })
    expect(titles(paris)).toEqual(["Ouvrir un premier compte bancaire à Paris (démo)", "Se soigner à Paris : centres de santé de quartier (démo)"])
    const [bank, health] = within(paris).getAllByRole("article")
    expect(within(bank!).getByRole("link", { name: "Ouvrir un premier compte bancaire à Paris (démo)" })).toHaveAttribute("href", routes.arrivalKitResource("kit-2"))
    expect(within(bank!).getByText(/^Vérifiée le /)).toBeInTheDocument()
    expect(within(bank!).getByText("Ressource communautaire")).toBeInTheDocument()
    expect(within(health!).getByText("À revoir")).toBeInTheDocument()
    expect(within(health!).getByText("Sa source a été vérifiée il y a plus de douze mois.")).toBeInTheDocument()

    const national = await screen.findByRole("list", { name: "Dans tout le pays (France)" })
    expect(titles(national)).toEqual(["Numéros d'urgence en France (démo)", "S'inscrire au registre consulaire (démo)"])
    const consular = within(national).getAllByRole("article")[1]!
    expect(within(consular).getByText("Ressource officielle")).toBeInTheDocument()
    expect(within(consular).getByRole("link", { name: "Poste consulaire de démonstration — France" })).toHaveAttribute("href", routes.page("poste-demo-france"))
    // Aucune ressource soumise ou en brouillon dans le kit public.
    expect(screen.queryByText("Abonnements de transport à Lyon (démo)")).not.toBeInTheDocument()
  })

  it("choisir une autre zone réécrit l'adresse partageable ; une rubrique restreint la lecture", async () => {
    mocks.params = new URLSearchParams("pays=FR")
    mount("p-rodrigue", <ArrivalKitScreen />)
    const france = await screen.findByRole("list", { name: "Ressources pour France" })
    expect(titles(france)).toHaveLength(5)
    fireEvent.change(screen.getByLabelText("Rubrique"), { target: { value: "health" } })
    expect(titles(await screen.findByRole("list", { name: "Ressources pour France" }))).toEqual(["Se soigner à Paris : centres de santé de quartier (démo)"])
    fireEvent.change(screen.getByLabelText("Ville (facultatif)"), { target: { value: " Lyon " } })
    fireEvent.click(screen.getByRole("button", { name: "Afficher" }))
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(routes.arrivalKit("FR", "Lyon")))
  })

  it("une zone sans ressource relue : le vide s'explique et invite à proposer", async () => {
    mocks.params = new URLSearchParams("pays=CA&ville=Toronto")
    mount("p-rodrigue", <ArrivalKitScreen />)
    expect(await screen.findAllByText("Aucune ressource relue pour cette zone")).toHaveLength(2)
    expect(screen.getAllByText(/Les ressources apparaissent ici après la relecture d'une autre personne/)).toHaveLength(2)
    // Le bouton de l'en-tête et celui du vide de la ville.
    expect(screen.getAllByRole("button", { name: "Proposer une ressource" })).toHaveLength(2)
  })

  it("sans la capacité, l'écran dit « indisponible » au lieu d'inventer", () => {
    mount("p-rodrigue", <ArrivalKitScreen />, { source: { kind: "demo" } as DiasporaleDataSource })
    expect(screen.getByText("Le kit d'arrivée n'est pas encore disponible ici.")).toBeInTheDocument()
  })

  it("la file de relecture n'existe que pour les relecteurs habilités", async () => {
    mocks.params = new URLSearchParams("pays=FR")
    mount("p-rodrigue", <ArrivalKitScreen />)
    await screen.findAllByRole("button", { name: "Proposer une ressource" })
    expect(screen.queryByRole("tab", { name: "À relire" })).not.toBeInTheDocument()
    cleanup()

    mount("p-prisca", <ArrivalKitScreen />)
    await screen.findByRole("tab", { name: "À relire" })
    openTab("À relire")
    const queue = await screen.findByRole("list", { name: "File de relecture" })
    expect(titles(queue)).toEqual(["Abonnements de transport à Lyon (démo)"])
    expect(within(queue).getByText(/^Soumise le /)).toBeInTheDocument()
    expect(within(queue).getByText("Soumise à la relecture")).toBeInTheDocument()
  })

  it("mes propositions : tous leurs états, et le motif d'un renvoi", async () => {
    mocks.params = new URLSearchParams("pays=FR")
    mount("p-prisca", <ArrivalKitScreen />)
    await screen.findByRole("tab", { name: "Mes propositions" })
    openTab("Mes propositions")
    const mine = await screen.findByRole("list", { name: "Mes propositions" })
    const [draft] = within(mine).getAllByRole("article")
    expect(within(draft!).getByRole("heading", { level: 3 }).textContent).toBe("Rencontrer les associations culturelles à Bordeaux (démo)")
    expect(within(draft!).getByText("Brouillon")).toBeInTheDocument()
    expect(within(draft!).getByText(/^Motif : Précisez quelles associations/)).toBeInTheDocument()
  })

  it("proposer : la règle du domaine s'applique avant l'envoi, puis la fiche de la nouvelle ressource s'ouvre", async () => {
    mocks.params = new URLSearchParams("pays=CA&ville=Montréal")
    mount("p-rodrigue", <ArrivalKitScreen />)
    fireEvent.click((await screen.findAllByRole("button", { name: "Proposer une ressource" }))[0]!)
    const dialog = await screen.findByRole("dialog", { name: "Proposer une ressource" })
    expect(within(dialog).getByLabelText("Ville (facultatif)")).toHaveValue("Montréal")
    expect(within(dialog).getByLabelText("Date de dernière vérification")).toHaveValue("2026-10-18")
    fireEvent.change(within(dialog).getByLabelText("Titre"), { target: { value: "Ouvrir un compte bancaire à Montréal (démo)" } })
    fireEvent.change(within(dialog).getByLabelText("Résumé"), { target: { value: "Les pièces demandées et les délais constatés pour un premier compte." } })
    fireEvent.change(within(dialog).getByLabelText("Contenu"), { target: { value: "Prenez rendez-vous avec une pièce d'identité et votre permis d'études ou de travail." } })
    fireEvent.change(within(dialog).getByLabelText("Rubrique"), { target: { value: "banking" } })
    fireEvent.change(within(dialog).getByLabelText("Nom de la source"), { target: { value: "Portail public d'information bancaire" } })
    fireEvent.change(within(dialog).getByLabelText("Adresse de la source"), { target: { value: "http://www.exemple-public.ca/compte" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Soumettre à la relecture" }))
    expect(await within(dialog).findByText("L'adresse de la source doit commencer par https://.")).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()

    fireEvent.change(within(dialog).getByLabelText("Adresse de la source"), { target: { value: "https://www.exemple-public.ca/compte?utm_source=lettre" } })
    fireEvent.click(within(dialog).getByRole("button", { name: "Soumettre à la relecture" }))
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(routes.arrivalKitResource("kit-20")))
    expect(toastSuccess).toHaveBeenCalledWith("Ressource soumise à la relecture.")
  })

  it("en anglais, les mêmes surfaces", async () => {
    mocks.params = new URLSearchParams("pays=FR")
    mount("p-rodrigue", <ArrivalKitScreen />, { locale: "en" })
    expect(screen.getByRole("heading", { level: 1, name: "Arrival kit" })).toBeInTheDocument()
    expect(await screen.findByRole("list", { name: "Resources for France" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "My proposals" })).toBeInTheDocument()
  })
})

describe("/kit-arrivee/<id> — la fiche", () => {
  it("contenu, source fictive sans lien, autrice et relectrice nommées, dates ; signaler une information périmée", async () => {
    mount("p-rodrigue", <ArrivalKitResourceScreen resourceId="kit-2" />)
    expect(await screen.findByRole("heading", { level: 1, name: "Ouvrir un premier compte bancaire à Paris (démo)" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Retour au kit d'arrivée" })).toHaveAttribute("href", routes.arrivalKit("FR", "Paris"))
    expect(screen.getByText("Portail public d'information bancaire (source fictive)")).toBeInTheDocument()
    expect(screen.getByText("Source fictive de démonstration : aucun lien n'est proposé.")).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: /Portail public/ })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Mireille Ivindo" })).toHaveAttribute("href", routes.profile("mireille.ivindo"))
    expect(screen.getByRole("link", { name: "Prisca Abanga" })).toHaveAttribute("href", routes.profile("prisca.abanga"))
    expect(screen.getByText("Vérifiée auprès de la source le")).toBeInTheDocument()
    expect(screen.getByText("À revoir à partir du")).toBeInTheDocument()
    expect(screen.getByText(/Ressource communautaire relue par une autre personne/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Signaler une information périmée" }))
    const dialog = await screen.findByRole("dialog", { name: "Signaler une information périmée" })
    fireEvent.click(within(dialog).getByLabelText("L'information a changé"))
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Envoyer le signalement" })) })
    expect(await screen.findByText("Merci : votre signalement est enregistré.")).toBeInTheDocument()
    expect(await screen.findByText("Vous avez signalé cette version comme périmée.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Signaler une information périmée" })).not.toBeInTheDocument()
  })

  it("une ressource « à revoir » le dit en tête de fiche, avec sa cause", async () => {
    mount("p-rodrigue", <ArrivalKitResourceScreen resourceId="kit-3" />)
    const note = await screen.findByRole("note")
    expect(within(note).getByText("À revoir")).toBeInTheDocument()
    expect(within(note).getByText("Sa source a été vérifiée il y a plus de douze mois.")).toBeInTheDocument()
  })

  it("une soumission ne se lit que par une relectrice habilitée ; elle la publie", async () => {
    mount("p-rodrigue", <ArrivalKitResourceScreen resourceId="kit-5" />)
    expect(await screen.findByText("Cette ressource n'est pas disponible.")).toBeInTheDocument()
    cleanup()

    mount("p-prisca", <ArrivalKitResourceScreen resourceId="kit-5" />)
    expect(await screen.findByRole("heading", { level: 1, name: "Abonnements de transport à Lyon (démo)" })).toBeInTheDocument()
    expect(screen.getByText("Soumise : une autre personne habilitée doit la relire avant sa publication.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Collectif Ivindo de Lyon (démo)" })).toHaveAttribute("href", routes.page("collectif-ivindo-lyon"))
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Publier" })) })
    expect(await screen.findByText("Ressource publiée dans le kit.")).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Prisca Abanga" })).toHaveAttribute("href", routes.profile("prisca.abanga"))
  })

  it("renvoyer exige un motif ; la ressource renvoyée quitte la relectrice, qui revient au kit", async () => {
    mount("p-prisca", <ArrivalKitResourceScreen resourceId="kit-5" />)
    fireEvent.click(await screen.findByRole("button", { name: "Renvoyer à l'auteur" }))
    const dialog = await screen.findByRole("dialog", { name: "Renvoyer la ressource à son auteur" })
    const reason = within(dialog).getByLabelText("Motif (obligatoire)")
    fireEvent.change(reason, { target: { value: "court" } })
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Confirmer" })) })
    expect(await within(dialog).findByText("Précisez le motif.")).toBeInTheDocument()
    fireEvent.change(reason, { target: { value: "Précisez les réductions pour les étudiants." } })
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Confirmer" })) })
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(routes.arrivalKit("FR", "Lyon")))
    expect(toastSuccess).toHaveBeenCalledWith("Ressource renvoyée à son auteur.")
  })

  it("son autrice lit le motif du renvoi, soumet de nouveau son brouillon, et peut le retirer", async () => {
    mount("p-prisca", <ArrivalKitResourceScreen resourceId="kit-9" />)
    expect(await screen.findByText(/^Motif : Précisez quelles associations/)).toBeInTheDocument()
    expect(screen.getByText(/^Brouillon : seules les personnes qui la gèrent la voient/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Modifier" })).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Soumettre à la relecture" })) })
    expect(await screen.findByText("Brouillon soumis à la relecture.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Retirer la ressource" }))
    // Le nom accessible garde l'espace insécable française : on le cherche par son début.
    const dialog = await screen.findByRole("dialog", { name: /^Retirer cette ressource/ })
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Retirer" })) })
    expect(await screen.findByText("Ressource retirée du kit.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument()
  })
})

describe("/kit-arrivee/<id> — le lien externe de la source", () => {
  const DETAIL: ArrivalKitResourceDetailView = {
    id: "r-1", version: 2, revision: 1, title: "Ressource fictive", summary: "Un résumé fictif de la ressource.", category: "procedures",
    country: "FR", city: null, status: "published", reviewCause: null, lastVerifiedAt: NOW - 86_400_000, reviewDueAt: NOW + 300 * 86_400_000,
    revisedAt: NOW - 86_400_000, reviewedAt: NOW, carrier: { kind: "page", page: { id: "page-1", handle: "poste-fictif", name: "Poste fictif", badge: "official", ownerKind: "institution" } },
    official: true, body: "Un contenu fictif.", source: { name: "Portail fictif", url: "https://www.exemple-public.fr/demarche" }, createdAt: NOW - 86_400_000,
    submittedAt: NOW - 86_400_000, reviewer: { displayName: null, handle: null }, statusReason: null, outdatedFlags: null,
    viewer: { canManage: false, canReview: false, canFlag: false, hasFlagged: false },
  }

  function engineSource(detail: ArrivalKitResourceDetailView): DiasporaleDataSource {
    const kit = { useResource: () => ({ status: "ready", data: detail }) } as unknown as ArrivalKitCapability
    return { kind: "engine", arrivalKit: kit } as unknown as DiasporaleDataSource
  }

  it("s'ouvre dans un nouvel onglet signalé, sans référent ; la page officielle le dit", () => {
    mount("p-rodrigue", <ArrivalKitResourceScreen resourceId="r-1" />, { source: engineSource(DETAIL) })
    const link = screen.getByRole("link", { name: "Portail fictif (s'ouvre dans un nouvel onglet)" })
    expect(link).toHaveAttribute("href", "https://www.exemple-public.fr/demarche")
    expect(link).toHaveAttribute("target", "_blank")
    expect(link).toHaveAttribute("rel", "noopener noreferrer")
    expect(screen.getByText("Adresse : https://www.exemple-public.fr/demarche")).toBeInTheDocument()
    expect(screen.getByText("Ressource portée par une page au badge Officiel.")).toBeInTheDocument()
    // Le relecteur au profil retiré : le nom neutre, jamais une devinette.
    expect(screen.getByText("Membre de DIASPORALE")).toBeInTheDocument()
  })

  it("une adresse qui n'est pas https n'est jamais cliquable", () => {
    mount("p-rodrigue", <ArrivalKitResourceScreen resourceId="r-1" />, { source: engineSource({ ...DETAIL, source: { name: "Portail fictif", url: "javascript:alert(1)" } }) })
    expect(screen.queryByRole("link", { name: /Portail fictif/ })).not.toBeInTheDocument()
    expect(screen.getByText("Aucun lien sûr n'est disponible pour cette source.")).toBeInTheDocument()
  })
})
