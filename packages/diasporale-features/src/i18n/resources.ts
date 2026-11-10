/**
 * Les textes de l'espace de noms `diasporale`, assemblés depuis plusieurs
 * fichiers par langue : le fichier principal (diasporale, en JSON) et un fragment
 * par chantier (pages, services…). Chaque chantier écrit SON fragment, sans
 * toucher celui des autres. Les noms de fichiers ne s'écrivent jamais entre
 * guillemets ou accents graves ici : le cliquet des clés lirait « pages » ou
 * « services » suivi de l'extension comme une clé citée.
 *
 * L'assemblage est une fusion profonde STRICTE : un fragment peut ajouter des
 * clés sous un espace existant (`nav`, `errors`…), jamais redéfinir une phrase
 * déjà posée ailleurs ni remplacer un groupe par une phrase. Toute collision
 * lève une erreur à l'import, donc au premier test.
 */
import enAppearanceThemes from "./locales/en/appearance-themes.json"
import enAccountMenu from "./locales/en/account-menu.json"
import enAppErrors from "./locales/en/app-errors.json"
import enAssociations from "./locales/en/associations.json"
import enAssociationActivities from "./locales/en/association-activities.json"
import enEventReminderNotices from "./locales/en/event-reminder-notices.json"
import enAssociationAttendance from "./locales/en/association-attendance.json"
import enEventGallery from "./locales/en/event-gallery.json"
import enEventCalendar from "./locales/en/event-calendar.json"
import enDataRights from "./locales/en/data-rights.json"
import enDemoAccounts from "./locales/en/demo-accounts.json"
import enDiasporale from "./locales/en/diasporale.json"
import enDiscovery from "./locales/en/discovery.json"
import enDoorVision from "./locales/en/door-vision.json"
import enHubNotices from "./locales/en/hub-notices.json"
import enHubEvents from "./locales/en/hub-events.json"
import enNavigation from "./locales/en/navigation.json"
import enPageAdmin from "./locales/en/page-admin.json"
import enPageBrowsing from "./locales/en/page-browsing.json"
import enPageSharing from "./locales/en/page-sharing.json"
import enPageContentLinks from "./locales/en/page-content-links.json"
import enPagePublications from "./locales/en/page-publications.json"
import enPagePostEditing from "./locales/en/page-post-editing.json"
import enPagePinning from "./locales/en/page-pinning.json"
import enPagePresentation from "./locales/en/page-presentation.json"
import enPageMedia from "./locales/en/page-media.json"
import enPageDirectoryCategories from "./locales/en/page-directory-categories.json"
import enPageServices from "./locales/en/page-services.json"
import enPageManagedServices from "./locales/en/page-managed-services.json"
import enPageServiceFilters from "./locales/en/page-service-filters.json"
import enPageReviews from "./locales/en/page-reviews.json"
import enPages from "./locales/en/pages.json"
import enServiceRequests from "./locales/en/service-requests.json"
import enServiceNotifications from "./locales/en/service-notifications.json"
import enServiceReviews from "./locales/en/service-reviews.json"
import enServices from "./locales/en/services.json"
import enContentReports from "./locales/en/content-reports.json"
import enMutualAid from "./locales/en/mutual-aid.json"
import enArrivalKit from "./locales/en/arrival-kit.json"
import enMentoring from "./locales/en/mentoring.json"
import enJobs from "./locales/en/jobs.json"
import enModerationDesk from "./locales/en/moderation-desk.json"
import enModerationDeadlines from "./locales/en/moderation-deadlines.json"
import enPilotMetrics from "./locales/en/pilot-metrics.json"
import enPageDecisions from "./locales/en/page-decisions.json"
import enContextualConversations from "./locales/en/contextual-conversations.json"
import enCommunityNotifications from "./locales/en/community-notifications.json"
import enPostExplanation from "./locales/en/post-explanation.json"
import enReporterNotices from "./locales/en/reporter-notices.json"
import enFunctionalHealth from "./locales/en/functional-health.json"
import enServiceProposalSettings from "./locales/en/service-proposal-settings.json"
import enServiceReschedule from "./locales/en/service-reschedule.json"
import enMediaPreparation from "./locales/en/media-preparation.json"
import enProfileImages from "./locales/en/profile-images.json"
import enLegalTexts from "./locales/en/legal-texts.json"
import enCallSettings from "./locales/en/call-settings.json"
import enWelcomeProfile from "./locales/en/welcome-profile.json"
import enPostPublicationState from "./locales/en/post-publication-state.json"
import enCommentPages from "./locales/en/comment-pages.json"
import enObjectReports from "./locales/en/object-reports.json"
import enHubShortcuts from "./locales/en/hub-shortcuts.json"
import enHubAbout from "./locales/en/hub-about.json"
import enCommunityRules from "./locales/en/community-rules.json"
import enReportEmergency from "./locales/en/report-emergency.json"
import enMessagesUnread from "./locales/en/messages-unread.json"
import enIdnEntry from "./locales/en/idn-entry.json"
import frAppearanceThemes from "./locales/fr/appearance-themes.json"
import frAccountMenu from "./locales/fr/account-menu.json"
import frAppErrors from "./locales/fr/app-errors.json"
import frAssociations from "./locales/fr/associations.json"
import frAssociationActivities from "./locales/fr/association-activities.json"
import frEventReminderNotices from "./locales/fr/event-reminder-notices.json"
import frAssociationAttendance from "./locales/fr/association-attendance.json"
import frEventGallery from "./locales/fr/event-gallery.json"
import frEventCalendar from "./locales/fr/event-calendar.json"
import frDataRights from "./locales/fr/data-rights.json"
import frDemoAccounts from "./locales/fr/demo-accounts.json"
import frDiasporale from "./locales/fr/diasporale.json"
import frDiscovery from "./locales/fr/discovery.json"
import frDoorVision from "./locales/fr/door-vision.json"
import frHubNotices from "./locales/fr/hub-notices.json"
import frHubEvents from "./locales/fr/hub-events.json"
import frNavigation from "./locales/fr/navigation.json"
import frPageAdmin from "./locales/fr/page-admin.json"
import frPageBrowsing from "./locales/fr/page-browsing.json"
import frPageSharing from "./locales/fr/page-sharing.json"
import frPageContentLinks from "./locales/fr/page-content-links.json"
import frPagePublications from "./locales/fr/page-publications.json"
import frPagePostEditing from "./locales/fr/page-post-editing.json"
import frPagePinning from "./locales/fr/page-pinning.json"
import frPagePresentation from "./locales/fr/page-presentation.json"
import frPageMedia from "./locales/fr/page-media.json"
import frPageDirectoryCategories from "./locales/fr/page-directory-categories.json"
import frPageServices from "./locales/fr/page-services.json"
import frPageManagedServices from "./locales/fr/page-managed-services.json"
import frPageServiceFilters from "./locales/fr/page-service-filters.json"
import frPageReviews from "./locales/fr/page-reviews.json"
import frPages from "./locales/fr/pages.json"
import frServiceRequests from "./locales/fr/service-requests.json"
import frServiceNotifications from "./locales/fr/service-notifications.json"
import frServiceReviews from "./locales/fr/service-reviews.json"
import frServices from "./locales/fr/services.json"
import frContentReports from "./locales/fr/content-reports.json"
import frMutualAid from "./locales/fr/mutual-aid.json"
import frArrivalKit from "./locales/fr/arrival-kit.json"
import frMentoring from "./locales/fr/mentoring.json"
import frJobs from "./locales/fr/jobs.json"
import frModerationDesk from "./locales/fr/moderation-desk.json"
import frModerationDeadlines from "./locales/fr/moderation-deadlines.json"
import frPilotMetrics from "./locales/fr/pilot-metrics.json"
import frPageDecisions from "./locales/fr/page-decisions.json"
import frContextualConversations from "./locales/fr/contextual-conversations.json"
import frCommunityNotifications from "./locales/fr/community-notifications.json"
import frPostExplanation from "./locales/fr/post-explanation.json"
import frReporterNotices from "./locales/fr/reporter-notices.json"
import frFunctionalHealth from "./locales/fr/functional-health.json"
import frServiceProposalSettings from "./locales/fr/service-proposal-settings.json"
import frServiceReschedule from "./locales/fr/service-reschedule.json"
import frMediaPreparation from "./locales/fr/media-preparation.json"
import frProfileImages from "./locales/fr/profile-images.json"
import frLegalTexts from "./locales/fr/legal-texts.json"
import frCallSettings from "./locales/fr/call-settings.json"
import frWelcomeProfile from "./locales/fr/welcome-profile.json"
import frPostPublicationState from "./locales/fr/post-publication-state.json"
import frCommentPages from "./locales/fr/comment-pages.json"
import frObjectReports from "./locales/fr/object-reports.json"
import frHubShortcuts from "./locales/fr/hub-shortcuts.json"
import frHubAbout from "./locales/fr/hub-about.json"
import frCommunityRules from "./locales/fr/community-rules.json"
import frReportEmergency from "./locales/fr/report-emergency.json"
import frMessagesUnread from "./locales/fr/messages-unread.json"
import frIdnEntry from "./locales/fr/idn-entry.json"

