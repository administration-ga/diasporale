/** Les familles dynamiques des chantiers du plan global, chacune tenue dans son fichier. */
import { FAMILIES as PAGES } from "./pages"
import { FAMILIES as PAGE_ADMIN } from "./page-admin"
import { FAMILIES as SERVICES } from "./services"
import { FAMILIES as SERVICE_REQUESTS } from "./service-requests"
import { FAMILIES as SERVICE_REVIEWS } from "./service-reviews"
import { FAMILIES as ASSOCIATIONS } from "./associations"
import { FAMILIES as DATA_RIGHTS } from "./data-rights"
import { FAMILIES as DISCOVERY } from "./discovery"
import { FAMILIES as NAVIGATION } from "./navigation"
import { FAMILIES as CONTENT_REPORTS } from "./content-reports"
import { FAMILIES as MUTUAL_AID } from "./mutual-aid"
import { FAMILIES as ARRIVAL_KIT } from "./arrival-kit"
import { FAMILIES as MENTORING } from "./mentoring"
import { FAMILIES as JOBS } from "./jobs"
import { FAMILIES as MODERATION_DESK } from "./moderation-desk"
import { FAMILIES as MODERATION_DEADLINES } from "./moderation-deadlines"
import { FAMILIES as PILOT_METRICS } from "./pilot-metrics"
import { FAMILIES as SERVICE_NOTIFICATIONS } from "./service-notifications"
import { FAMILIES as DEMO_ACCOUNTS } from "./demo-accounts"
import { FAMILIES as REPORTER_NOTICES } from "./reporter-notices"

export const LOT_FAMILIES: readonly string[] = [
  ...PAGES,
  ...PAGE_ADMIN,
  ...SERVICES,
  ...SERVICE_REQUESTS,
  ...DATA_RIGHTS,
  ...NAVIGATION,
  ...ASSOCIATIONS,
  ...DISCOVERY,
  ...SERVICE_REVIEWS,
  ...CONTENT_REPORTS,
  ...MUTUAL_AID,
  ...ARRIVAL_KIT,
  ...MENTORING,
  ...JOBS,
  ...MODERATION_DESK,
  ...MODERATION_DEADLINES,
  ...PILOT_METRICS,
  ...SERVICE_NOTIFICATIONS,
  ...DEMO_ACCOUNTS,
  ...REPORTER_NOTICES,
]
