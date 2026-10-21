import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { renderWithI18n } from "../test-utils"
import { CountrySwitch } from "./country-switch"
import { CountryTag, ScopeTag } from "./country-tag"
import { MembershipStatusBanner } from "./membership-status-banner"
import { ModerationBanner } from "./moderation-banner"
import { PostMediaGrid } from "./post-media"
import { SharedPostEmbed } from "./post-share"
import { RoutingProvider, type FeatureRoutes } from "../routing"
import { RichText, richParts } from "./rich-text"
import { TrustBadge } from "./trust-badge"

describe("CountryTag — l'étiquette pays", () => {
  it("annonce le nom du pays, garde le code ISO décoratif, montre la ville", () => {
    const { container } = renderWithI18n(<CountryTag country="FR" city="Lyon" />)
    const tag = container.querySelector('[data-slot="country-tag"]')
    expect(tag).toHaveTextContent("France")
    expect(screen.getByText("Lyon")).toBeVisible()
    expect(screen.getByText("FR")).toHaveAttribute("aria-hidden", "true")
  })

  it("nomme le pays dans la langue de la personne", () => {
    renderWithI18n(<CountryTag country="DE" />, "en")
    expect(screen.getAllByText("Germany").length).toBeGreaterThan(0)
  })

  it("la portée diaspora se lit « Toute la diaspora »", () => {
    renderWithI18n(<ScopeTag />)
    expect(screen.getByText("Toute la diaspora")).toBeInTheDocument()
  })
})

describe("TrustBadge — les quatre badges de confiance", () => {
  it.each([
    ["official", "Officiel"],
    ["verified", "Vérifié"],
    ["public_agent", "Agent public"],
    ["community", "Communauté"],
  ] as const)("%s porte un libellé et une explication, jamais la seule couleur", (badge, label) => {
    const { container } = renderWithI18n(<TrustBadge badge={badge} />)
    const node = container.querySelector(`[data-badge="${badge}"]`)
    expect(node).toHaveTextContent(label)
    expect(node?.getAttribute("title")?.length).toBeGreaterThan(10)
    expect(node?.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })
})

describe("MembershipStatusBanner — la bannière de statut", () => {
  const actions = {
    verifyConsular: <a href="/verification">vérifier</a>,
    sponsorHelp: <a href="/parametres#parrainage">parrainage</a>,
    activateIdn: <a href="https://idn.example">idn</a>,
  }

  it("en attente : lecture seule, et les deux chemins pour publier", () => {
    renderWithI18n(<MembershipStatusBanner status="en_attente" badges={["community"]} actions={actions} />)
    expect(screen.getByText("Votre compte est en attente.")).toBeInTheDocument()
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["vérifier", "parrainage"])
  })

  it("déclarée sans badge Vérifié : le parcours d'élévation, seulement les liens fournis", () => {
    renderWithI18n(<MembershipStatusBanner status="declaree" badges={["community"]} actions={actions} />)
    expect(screen.getByText("Votre compte est déclaré.")).toBeInTheDocument()
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["idn", "vérifier"])
  })

  it("déclarée avec le badge Vérifié : ne propose plus que l'inscription consulaire", () => {
    renderWithI18n(<MembershipStatusBanner status="declaree" badges={["verified"]} actions={actions} />)
    expect(screen.getByText("Votre identité est vérifiée.")).toBeInTheDocument()
    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual(["vérifier"])
  })

  it("suspendue : la sanction et sa date, rien d'autre", () => {
    renderWithI18n(<MembershipStatusBanner status="suspendue" badges={[]} suspendedUntil="20 octobre" actions={actions} />)
    expect(screen.getByText("Votre compte est suspendu.")).toBeInTheDocument()
    expect(screen.getByText(/Jusqu'au 20 octobre|Jusqu'au 20 octobre/)).toBeInTheDocument()
    expect(screen.queryAllByRole("link")).toEqual([])
  })

  it("partie : aucune bannière", () => {
    const { container } = renderWithI18n(<MembershipStatusBanner status="partie" badges={[]} />)
    expect(container.querySelector('[data-slot="membership-status-banner"]')).toBeNull()
  })
})

