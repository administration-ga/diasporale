"use client"

import type { CountryCode, FeedScope } from "@diasporale/domain"
import { createContext, useContext, type ReactNode } from "react"

import type { DiasporaleDataSource } from "./port"
import type { BookmarksPageRequest, FeedPageRequest, ProfilePostsPageRequest } from "./types"

const DataSourceContext = createContext<DiasporaleDataSource | null>(null)

/**
 * Fournit la source de données à l'arbre. La source est choisie UNE fois par
 * l'application (démonstration aujourd'hui, moteur demain) et ne change pas
 * pendant la vie de l'arbre : les hooks qu'elle expose sont donc appelés dans
 * un ordre stable.
 */
export function DataSourceProvider(props: { source: DiasporaleDataSource; children: ReactNode }) {
  return <DataSourceContext.Provider value={props.source}>{props.children}</DataSourceContext.Provider>
}

export function useDataSource(): DiasporaleDataSource {
  const source = useContext(DataSourceContext)
  if (source === null) throw new Error("DataSourceProvider manquant : monter l'application dans son fournisseur de données.")
  return source
}

/** Les briques de lecture seules peuvent aussi être rendues hors application. */
export function useOptionalDataSource(): DiasporaleDataSource | null {
  return useContext(DataSourceContext)
}

export const useSession = () => useDataSource().useSession()
export const useOpenCountries = () => useDataSource().useOpenCountries()
export const useCountryHub = (country: CountryCode) => useDataSource().useCountryHub(country)
export const useFeed = (args: { scope: FeedScope; hubCountry?: CountryCode }) => useDataSource().useFeed(args)
export const useFeedPage = (args: FeedPageRequest) => useDataSource().useFeedPage(args)
export const useProfile = (handle: string) => useDataSource().useProfile(handle)
export const useProfilePostsPage = (args: ProfilePostsPageRequest) => useDataSource().useProfilePostsPage(args)
export const useRelation = (personId: string) => useDataSource().useRelation(personId)
export const useMemberSearch = (args: { query: string; country?: CountryCode }) => useDataSource().useMemberSearch(args)
export const useComments = (postId: string) => useDataSource().useComments(postId)
export const useSuggestions = () => useDataSource().useSuggestions()
export const usePost = (postId: string) => useDataSource().usePost(postId)
export const useBookmarks = () => useDataSource().useBookmarks()
export const useBookmarksPage = (args: BookmarksPageRequest) => useDataSource().useBookmarksPage(args)
export const useReplies = (args: { postId: string; commentId: string | null }) => useDataSource().useReplies(args)
export const useNotifications = () => useDataSource().useNotifications()
export const useUnreadCount = () => useDataSource().useUnreadCount()
export const usePage = (handle: string) => useDataSource().usePage(handle)
export const useHandleSuggestions = (displayName: string) => useDataSource().useHandleSuggestions(displayName)
export const useSponsorDashboard = () => useDataSource().useSponsorDashboard()
export const useMyConsents = () => useDataSource().useMyConsents()
export const useActions = () => useDataSource().actions

/** Les capacités facultatives des chantiers du plan global : `null` si le fournisseur ne les sert pas. */
export const usePagesCapability = () => useDataSource().pages ?? null
export const usePageAdmin = () => useDataSource().pageAdmin ?? null
export const useServices = () => useDataSource().services ?? null
export const useServiceRequests = () => useDataSource().serviceRequests ?? null
export const useDataRights = () => useDataSource().dataRights ?? null
export const useAssociations = () => useDataSource().associations ?? null
export const useAssociationGroups = () => useDataSource().associationGroups ?? null
export const useAssociationEvents = () => useDataSource().associationEvents ?? null
export const useServiceReviews = () => useDataSource().serviceReviews ?? null
export const useContentReports = () => useDataSource().contentReports ?? null
export const useMutualAid = () => useDataSource().mutualAid ?? null
export const useArrivalKit = () => useDataSource().arrivalKit ?? null
export const useMentoring = () => useDataSource().mentoring ?? null
export const useJobs = () => useDataSource().jobs ?? null
export const useModerationDesk = () => useDataSource().moderationDesk ?? null
export const usePilotMetrics = () => useDataSource().pilotMetrics ?? null
export const usePageDecisions = () => useDataSource().pageDecisions ?? null
export const useConversations = () => useDataSource().conversations ?? null
