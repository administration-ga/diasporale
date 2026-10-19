// @vitest-environment jsdom
import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import {
  DataSourceProvider,
  type AidItemView,
  type AidListPage,
  type DiasporaleDataSource,
  type Loadable,
  type ManagedModerationState,
  type MembershipView,
  type MutualAidCapability,
} from "@diasporale/features/data"
import { createDemoDataSource, createDemoSeed, DemoStore } from "@diasporale/features/demo"
import { I18nProvider } from "@diasporale/features/i18n/client"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { useMemo, type ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { routes } from "@/lib/routes"

import { aidFilterFromParams, MutualAidItemScreen, MutualAidScreen } from "./mutual-aid-screens"

const mocks = vi.hoisted(() => ({ gate: vi.fn(), push: vi.fn(), replace: vi.fn(), params: new URLSearchParams() }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace, prefetch: vi.fn() }),
  usePathname: () => "/entraide",
  useSearchParams: () => mocks.params,
  useParams: () => ({}),
}))
// La garde et le chrome sont isolés : ces tests vérifient l'écran branché sur la
// vraie démonstration ; l'autorisation reste jugée par le fournisseur.
vi.mock("@/components/gate", () => ({
  Gate: (props: { require: string; children: (session: { membership: MembershipView | null }) => ReactNode }) => {
    mocks.gate(props.require)
    return <>{props.children({ membership: MEMBER })}</>
  },
  GateSkeleton: () => <div role="status" />,
}))
vi.mock("@/components/app-shell", () => ({ AppShell: (props: { children: ReactNode }) => <>{props.children}</> }))

const NOW = Date.UTC(2026, 9, 18, 9)
const MEMBER: MembershipView = {
  personId: "p-viewer", handle: "recette", displayName: "Recette", status: "verifiee", badges: ["verified"],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: 1, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "verifiee", derivedFrom: "diasporale" }, canPublish: true, rateTier: "standard", directoryVisibility: "hidden",
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

/**
 * G9 — un fournisseur qui pose `moderation` sur CHAQUE vue de l'entraide (la démonstration ne
 * modère jamais ; le moteur ne le sert qu'à qui gère) : l'écran ne doit le dire que dans les vues
 * de gestion, jamais à un autre lecteur. Chaque lecture garde sa référence (fenêtres stables).
 */
function stampModeration(base: MutualAidCapability, moderation: ManagedModerationState): MutualAidCapability {
  const stamp = <Row extends object>(row: Row): Row => ({ ...row, moderation })
  const stampPage = <Row extends object>(loaded: Loadable<AidListPage<Row>>): Loadable<AidListPage<Row>> =>
    loaded.status === "ready" ? { status: "ready", data: { ...loaded.data, items: loaded.data.items.map(stamp) } } : loaded
  return {
    ...base,
    useQuestions(request) {
      const loaded = base.useQuestions(request)
      return useMemo(() => stampPage(loaded), [loaded])
    },
    useMyQuestions(args) {
      const loaded = base.useMyQuestions(args)
      return useMemo(() => stampPage(loaded), [loaded])
    },
    useAnswers(args) {
      const loaded = base.useAnswers(args)
      return useMemo(() => stampPage(loaded), [loaded])
    },
    useMissions(request) {
      const loaded = base.useMissions(request)
      return useMemo(() => stampPage(loaded), [loaded])
    },
    useMySignups(args) {
      const loaded = base.useMySignups(args)
      return useMemo(() => stampPage(loaded), [loaded])
    },
    usePageMissions(args) {
      const loaded = base.usePageMissions(args)
      return useMemo(() => stampPage(loaded), [loaded])
    },
    useItem(itemId) {
      const loaded = base.useItem(itemId)
      return useMemo((): Loadable<AidItemView | null> => {
        if (loaded.status !== "ready" || loaded.data === null) return loaded
        const found = loaded.data
        return {
          status: "ready",
          data: found.kind === "question" ? { kind: "question", question: stamp(found.question) } : { kind: "mission", mission: stamp(found.mission) },
        }
      }, [loaded])
    },
  }
}

function mount(viewer: string, screenNode: ReactNode, options: { withCapability?: boolean; locale?: "fr" | "en"; moderation?: ManagedModerationState } = {}) {
  const state = { ...createDemoSeed(NOW), session: { personId: viewer } }
  const store = new DemoStore({ getItem: () => JSON.stringify(state), setItem: () => undefined, removeItem: () => undefined }, () => NOW, 0)
  const demo = options.withCapability === false ? ({} as DiasporaleDataSource) : createDemoDataSource(store)
  const source = options.moderation && demo.mutualAid ? { ...demo, mutualAid: stampModeration(demo.mutualAid, options.moderation) } : demo
  render(
    <I18nProvider locale={options.locale ?? "fr"}>
      <DataSourceProvider source={source}>{screenNode}</DataSourceProvider>
    </I18nProvider>,
  )
  return store
}

