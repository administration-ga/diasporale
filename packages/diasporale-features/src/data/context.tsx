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