export interface LocaleTree {
  readonly [key: string]: string | LocaleTree
}

/** Les fichiers d'une langue, nommés comme sur le disque (sans `.json`). */
export const LOCALE_PARTS = {
  fr: {
    diasporale: frDiasporale,
    associations: frAssociations,
    "association-activities": frAssociationActivities,
    "event-reminder-notices": frEventReminderNotices,
    "association-attendance": frAssociationAttendance,
    "event-gallery": frEventGallery,
    "event-calendar": frEventCalendar,
    "data-rights": frDataRights,
    "demo-accounts": frDemoAccounts,
    discovery: frDiscovery,
    "door-vision": frDoorVision,
    "hub-notices": frHubNotices,
    "hub-events": frHubEvents,
    navigation: frNavigation,
    "page-admin": frPageAdmin,
    "page-browsing": frPageBrowsing,
    "page-sharing": frPageSharing,
    "page-content-links": frPageContentLinks,
    "page-publications": frPagePublications,
    "page-post-editing": frPagePostEditing,
    "page-pinning": frPagePinning,
    "page-presentation": frPagePresentation,
    "page-media": frPageMedia,
    "page-directory-categories": frPageDirectoryCategories,
    "page-services": frPageServices,
    "page-managed-services": frPageManagedServices,
    "page-service-filters": frPageServiceFilters,
    "page-reviews": frPageReviews,
    pages: frPages,
    "service-requests": frServiceRequests,
    "service-notifications": frServiceNotifications,
    "service-reviews": frServiceReviews,
    services: frServices,
    "content-reports": frContentReports,
    "mutual-aid": frMutualAid,
    "arrival-kit": frArrivalKit,
    mentoring: frMentoring,
    jobs: frJobs,
    "moderation-desk": frModerationDesk,
    "moderation-deadlines": frModerationDeadlines,
    "pilot-metrics": frPilotMetrics,
    "page-decisions": frPageDecisions,
    "contextual-conversations": frContextualConversations,
    "community-notifications": frCommunityNotifications,
    "post-explanation": frPostExplanation,
    "reporter-notices": frReporterNotices,
    "appearance-themes": frAppearanceThemes,
    "functional-health": frFunctionalHealth,
    "post-publication-state": frPostPublicationState,
    "comment-pages": frCommentPages,
    "app-errors": frAppErrors,
    "account-menu": frAccountMenu,
    "service-proposal-settings": frServiceProposalSettings,
    "service-reschedule": frServiceReschedule,
    "media-preparation": frMediaPreparation,
    "profile-images": frProfileImages,
    "legal-texts": frLegalTexts,
    "call-settings": frCallSettings,
    "welcome-profile": frWelcomeProfile,
    "object-reports": frObjectReports,
    "hub-shortcuts": frHubShortcuts,
    "hub-about": frHubAbout,
    "community-rules": frCommunityRules,
    "report-emergency": frReportEmergency,
    "messages-unread": frMessagesUnread,
    "idn-entry": frIdnEntry,
  },
  en: {
    diasporale: enDiasporale,
    associations: enAssociations,
    "association-activities": enAssociationActivities,
    "event-reminder-notices": enEventReminderNotices,
    "association-attendance": enAssociationAttendance,
    "event-gallery": enEventGallery,
    "event-calendar": enEventCalendar,
    "data-rights": enDataRights,
    "demo-accounts": enDemoAccounts,
    discovery: enDiscovery,
    "door-vision": enDoorVision,
    "hub-notices": enHubNotices,
    "hub-events": enHubEvents,
    navigation: enNavigation,
    "page-admin": enPageAdmin,
    "page-browsing": enPageBrowsing,
    "page-sharing": enPageSharing,
    "page-content-links": enPageContentLinks,
    "page-publications": enPagePublications,
    "page-post-editing": enPagePostEditing,
    "page-pinning": enPagePinning,
    "page-presentation": enPagePresentation,
    "page-media": enPageMedia,
    "page-directory-categories": enPageDirectoryCategories,
    "page-services": enPageServices,
    "page-managed-services": enPageManagedServices,
    "page-service-filters": enPageServiceFilters,
    "page-reviews": enPageReviews,
    pages: enPages,
    "service-requests": enServiceRequests,
    "service-notifications": enServiceNotifications,
    "service-reviews": enServiceReviews,
    services: enServices,
    "content-reports": enContentReports,
    "mutual-aid": enMutualAid,
    "arrival-kit": enArrivalKit,
    mentoring: enMentoring,
    jobs: enJobs,
    "moderation-desk": enModerationDesk,
    "moderation-deadlines": enModerationDeadlines,
    "pilot-metrics": enPilotMetrics,
    "page-decisions": enPageDecisions,
    "contextual-conversations": enContextualConversations,
    "community-notifications": enCommunityNotifications,
    "post-explanation": enPostExplanation,
    "reporter-notices": enReporterNotices,
    "appearance-themes": enAppearanceThemes,
    "functional-health": enFunctionalHealth,
    "post-publication-state": enPostPublicationState,
    "comment-pages": enCommentPages,
    "app-errors": enAppErrors,
    "account-menu": enAccountMenu,
    "service-proposal-settings": enServiceProposalSettings,
    "service-reschedule": enServiceReschedule,
    "media-preparation": enMediaPreparation,
    "profile-images": enProfileImages,
    "legal-texts": enLegalTexts,
    "call-settings": enCallSettings,
    "welcome-profile": enWelcomeProfile,
    "object-reports": enObjectReports,
    "hub-shortcuts": enHubShortcuts,
    "hub-about": enHubAbout,
    "community-rules": enCommunityRules,
    "report-emergency": enReportEmergency,
    "messages-unread": enMessagesUnread,
    "idn-entry": enIdnEntry,
  },
} as const satisfies Record<"fr" | "en", Record<string, LocaleTree>>