describe("ModerationBanner — montré à l'auteur", () => {
  it("en relecture : le statut et ce qu'il implique", () => {
    renderWithI18n(<ModerationBanner state="pending_review" />)
    expect(screen.getByRole("status")).toHaveTextContent("En relecture.")
    expect(screen.getByRole("status")).toHaveTextContent("Visible par vous seulement")
  })

  it("refusé : le motif", () => {
    renderWithI18n(<ModerationBanner state="rejected" reason="contenu commercial" />)
    expect(screen.getByRole("status")).toHaveTextContent("contenu commercial")
  })
})

describe("CountrySwitch — accès rapide du changement de hub", () => {
  /** Un stockage en mémoire : le `localStorage` expérimental de Node masque celui de jsdom. */
  function memoryStorage(initial: Record<string, string> = {}) {
    const items = new Map(Object.entries(initial))
    return {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("mon pays d'abord, puis les derniers pays choisis, gardés dans ce navigateur ; une recherche les masque", async () => {
    vi.stubGlobal("localStorage", memoryStorage())
    const onChange = vi.fn()
    const user = userEvent.setup()
    renderWithI18n(
      <CountrySwitch
        value="FR"
        onChange={onChange}
        openCountries={["FR"]}
        title="Changer de pays"
        description="Cherchez par nom ou par code."
        rememberKey="test:hubs"
        home="FR"
      />,
    )
    await user.click(screen.getByRole("combobox"))
    let quick = screen.getByRole("region", { name: "Accès rapide" })
    expect(within(quick).getAllByRole("button").map((button) => button.textContent)).toEqual([expect.stringContaining("France")])
    expect(within(quick).getByText("mon pays")).toBeInTheDocument()
    await user.type(screen.getByRole("searchbox"), "Belgique")
    expect(screen.queryByRole("region", { name: "Accès rapide" })).toBeNull()
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Belgique/ }))
    expect(onChange).toHaveBeenCalledWith("BE")
    expect(JSON.parse(window.localStorage.getItem("test:hubs") ?? "[]")).toEqual(["BE"])
    await user.click(screen.getByRole("combobox"))
    quick = screen.getByRole("region", { name: "Accès rapide" })
    expect(within(quick).getAllByRole("button").map((button) => button.textContent?.slice(0, 2))).toEqual(["FR", "BE"])
  })

  it("un stockage illisible ne casse rien : l'accès rapide se contente de mon pays", async () => {
    vi.stubGlobal("localStorage", memoryStorage({ "test:hubs": "{pas du json" }))
    const user = userEvent.setup()
    renderWithI18n(<CountrySwitch value={null} onChange={vi.fn()} openCountries={[]} title="Changer de pays" description="…" rememberKey="test:hubs" home="CA" />)
    await user.click(screen.getByRole("combobox"))
    expect(within(screen.getByRole("region", { name: "Accès rapide" })).getAllByRole("button")).toHaveLength(1)
  })
})

