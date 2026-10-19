/**
 * Capacité « pages » du port (DG-007) — la fiche réelle d'une page avec l'état
 * du lecteur, l'abonnement, l'annuaire des pages et les listes du hub.
 * PROPRIÉTAIRE : chantier « pages » (vague G1).
 *
 * La fiche se lit aussi par `usePage(handle)` du port principal (même
 * projection) ; la capacité la rend RÉACTIVE à l'abonnement du lecteur et y joint
 * une reprise. Facultative : un fournisseur qui ne la sert pas la laisse absente,
 * et l'écran le dit au lieu d'inventer.
 *
 * Toutes les lectures sont bornées au réseau `diasporale` et passent la garde de
 * lecture des pages du moteur (page active, du réseau, ni retirée ni signalée par
 * le lecteur) : une page inconnue et une page illisible rendent le même `null`.
 */
import { normalizePageAssociationType, normalizePageSector } from "@antsia/social-domain/pagePresentation"
import { isDomainViolation } from "@antsia/social-domain/violation"
import type { CountryCode, PageOwnerKind } from "@diasporale/domain"

import type { ActionResult } from "./port"
import type { AssociationType, CompanySector, Loadable, PageDetailView, PageView } from "./types"

/**
 * Codes de refus propres aux pages, traduits par `errors.<code>` (fragment
 * pages, en JSON). Aucun aujourd'hui : les lectures et abonnements emploient
 * les codes communs ; les catégories réutilisent ceux de la présentation des pages.
 */
export const PAGE_ERROR_CODES = [] as const

/** En deçà, une recherche n'en est pas une : l'annuaire suit son ordre (confiance, puis récence), comme le moteur. */
export const PAGE_DIRECTORY_QUERY_MIN_LENGTH = 2

/** Pages lues par fenêtre de l'annuaire (le moteur plafonne à cinquante). */
export const PAGE_DIRECTORY_PAGE_SIZE = 20

/** Une reprise de la lecture, quand le fournisseur en a une (la démonstration lit en local). */
export type PagesRetry = () => Promise<unknown> | void

/** La fiche d'une page ; `null` : introuvable ou illisible pour ce lecteur (même réponse). */
export type PageDetailQuery = Loadable<PageDetailView | null> & { readonly retry?: PagesRetry }

export interface PageDirectoryRequest {
  /** Cherchée sans accents dès `PAGE_DIRECTORY_QUERY_MIN_LENGTH` caractères ; en deçà, l'ordre de l'annuaire. */
  readonly query: string
  /** Restreint aux pages déclarées dans ce pays ; un filtre n'ouvre jamais rien. */
  readonly country?: CountryCode
  /** Nature déclarée de la page ; ce filtre ne confère aucun badge ni mandat. */
  readonly ownerKind?: PageOwnerKind
  /** Précision déclarée par une association ; implique cette nature si elle n'est pas fournie. */
  readonly associationType?: AssociationType
  /** Secteur déclaré par une entreprise ; implique cette nature si elle n'est pas fournie. */
  readonly sector?: CompanySector
  /** Curseur opaque du fournisseur ; `null` pour la première fenêtre. */
  readonly cursor: string | null
}

type PageDirectoryCategories = Pick<PageDirectoryRequest, "ownerKind" | "associationType" | "sector">

/** Même sélection canonique dans les adaptateurs : deux catégories ou une mauvaise nature se refusent. */
export function normalizePageDirectoryCategories(args: PageDirectoryCategories): ActionResult<PageDirectoryCategories> {
  if (args.associationType !== undefined && args.sector !== undefined) return { ok: false, code: "page_association_type_invalid" }
  const ownerKind = args.ownerKind ?? (args.associationType !== undefined ? "association" : args.sector !== undefined ? "company" : undefined)
  try {
    const associationType = normalizePageAssociationType(ownerKind ?? "association", args.associationType)
    const sector = normalizePageSector(ownerKind ?? "company", args.sector)
    return {
      ok: true,
      value: {
        ...(ownerKind !== undefined ? { ownerKind } : {}),
        ...(associationType !== undefined ? { associationType } : {}),
        ...(sector !== undefined ? { sector } : {}),
      },
    }
  } catch (error) {
    if (isDomainViolation(error)) {
      if (error.code === "PAGE_ASSOCIATION_TYPE_INVALID") return { ok: false, code: "page_association_type_invalid" }
      if (error.code === "PAGE_SECTOR_INVALID") return { ok: false, code: "page_sector_invalid" }
    }
    return { ok: false, code: "unknown" }
  }
}

export interface PageDirectoryEntry extends PageView {
  /** Le lecteur suit cette page. */
  readonly following: boolean
}

export interface PageDirectoryPage {
  readonly items: readonly PageDirectoryEntry[]
  /** `null` à la fin ; une fenêtre filtrée peut être vide et annoncer une suite. */
  readonly continueCursor: string | null
  readonly isDone: boolean
}

export type PageDirectoryQuery = Loadable<PageDirectoryPage> & { readonly retry?: PagesRetry }

/** Par liste du hub : la fenêtre bornée n'a pas tout montré (la suite se cherche dans l'annuaire). */
export interface HubPagesMoreView {
  readonly officialPages: boolean
  readonly associations: boolean
  readonly companies: boolean
}

/** Les pages publiées et lisibles d'un pays, par nature et bornées — jamais un comptage. */
export interface HubPagesView {
  readonly country: CountryCode
  readonly officialPages: readonly PageView[]
  readonly associations: readonly PageView[]
  readonly companies: readonly PageView[]
  readonly more: HubPagesMoreView
}

export type HubPagesQuery = Loadable<HubPagesView> & { readonly retry?: PagesRetry }

/** L'abonnement du lecteur après le geste (suivre et ne plus suivre sont idempotents). */
export interface PageFollowState {
  readonly following: boolean
}

export interface PagesCapability {
  /** Présent seulement si l'annuaire sait appliquer les catégories avant sa pagination. */
  readonly supportsDirectoryCategories?: true
  /** La fiche d'une page lisible d'ici, réactive à l'abonnement et au rôle vivant du lecteur. */
  usePage(handle: string): PageDetailQuery
  /** L'annuaire des pages du réseau, paginé par le fournisseur. */
  useDirectory(args: PageDirectoryRequest): PageDirectoryQuery
  /** Mes abonnements aux pages lisibles du réseau, distincts de mes mandats de gestion. */
  useFollowedPages?(args: { readonly cursor: string | null }): PageDirectoryQuery
  /** Les pages officielles, associations et entreprises d'un pays (hub), bornées. */
  useHubPages(country: CountryCode): HubPagesQuery
  /** Suivre une page lisible d'ici ; la refaire ne double rien. */
  follow(handle: string): Promise<ActionResult<PageFollowState>>
  /** Ne plus suivre ; sans abonnement, rien ne change. */
  unfollow(handle: string): Promise<ActionResult<PageFollowState>>
}
