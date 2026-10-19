/**
 * Familles de clés DYNAMIQUES du chantier « catalogue des services (DG-011/012) »,
 * énumérées depuis les constantes qui les pilotent. PROPRIÉTAIRE : ce chantier.
 * Une clé citée en toutes lettres n'a rien à faire ici.
 */
import {
  SERVICE_BUDGET_FITS,
  SERVICE_CATEGORIES,
  SERVICE_DELIVERY_FILTERS,
  SERVICE_DELIVERY_MODES,
  SERVICE_OFFER_STATUSES,
  SERVICE_PRICING_MODES,
} from "@diasporale/domain"

import { ACTIVITY_TABS } from "@/components/service-activity"

/** Les gestes d'état d'une offre dans « Mon activité » (`services.manage.action|done.<geste>`). */
const STATUS_ACTIONS = ["publish", "pause", "resume", "withdraw"] as const

export const FAMILIES: readonly string[] = [
  ...SERVICE_CATEGORIES.map((category) => `services.category.${category}`),
  ...SERVICE_DELIVERY_MODES.map((delivery) => `services.delivery.${delivery}`),
  ...["any", ...SERVICE_DELIVERY_FILTERS].map((filter) => `services.deliveryFilter.${filter}`),
  ...SERVICE_PRICING_MODES.map((mode) => `services.pricingMode.${mode}`),
  // Le prix « fixe » et « à partir de » se disent par famille ; « sur devis » et « gratuit » en toutes lettres.
  ...SERVICE_PRICING_MODES.filter((mode) => mode !== "quote").map((mode) => `services.price.${mode}`),
  ...SERVICE_OFFER_STATUSES.map((status) => `services.status.${status}`),
  // Une offre au-dessus du budget n'est jamais affichée : elle n'a pas de phrase.
  ...SERVICE_BUDGET_FITS.filter((fit) => fit !== "above").map((fit) => `services.budgetFit.${fit}`),
  ...ACTIVITY_TABS.map((tab) => `services.activity.tab.${tab}`),
  ...STATUS_ACTIONS.flatMap((action) => [`services.manage.action.${action}`, `services.manage.done.${action}`]),
]