/** Les onglets Radix s'activent à la pression du bouton principal. */
function openTab(name: string) {
  fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0, ctrlKey: false })
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", { value: memoryStorage(), configurable: true })
  // L'horloge de l'écran (borne des missions « à venir ») et celle du jeu fictif sont les mêmes ;
  // seules les dates sont simulées, la latence de la démonstration reste réelle.
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  mocks.params = new URLSearchParams()
  mocks.push.mockReset()
  mocks.replace.mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("/entraide — questions et missions d'un pays", () => {
  it("le pays du membre par défaut ; l'adresse porte le pays et la ville saisie, une valeur illisible est ignorée", () => {
    expect(aidFilterFromParams(new URLSearchParams(), "FR")).toEqual({ country: "FR", city: "" })
    expect(aidFilterFromParams(new URLSearchParams("pays=be&ville=%20Li%C3%A8ge%20"), "FR")).toEqual({ country: "BE", city: "Liège" })
    expect(aidFilterFromParams(new URLSearchParams("pays=GA"), "FR")).toEqual({ country: "FR", city: "" })
  })

  it("les questions ouvertes, puis résolues ; les missions à venir et « Proposer » pour l'équipe vivante", async () => {
    mount("p-steeve", <MutualAidScreen />)
    expect(mocks.gate).toHaveBeenCalledWith("member")
    expect(screen.getByRole("heading", { level: 1, name: "Entraide" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Questions" })).toHaveAttribute("aria-selected", "true")
    expect(await screen.findByRole("link", { name: /Renouveler un titre de séjour/ })).toHaveAttribute("href", routes.mutualAidItem("aid-q-2"))

    fireEvent.change(screen.getByLabelText("Afficher"), { target: { value: "resolved" } })
    const resolved = await screen.findByRole("link", { name: "Trouver une colocation étudiante à Bordeaux" })
    expect(resolved).toHaveAttribute("href", routes.mutualAidItem("aid-q-1"))
    expect(within(resolved.closest("li")!).getByText("Réponse retenue")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Afficher"), { target: { value: "mine" } })
    expect(await screen.findByRole("link", { name: /Un abonnement de transport moins cher/ })).toBeInTheDocument()

    openTab("Missions bénévoles")
    expect(await screen.findByRole("link", { name: "Accueillir les nouveaux arrivants à la gare" })).toHaveAttribute("href", routes.mutualAidItem("aid-m-1"))
    expect(screen.getByRole("button", { name: "Proposer une mission" })).toBeInTheDocument()
    // La mission complète et la mission close ne sont pas « à venir » : elles ne s'affichent pas ici.
    expect(screen.queryByRole("link", { name: "Préparer le repas de la soirée culturelle" })).not.toBeInTheDocument()
  })

  it("filtrer par ville saisie, sans GPS : l'adresse se réécrit, la résidence ne change pas", async () => {
    mount("p-steeve", <MutualAidScreen />)
    fireEvent.change(screen.getByLabelText("Ville (facultatif)"), { target: { value: " Paris " } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Afficher" })) })
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(routes.mutualAid("FR", "Paris")))
  })

  it("poser une question : une coordonnée est refusée avant l'envoi, puis la question publiée ouvre sa fiche", async () => {
    mount("p-prisca", <MutualAidScreen />)
    fireEvent.click(screen.getByRole("button", { name: "Poser une question" }))
    const sheet = await screen.findByRole("dialog", { name: "Poser une question" })
    fireEvent.change(within(sheet).getByLabelText("Votre question"), { target: { value: "Ouvrir un compte bancaire en arrivant" } })
    fireEvent.change(within(sheet).getByLabelText("Précisions (facultatif)"), { target: { value: "Appelez-moi au 06 12 34 56 78" } })
    await act(async () => { fireEvent.click(within(sheet).getByRole("button", { name: "Publier la question" })) })
    expect(await within(sheet).findByText(/Pas de téléphone, d'adresse e-mail ni de lien/)).toBeInTheDocument()
    expect(mocks.push).not.toHaveBeenCalled()

    fireEvent.change(within(sheet).getByLabelText("Précisions (facultatif)"), { target: { value: "Quelle banque accepte un premier compte sans fiche de paie ?" } })
    await act(async () => { fireEvent.click(within(sheet).getByRole("button", { name: "Publier la question" })) })
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(routes.mutualAidItem("aid-q-20")))
  })

  it("sans la capacité : « indisponible », jamais une invention ; en anglais, les mêmes surfaces", () => {
    mount("p-steeve", <MutualAidScreen />, { withCapability: false })
    expect(screen.getByText("L'entraide n'est pas encore disponible ici")).toBeInTheDocument()
    cleanup()
    mount("p-steeve", <MutualAidScreen />, { locale: "en" })
    expect(screen.getByRole("heading", { level: 1, name: "Mutual aid" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Volunteer missions" })).toBeInTheDocument()
  })
})

describe("/entraide/<id> — une question", () => {
  it("l'autrice voit la réponse retenue mise en avant, la retire, puis peut en retenir une autre", async () => {
    mount("p-prisca", <MutualAidItemScreen itemId="aid-q-1" />)
    expect(await screen.findByRole("heading", { level: 1, name: "Trouver une colocation étudiante à Bordeaux" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Retour à l'entraide" })).toHaveAttribute("href", routes.mutualAid("FR", "Bordeaux"))
    const accepted = screen.getByRole("region", { name: "Réponse retenue" })
    expect(within(accepted).getByRole("link", { name: "Mireille Ivindo" })).toHaveAttribute("href", routes.profile("mireille.ivindo"))
    expect(screen.getByRole("button", { name: "Clore la question" })).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Retenir cette réponse" })).toBeInTheDocument()

    await act(async () => { fireEvent.click(within(accepted).getByRole("button", { name: "Ne plus retenir" })) })
    expect(await screen.findByText("La réponse n'est plus retenue.")).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole("region", { name: "Réponse retenue" })).not.toBeInTheDocument())
    expect(await screen.findAllByRole("button", { name: "Retenir cette réponse" })).toHaveLength(2)
  })

  it("un autre membre répond ; il ne peut ni retenir, ni clore ; le contact privé passe par la messagerie", async () => {
    mount("p-nadia", <MutualAidItemScreen itemId="aid-q-2" />)
    expect(await screen.findByRole("heading", { level: 1, name: /Renouveler un titre de séjour/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Retenir cette réponse" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clore la question" })).not.toBeInTheDocument()
    expect(screen.getByText(/passez par la messagerie depuis le profil de la personne/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Répondre à la question"), { target: { value: "Écris-moi : moi@exemple.fr" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Publier ma réponse" })) })
    expect(await screen.findByText(/Pas de téléphone, d'adresse e-mail ni de lien/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Répondre à la question"), { target: { value: "La préfecture conseille de s'y prendre tôt. (Réponse fictive.)" } })
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Publier ma réponse" })) })
    expect(await screen.findByText("Votre réponse est publiée.")).toBeInTheDocument()
    expect(await screen.findByText("La préfecture conseille de s'y prendre tôt. (Réponse fictive.)")).toBeInTheDocument()
  })

  it("une entraide inconnue ou retirée : un état neutre et le retour à la liste", async () => {
    mount("p-nadia", <MutualAidItemScreen itemId="inconnue" />)
    expect(await screen.findByText("Cette entraide n'est pas disponible")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Retour à l'entraide" })).toHaveAttribute("href", routes.mutualAid())
  })
})

describe("/entraide/<id> — une mission bénévole", () => {
  it("s'inscrire exige la case de consentement, décochée au départ ; l'inscription se confirme", async () => {
    mount("p-nadia", <MutualAidItemScreen itemId="aid-m-1" />)
    expect(await screen.findByRole("heading", { level: 1, name: "Accueillir les nouveaux arrivants à la gare" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Collectif Ivindo de Lyon (démo)" })).toHaveAttribute("href", routes.page("collectif-ivindo-lyon"))
    const consent = screen.getByRole("checkbox", { name: /voie mon nom publié pour organiser cette mission/ })
    expect(consent).not.toBeChecked()
    fireEvent.click(screen.getByRole("button", { name: "M'inscrire" }))
    expect(await screen.findByText("Cochez la case pour accepter que l'équipe voie votre nom publié.")).toBeInTheDocument()
    fireEvent.click(consent)
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "M'inscrire" })) })
    expect(await screen.findByText("Votre inscription est confirmée.")).toBeInTheDocument()
    expect(await screen.findByText("Inscription confirmée")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Me retirer" })).toBeInTheDocument()
    // Un bénévole ne lit pas la liste de l'équipe.
    expect(screen.queryByRole("heading", { name: "Bénévoles inscrits" })).not.toBeInTheDocument()
  })

  it("l'équipe vivante gère la mission et lit ses bénévoles, sans aucune coordonnée", async () => {
    mount("p-steeve", <MutualAidItemScreen itemId="aid-m-1" />)
    expect(await screen.findByRole("heading", { level: 2, name: "Gérer la mission" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clore les inscriptions" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Annuler la mission" })).toBeInTheDocument()
    expect(await screen.findByRole("link", { name: "Mireille Ivindo" })).toHaveAttribute("href", routes.profile("mireille.ivindo"))
    expect(screen.getByRole("link", { name: "Clarisse Mbéi" })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/@example\.com/)
  })

  it("une mission complète le dit, sans formulaire d'inscription", async () => {
    mount("p-nadia", <MutualAidItemScreen itemId="aid-m-2" />)
    expect(await screen.findByText("Cette mission est complète.")).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })
})

describe("entraide — l'état de modération, dans les seules vues de gestion (G9)", () => {
  it("« Mes questions » et les missions de mes associations le disent ; les autres listes, jamais", async () => {
    mount("p-steeve", <MutualAidScreen />, { moderation: "removed" })
    // La question d'autrui : aucun état, même servi par le fournisseur.
    fireEvent.change(screen.getByLabelText("Afficher"), { target: { value: "resolved" } })
    const others = await screen.findByRole("link", { name: "Trouver une colocation étudiante à Bordeaux" })
    expect(within(others.closest("li")!).queryByText("Retirée par la modération")).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("Afficher"), { target: { value: "mine" } })
    const mine = await screen.findByRole("link", { name: /Un abonnement de transport moins cher/ })
    expect(within(mine.closest("li")!).getByText("Retirée par la modération")).toBeInTheDocument()

    openTab("Missions bénévoles")
    expect(await screen.findByRole("link", { name: "Accueillir les nouveaux arrivants à la gare" })).toBeInTheDocument()
    expect(screen.queryByText("Retirée par la modération")).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Afficher"), { target: { value: "team" } })
    expect(await screen.findByRole("link", { name: "Collecter des vêtements d'hiver" })).toBeInTheDocument()
    expect(screen.getAllByText("Retirée par la modération")).toHaveLength(3)
  })

  it("une question : l'avis de modération à son autrice seule ; retirée, elle ne propose plus de répondre", async () => {
    mount("p-prisca", <MutualAidItemScreen itemId="aid-q-1" />, { moderation: "removed" })
    expect(await screen.findByRole("heading", { level: 1, name: "Trouver une colocation étudiante à Bordeaux" })).toBeInTheDocument()
    expect(screen.getByText("Refusée.")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Votre réponse" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Retirer la question" })).toBeInTheDocument()
    cleanup()

    mount("p-nadia", <MutualAidItemScreen itemId="aid-q-1" />, { moderation: "removed" })
    expect(await screen.findByRole("heading", { level: 1, name: "Trouver une colocation étudiante à Bordeaux" })).toBeInTheDocument()
    expect(screen.queryByText("Refusée.")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Votre réponse" })).toBeInTheDocument()
  })

  it("une réponse : son auteur en lit l'état sur la sienne, rien sur celle d'autrui ni sur la question", async () => {
    mount("p-steeve", <MutualAidItemScreen itemId="aid-q-1" />, { moderation: "pending_review" })
    expect(await screen.findByRole("heading", { level: 1, name: "Trouver une colocation étudiante à Bordeaux" })).toBeInTheDocument()
    const mention = await screen.findByText("En relecture")
    expect(within(mention.closest("li")!).getByText(/service logement/)).toBeInTheDocument()
    expect(screen.getAllByText("En relecture")).toHaveLength(1)
    expect(screen.queryByText("En relecture.")).not.toBeInTheDocument()
  })

  it("une mission : l'avis de modération à l'équipe seule ; retirée, ni modification ni inscription", async () => {
    mount("p-steeve", <MutualAidItemScreen itemId="aid-m-1" />, { moderation: "removed" })
    expect(await screen.findByRole("heading", { level: 2, name: "Gérer la mission" })).toBeInTheDocument()
    expect(screen.getByText("Refusée.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Modifier" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Clore les inscriptions" })).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Participer" })).not.toBeInTheDocument()
    cleanup()

    mount("p-nadia", <MutualAidItemScreen itemId="aid-m-1" />, { moderation: "removed" })
    expect(await screen.findByRole("heading", { level: 1, name: "Accueillir les nouveaux arrivants à la gare" })).toBeInTheDocument()
    expect(screen.queryByText("Refusée.")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Participer" })).toBeInTheDocument()
  })
})
