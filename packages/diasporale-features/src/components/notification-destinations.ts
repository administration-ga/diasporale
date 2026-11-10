/**
 * Où mène chaque avis de la cloche (NP-04) — module PUR, sans écran.
 *
 * La table `BELL_DESTINATIONS` donne, pour CHAQUE genre que DIASPORALE sait dire, la nature de sa
 * destination ; `noticeLink` en compose l'adresse sur la table des routes de l'application, qui
 * relit les droits à l'ouverture. Une route que l'application ne fournit pas ne s'invente jamais :
 * le lien se tait. Le test de complétude de la cloche échoue pour tout genre de notre liste sans
 * phrase, sans icône ou sans ligne ici.
 *
 *  · `actor` : le profil de qui a agi, par son nom en tête de la phrase (aucun autre lien) ;
 *  · `none` : aucune destination, décision écrite à la ligne du genre ;
 *  · les autres : un lien sous la phrase, vers l'objet de l'avis.
 */
import type { CommunityNoticeView, NotificationKind, NotificationView, ServiceNoticeView } from "../data/types"
import type { FeatureRoutes } from "../routing"

export const BELL_DESTINATION_KINDS = [
  "actor",
  "post",
  "associationEvent",
  "serviceNotice",
  "communityNotice",
  "moderationDecision",
  "contextualConversation",
  "myReports",
  "page",
  "album",
  "agenda",
  "settings",
  "groupConversation",
  "callJournal",
  "none",
] as const
export type BellDestination = (typeof BELL_DESTINATION_KINDS)[number]

/** La destination de chaque genre de notre liste : un genre ajouté sans sa ligne ne compile pas. */
export const BELL_DESTINATIONS: Readonly<Record<NotificationKind, BellDestination>> = {
  // Une demande se tranche sur place ; le nom mène au profil.
  connection_request: "actor",
  connection_accepted: "actor",
  new_follower: "actor",
  post_reaction: "post",
  post_comment: "post",
  post_share: "post",
  mention: "post",
  sponsorship_received: "actor",
  // Retiré par la modération, personne n'est nommé : la phrase seule.
  sponsorship_withdrawn: "actor",
  // L'issue de l'attestation se lit dans la phrase ; la demande se refait depuis les réglages.
  attestation_verified: "none",
  attestation_not_confirmed: "none",
  association_event_reminder: "associationEvent",
  association_event_cancelled: "associationEvent",
  association_event_seat_confirmed: "associationEvent",
  service_request_received: "serviceNotice",
  service_proposal_received: "serviceNotice",
  service_request_declined: "serviceNotice",
  service_proposal_accepted: "serviceNotice",
  service_request_cancelled: "serviceNotice",
  service_request_expired: "serviceNotice",
  service_booking_completed: "serviceNotice",
  service_booking_no_show: "serviceNotice",
  service_no_show_contested: "serviceNotice",
  association_membership_requested: "serviceNotice",
  association_membership_accepted: "serviceNotice",
  association_membership_declined: "serviceNotice",
  association_membership_removed: "serviceNotice",
  service_review_replied: "serviceNotice",
  aid_answer_received: "communityNotice",
  aid_answer_retained: "communityNotice",
  aid_mission_signup: "communityNotice",
  aid_mission_cancelled: "communityNotice",
  aid_mission_rescheduled: "communityNotice",
  mentoring_request_received: "communityNotice",
  mentoring_request_accepted: "communityNotice",
  mentoring_request_declined: "communityNotice",
  mentoring_closed: "communityNotice",
  job_application_received: "communityNotice",
  job_application_shortlisted: "communityNotice",
  job_application_not_selected: "communityNotice",
  kit_resource_reviewed: "communityNotice",
  contextual_message: "contextualConversation",
  contextual_closed: "contextualConversation",
  moderation_decision: "moderationDecision",
  report_received: "myReports",
  report_decided: "myReports",
  // NP-04 : la publication de la page suivie ; le nom de la page, en tête, mène à sa fiche.
  page_post: "post",
  album_published: "album",
  // Un fichier retenu n'a aucune page : rien ne le montre tant que l'analyse le retient.
  file_withheld: "none",
  // Le moteur ne sert pas l'adresse de la page qui porte un groupe thématique (issue [S1] de NP-04).
  thematic_group_invite: "none",
  event_invite: "agenda",
  membership_changed: "settings",
  badge_changed: "settings",
  // PG-01 du moteur : la page, relue pour le lecteur — l'invitation y attend sa réponse, la décision s'y lit.
  page_signatory_invite: "page",
  page_claim_decided: "page",
  // IM-04 : la conversation de groupe d'iCom (l'invitation s'y accepte) ; l'appel manqué et le message
  // vocal au journal d'appels — jamais un bouton d'appel (IM-01).
  group_message: "groupConversation",
  group_added: "groupConversation",
  call_missed: "callJournal",
  voicemail_left: "callJournal",
  // Un genre inconnu reste « nouvelle activité » ; il ne mène qu'à la publication qu'il désigne, s'il en désigne une.
  other: "post",
}

/** Un lien d'avis : son adresse, composée par la table des routes, et la clé de son libellé. */
export interface NoticeLink {
  readonly href: string
  readonly label: string
}

/**
 * Les adresses des avis de mise en relation, quand l'application les fournit dans sa table
 * (`serviceRequest`, `activityRequest`, `associationMembers`, `myAssociations`) : chacune relit
 * les droits à l'ouverture et ne porte qu'un identifiant. Absentes, l'avis retombe sur la fiche de
 * la page ; sans page lisible, il n'offre aucun lien inventé.
 */