function isTree(value: unknown): value is LocaleTree {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Fusion profonde stricte de fragments de locale. Lève si une même phrase est
 * posée deux fois, ou si un fragment remplace un groupe par une phrase (ou
 * l'inverse) : la provenance de chaque phrase reste unique.
 */
export function mergeLocaleParts(parts: Readonly<Record<string, LocaleTree>>): LocaleTree {
  const merged: Record<string, string | LocaleTree> = {}
  const owner = new Map<string, string>()

  function place(target: Record<string, string | LocaleTree>, source: LocaleTree, part: string, prefix: string) {
    for (const [key, value] of Object.entries(source)) {
      const path = prefix ? `${prefix}.${key}` : key
      const existing = target[key]
      if (typeof value === "string") {
        if (existing !== undefined) {
          throw new Error(`Locale : « ${path} » est déjà posée par ${owner.get(path) ?? "un autre fragment"}, ${part} ne peut pas la redéfinir.`)
        }
        target[key] = value
        owner.set(path, part)
        continue
      }
      if (!isTree(value)) throw new Error(`Locale : « ${path} » (${part}) n'est ni une phrase ni un groupe.`)
      if (typeof existing === "string") throw new Error(`Locale : « ${path} » est une phrase de ${owner.get(path) ?? "un autre fragment"}, ${part} ne peut pas en faire un groupe.`)
      const branch = (existing ?? {}) as Record<string, string | LocaleTree>
      target[key] = branch
      place(branch, value, part, path)
    }
  }

  for (const [part, tree] of Object.entries(parts)) place(merged, tree, part, "")
  return merged
}

/** Les textes complets de l'espace `diasporale`, par langue. */
export const DIASPORALE_LOCALES = {
  fr: mergeLocaleParts(LOCALE_PARTS.fr),
  en: mergeLocaleParts(LOCALE_PARTS.en),
} as const
