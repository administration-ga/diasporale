/** Les règles de présentation des pages, partagées avec le moteur. */
import { normalizePageAssociationType, normalizePageCity, normalizePageSector } from "@antsia/social-domain/pagePresentation"
import { isDomainViolation } from "@antsia/social-domain/violation"
import type { PageOwnerKind } from "@diasporale/domain"

import type { ActionErrorCode } from "./errors"

export { PAGE_CITY_MAX_LENGTH } from "@antsia/social-domain/pagePresentation"

function presentationRefusal(normalize: () => unknown): ActionErrorCode | null {
  try {
    normalize()
    return null
  } catch (error) {
    if (isDomainViolation(error)) {
      switch (error.code) {
        case "PAGE_CITY_INVALID": return "page_city_invalid"
        case "PAGE_CITY_TOO_LONG": return "page_city_too_long"
        case "PAGE_ASSOCIATION_TYPE_INVALID": return "page_association_type_invalid"
        case "PAGE_SECTOR_INVALID": return "page_sector_invalid"
      }
    }
    return "unknown"
  }
}

export function pageCityRefusal(raw: string | null | undefined): ActionErrorCode | null {
  return presentationRefusal(() => normalizePageCity(raw))
}

export function pageAssociationTypeRefusal(ownerKind: PageOwnerKind, raw: string | null | undefined): ActionErrorCode | null {
  return presentationRefusal(() => normalizePageAssociationType(ownerKind, raw))
}

export function pageSectorRefusal(ownerKind: PageOwnerKind, raw: string | null | undefined): ActionErrorCode | null {
  return presentationRefusal(() => normalizePageSector(ownerKind, raw))
}