function deepServiceHref(notice: ServiceNoticeView, routes: FeatureRoutes): string | undefined {
  switch (notice.audience) {
    case "requester":
      return notice.requestId !== null ? routes.serviceRequest?.(notice.requestId) : undefined
    case "provider":
      return notice.requestId !== null ? routes.activityRequest?.(notice.requestId) : undefined
    case "responsible":
      return notice.pageHandle !== null ? routes.associationMembers?.(notice.pageHandle) : undefined
    case "member":
      return routes.myAssociations?.()
  }
}

/** Le lien d'un avis de mise en relation : la route qui relit les droits, sinon la fiche de la page. */
function serviceNoticeLink(notice: ServiceNoticeView, routes: FeatureRoutes): NoticeLink | null {
  const deep = deepServiceHref(notice, routes)
  if (deep) return { href: deep, label: `bell.serviceLink.${notice.audience}` }
  return notice.pageHandle !== null ? { href: routes.page(notice.pageHandle), label: "bell.serviceLinkPage" } : null
}

/**
 * Le lien d'un avis de la vie communautaire : l'objet qu'il ouvre, par la route que l'application
 * fournit (chaque route relit les droits à l'ouverture), avec son libellé.
 */
function communityNoticeLink(notice: CommunityNoticeView, routes: FeatureRoutes): NoticeLink | null {
  switch (notice.opens) {
    case "aidQuestion": {
      const href = routes.mutualAidItem?.(notice.objectId)
      return href ? { href, label: "bell.communityLink.aidQuestion" } : null
    }
    case "aidMission": {
      const href = routes.mutualAidItem?.(notice.objectId)
      return href ? { href, label: "bell.communityLink.aidMission" } : null
    }
    case "mentoringRequest": {
      const href = routes.myMentoring?.()
      return href ? { href, label: "bell.communityLink.mentoringRequest" } : null
    }
    case "jobApplication": {
      // L'équipe : le recrutement de la page concernée quand elle se lit, sinon Mon activité.
      const teamHref = notice.pageHandle !== null ? routes.pageJobs?.(notice.pageHandle) ?? routes.jobsActivity?.() : routes.jobsActivity?.()
      const href = notice.audience === "team" ? teamHref : routes.myApplications?.()
      return href ? { href, label: notice.audience === "team" ? "bell.communityLink.jobApplicationTeam" : "bell.communityLink.jobApplicationCandidate" } : null
    }
    case "kitResource": {
      const href = routes.arrivalKitResource?.(notice.objectId)
      return href ? { href, label: "bell.communityLink.kitResource" } : null
    }
  }
}

/**
 * Le lien d'un avis de décision de modération : les décisions de la page quand le moteur nomme une
 * page dont je signe à la lecture, sinon « Mes données ».
 */
function moderationDecisionLink(item: NotificationView, routes: FeatureRoutes): NoticeLink | null {
  if (!item.moderationDecision) return null
  const handle = item.moderationDecision.pageHandle
  const href = handle !== null ? routes.pageDecisions?.(handle) : routes.myDecisions?.()
  return href ? { href, label: handle !== null ? "bell.openPageDecisions" : "bell.openMyDecisions" } : null
}

/**
 * Le lien d'un avis vers son objet, ou `null` : destination `actor` (le nom en tête de la phrase
 * mène au profil) ou `none`, objet qui ne se lit plus, ou route que l'application ne fournit pas.
 */
export function noticeLink(item: NotificationView, routes: FeatureRoutes): NoticeLink | null {
  switch (BELL_DESTINATIONS[item.kind]) {
    case "actor":
    case "none":
      return null
    case "post":
      return item.postId ? { href: routes.post(item.postId), label: "bell.openPost" } : null
    case "associationEvent": {
      const event = item.associationEvent
      if (!event) return null
      return { href: routes.associationEvent?.(event.pageHandle, event.eventId) ?? routes.page(event.pageHandle), label: "bell.openAssociationEvent" }
    }
    case "serviceNotice":
      return item.serviceNotice ? serviceNoticeLink(item.serviceNotice, routes) : null
    case "communityNotice":
      return item.communityNotice ? communityNoticeLink(item.communityNotice, routes) : null
    case "moderationDecision":
      return moderationDecisionLink(item, routes)
    case "contextualConversation": {
      const href = item.contextualThreadId ? routes.contextualConversation?.(item.contextualThreadId) : undefined
      return href ? { href, label: "bell.openConversation" } : null
    }
    case "myReports": {
      const href = routes.myReports?.()
      return href ? { href, label: "bell.openMyReports" } : null
    }
    case "page":
      return item.governancePageHandle ? { href: routes.page(item.governancePageHandle), label: "bell.openPage" } : null
    case "album": {
      // L'album vit sur le profil de son auteur : sans profil publié ni album désigné, aucune adresse.
      const href = item.albumId && item.actor ? routes.album?.(item.actor.handle, item.albumId) : undefined
      return href ? { href, label: "bell.openAlbum" } : null
    }
    case "agenda": {
      const href = routes.agenda?.()
      return href ? { href, label: "bell.openAgenda" } : null
    }
    case "settings":
      return { href: routes.settings(), label: "bell.openSettings" }
    case "groupConversation": {
      const href = item.groupThreadId ? routes.groupConversation?.(item.groupThreadId) : undefined
      return href ? { href, label: item.kind === "group_added" ? "bell.openGroupInvite" : "bell.openGroup" } : null
    }
    case "callJournal": {
      const href = routes.callJournal?.()
      return href ? { href, label: "bell.openCallJournal" } : null
    }
  }
}
