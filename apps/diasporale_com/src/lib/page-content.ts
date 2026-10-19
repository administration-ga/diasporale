import { routes } from "./routes"

export const PAGE_CONTENT_TABS = ["publications", "photos", "videos", "avis"] as const

export type PageContentTab = (typeof PAGE_CONTENT_TABS)[number]
export type PageContentContext = "page" | "manage"

/** Une valeur inconnue ou répétée ne désigne jamais une rubrique implicite. */
export function pageContentTabOf(raw: unknown): PageContentTab {
  return typeof raw === "string" && (PAGE_CONTENT_TABS as readonly string[]).includes(raw)
    ? raw as PageContentTab : "publications"
}

/** Les mêmes libellés que les onglets, sans seconde liste de traductions. */
export function pageContentLabelKey(tab: PageContentTab): string {
  return tab === "avis" ? "pageReviews.tab" : `pageMedia.${tab}`
}

/**
 * Sans query, le partage produit un lien canonique sans paramètres voisins.
 * La navigation locale peut conserver ses autres paramètres via `search`.
 */
export function pageContentHref(handle: string, tab: PageContentTab, search = "", context: PageContentContext = "page"): string {
  const query = new URLSearchParams(search)
  const management = context === "manage"
  if (management) query.set("onglet", "publications")
  query.set("contenu", tab)
  const base = management ? routes.pageManage(handle) : routes.page(handle)
  const anchor = management ? "gestion-publications" : "page-publications"
  return `${base}?${query.toString()}#${anchor}`
}