describe("CountrySwitch — le sélecteur de pays", () => {
  function setup(value: "FR" | null = null) {
    const onChange = vi.fn()
    renderWithI18n(
      <CountrySwitch value={value} onChange={onChange} openCountries={["FR"]} title="Votre pays de résidence" description="Cherchez par nom ou par code." />,
    )
    return { onChange, user: userEvent.setup() }
  }

  it("s'ouvre sur sa recherche, filtre sans accents, et ne propose jamais le Gabon", async () => {
    const { user } = setup()
    await user.click(screen.getByRole("combobox"))
    const search = screen.getByRole("searchbox", { name: "Rechercher un pays" })
    expect(search).toHaveFocus()
    await user.type(search, "gab")
    expect(screen.getByText("Aucun pays ne correspond à votre recherche.")).toBeInTheDocument()
    await user.clear(search)
    await user.type(search, "etats")
    expect(screen.getByText("États-Unis")).toBeInTheDocument()
  })

  it("marque les pays ouverts et rend le code choisi", async () => {
    const { user, onChange } = setup()
    await user.click(screen.getByRole("combobox"))
    await user.type(screen.getByRole("searchbox"), "France")
    const dialog = screen.getByRole("dialog")
    const france = within(dialog).getByRole("button", { name: /France/ })
    expect(france).toHaveTextContent("Ouvert")
    await user.click(france)
    expect(onChange).toHaveBeenCalledWith("FR")
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("annonce son état : ouvert, invalide", async () => {
    const onChange = vi.fn()
    renderWithI18n(<CountrySwitch value={null} onChange={onChange} openCountries={[]} title="t" description="d" invalid />)
    const trigger = screen.getByRole("combobox")
    expect(trigger).toHaveAttribute("aria-invalid", "true")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    await userEvent.setup().click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
  })
})

describe("RichText — mentions et mots-dièse", () => {
  it("une @identifiant valide est une mention ; un #mot-dièse est mis en valeur ; le reste est du texte", () => {
    expect(richParts("Merci @Ada.Lovelace pour #Libreville2026 !")).toEqual([
      { kind: "text", text: "Merci " },
      { kind: "mention", handle: "ada.lovelace", text: "@Ada.Lovelace" },
      { kind: "text", text: " pour " },
      { kind: "tag", tag: "libreville2026", text: "#Libreville2026" },
      { kind: "text", text: " !" },
    ])
  })

  it("une adresse n'est pas une mention ; un identifiant trop court reste du texte ; le point final n'en fait pas partie", () => {
    expect(richParts("Écrivez à contact@exemple.test")).toEqual([{ kind: "text", text: "Écrivez à contact@exemple.test" }])
    expect(richParts("Salut @ab")).toEqual([{ kind: "text", text: "Salut @ab" }])
    expect(richParts("Vu par @awa.")).toEqual([
      { kind: "text", text: "Vu par " },
      { kind: "mention", handle: "awa", text: "@awa" },
      { kind: "text", text: "." },
    ])
    expect(richParts("")).toEqual([])
  })

  it("la casse de l'auteur est gardée, même quand la minuscule du moteur s'allonge (« İ »)", () => {
    expect(richParts("Vu à #İstanbul avec @Awa !")).toEqual([
      { kind: "text", text: "Vu à " },
      { kind: "tag", tag: "i̇stanbul", text: "#İstanbul" },
      { kind: "text", text: " avec " },
      { kind: "mention", handle: "awa", text: "@Awa" },
      { kind: "text", text: " !" },
    ])
  })

  it("les morceaux recomposent le texte à l'identique", () => {
    for (const text of ["#Gabon #Diaspora", "@Ada.Lovelace, #İzmir et @awa.", "a#bc d-@efg @h_ij"]) {
      expect(
        richParts(text)
          .map((part) => part.text)
          .join(""),
      ).toBe(text)
    }
  })

  it("les mots-dièse sont de vrais liens clavier utilisant le jeton canonique sans changer le texte Unicode", async () => {
    const feed = vi.fn((tag?: string) => `/fil?${new URLSearchParams({ tag: tag ?? "" }).toString()}`)
    const routes: FeatureRoutes = {
      profile: (handle) => `/@${handle}`, post: (id) => `/publication/${id}`, page: (handle) => `/pages/${handle}`,
      hub: (country) => `/pays/${country}`, feed, sponsor: () => "/parrainer", settings: () => "/parametres",
      attestation: () => "/verification", enter: () => "/entrer",
    }
    const { container } = renderWithI18n(
      <RoutingProvider routes={routes} Link={({ children, ...rest }) => <a {...rest}>{children}</a>}>
        <p><RichText text={'#ÉTÉ #İstanbul avec @Ada.Lovelace <img src="interdit">'} /></p>
      </RoutingProvider>,
    )
    const summer = screen.getByRole("link", { name: "#ÉTÉ" })
    expect(summer).toHaveAttribute("href", "/fil?tag=%C3%A9t%C3%A9")
    expect(screen.getByRole("link", { name: "#İstanbul" })).toHaveAttribute("href", "/fil?tag=i%CC%87stanbul")
    expect(feed).toHaveBeenCalledWith("été")
    expect(feed).toHaveBeenCalledWith("i̇stanbul")
    expect(screen.getByRole("link", { name: "@Ada.Lovelace" })).toHaveAttribute("href", "/@ada.lovelace")
    expect(container.querySelector("img")).toBeNull()
    await userEvent.setup().tab()
    expect(summer).toHaveFocus()
  })
})

describe("PostMediaGrid — les médias d'une publication", () => {
  const photo = { kind: "image" as const, url: "https://exemple.test/marche.jpg", withheld: null, altText: "Le marché de Libreville", width: 800, height: 600 }

  it("une photo seule déclare sa taille et dit ce qu'elle montre ; sans texte alternatif, une description générique", () => {
    renderWithI18n(<PostMediaGrid media={[photo]} />)
    const image = screen.getByRole("img", { name: "Le marché de Libreville" })
    expect(image).toHaveAttribute("width", "800")
    expect(image).toHaveAttribute("height", "600")
    expect(image).toHaveAttribute("loading", "lazy")
  })

  it("plusieurs photos : chacune a son nom, même sans texte alternatif", () => {
    renderWithI18n(<PostMediaGrid media={[photo, { ...photo, altText: null }, { ...photo, altText: "La plage" }]} />)
    expect(screen.getAllByRole("img").map((image) => image.getAttribute("alt") ?? image.getAttribute("aria-label"))).toEqual([
      "Le marché de Libreville",
      "Photo jointe à la publication",
      "La plage",
    ])
  })

  it("un média que la garde retient garde sa place et dit pourquoi, sans aucune image rendue", () => {
    const { container } = renderWithI18n(
      <PostMediaGrid
        media={[
          { ...photo, url: null, withheld: "scan_pending" },
          { ...photo, url: null, withheld: "quarantined" },
        ]}
      />,
    )
    expect(screen.getByRole("img", { name: "Analyse du fichier en cours…" })).toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Fichier retenu par la garde des fichiers" })).toBeInTheDocument()
    expect(container.querySelector("img")).toBeNull()
  })

  it("une analyse indisponible masque les URL contradictoires des images et vidéos", () => {
    const media: Parameters<typeof PostMediaGrid>[0]["media"] = [
      { ...photo, withheld: "scan_unavailable" },
      { ...photo, kind: "video", withheld: "scan_unavailable" },
    ]
    const { container } = renderWithI18n(<PostMediaGrid media={media} />)
    expect(screen.getAllByRole("img", { name: "Média indisponible" })).toHaveLength(2)
    expect(container.querySelector("img, video")).toBeNull()
    expect(container.innerHTML).not.toContain(photo.url)
  })
})

describe("SharedPostEmbed — l'original d'un partage cité", () => {
  const routes: FeatureRoutes = {
    profile: (handle) => `/@${handle}`,
    post: (postId) => `/publication/${postId}`,
    page: (handle) => `/pages/${handle}`,
    hub: (country) => `/pays/${country}`,
    feed: () => "/fil",
    sponsor: () => "/parrainer",
    settings: () => "/parametres",
    attestation: () => "/verification",
    enter: () => "/entrer",
  }
  const withRouting = (ui: React.ReactElement) =>
    renderWithI18n(
      <RoutingProvider routes={routes} Link={({ children, ...rest }) => <a {...rest}>{children}</a>}>
        {ui}
      </RoutingProvider>,
    )

  it("disponible : l'auteur mène à son profil, l'horodatage à l'original, le texte suit", () => {
    withRouting(
      <SharedPostEmbed
        now={10_000}
        share={{ available: true, postId: "post-7", author: { kind: "person", handle: "prisca.abanga", displayName: "Prisca ABANGA" }, body: "Une coiffeuse à Bordeaux ?", media: [], publishedAt: 4_000 }}
      />,
    )
    const region = screen.getByRole("figure", { name: "Publication partagée" })
    expect(within(region).getByRole("link", { name: "Prisca ABANGA" })).toHaveAttribute("href", "/@prisca.abanga")
    expect(region.querySelector('a[href="/publication/post-7"]')).not.toBeNull()
    expect(within(region).getByText("Une coiffeuse à Bordeaux ?")).toBeInTheDocument()
  })

  it("une page parle en son nom ; indisponible, l'original ne dit que cela", () => {
    const { unmount } = withRouting(
      <SharedPostEmbed now={1} share={{ available: true, postId: "p8", author: { kind: "page", handle: "saveurs", displayName: "Saveurs du Gabon" }, body: "", media: [], publishedAt: 1 }} />,
    )
    expect(screen.getByRole("link", { name: "Saveurs du Gabon" })).toHaveAttribute("href", "/pages/saveurs")
    unmount()
    withRouting(<SharedPostEmbed now={1} share={{ available: false }} />)
    expect(screen.getByText(/^Publication indisponible\s: retirée, ou hors de votre portée\.$/)).toBeInTheDocument()
    expect(screen.queryByRole("figure")).toBeNull()
  })
})
