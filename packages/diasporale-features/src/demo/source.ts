"use client"

import type { CountryCode, FeedScope } from "@diasporale/domain"
import { useMemo, useSyncExternalStore } from "react"

import type { DemoAccountView, DiasporaleDataSource } from "../data/port"
import type { Loadable } from "../data/types"
import { splitDisplayName, suggestHandles } from "../lib/handle"
import {
  consentsView,
  countryHubView,
  demoAccountsView,
  feedView,
  openCountriesView,
  pageDetailView,
  profileView,
  sessionView,
  sponsorDashboardView,
} from "./selectors"
import type { DemoStore } from "./store"

const LOADING = { status: "loading" } as const

function ready<T>(data: T): Loadable<T> {
  return { status: "ready", data }
}

/**
 * La source de données de DÉMONSTRATION, branchée sur un `DemoStore`.
 *
 * Rendu serveur et premier rendu client : « en chargement » (instantané serveur
 * à -1), puis l'état local du navigateur — aucun écart d'hydratation, comme une
 * query Convex qui arrive après le premier rendu.
 */
export function createDemoDataSource(store: DemoStore): DiasporaleDataSource {
  const useVersion = () => useSyncExternalStore(store.subscribe, store.getVersion, () => -1)

  return {
    kind: "demo",

    useSession() {
      const version = useVersion()
      return useMemo(() => (version < 0 ? LOADING : ready(sessionView(store.getState(), store.now()))), [version])
    },

    useOpenCountries() {
      const version = useVersion()
      return useMemo(() => (version < 0 ? LOADING : ready(openCountriesView(store.getState(), store.now()))), [version])
    },

    useCountryHub(country: CountryCode) {
      const version = useVersion()
      return useMemo(
        () => (version < 0 ? LOADING : ready(countryHubView(store.getState(), country, store.now()))),
        [version, country],
      )
    },

    useFeed(args: { scope: FeedScope; hubCountry?: CountryCode }) {
      const version = useVersion()
      const { scope, hubCountry } = args
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return ready(viewerId ? feedView(state, viewerId, scope, store.now(), hubCountry) : [])
      }, [version, scope, hubCountry])
    },

    useProfile(handle: string) {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        return ready(profileView(state, handle, state.session.personId, store.now()))
      }, [version, handle])
    },

    usePage(handle: string) {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        return ready(pageDetailView(state, handle, state.session.personId, store.now()))
      }, [version, handle])
    },

    useHandleSuggestions(displayName: string) {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return []
        const state = store.getState()
        const person = state.session.personId ? state.persons[state.session.personId] : undefined
        // Les propositions viennent du nom reçu d'IDN, sinon du nom affiché saisi.
        const names = person?.idn
          ? { firstName: person.idn.firstName, lastName: person.idn.lastName }
          : splitDisplayName(displayName)
        const taken = new Set(Object.values(state.persons).map((candidate) => candidate.profile?.handle))
        return suggestHandles(names.firstName, names.lastName).filter((handle) => !taken.has(handle))
      }, [version, displayName])
    },

    useSponsorDashboard() {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return viewerId ? ready(sponsorDashboardView(state, viewerId, store.now())) : { status: "error", code: "not_signed_in" }
      }, [version])
    },

    useMyConsents() {
      const version = useVersion()
      return useMemo(() => {
        if (version < 0) return LOADING
        const state = store.getState()
        const viewerId = state.session.personId
        return viewerId ? ready(consentsView(state, viewerId)) : { status: "error", code: "not_signed_in" }
      }, [version])
    },

    actions: {
      signInWithIdn: (input) => store.signInWithIdn(input),
      requestCode: (destination) => store.requestCode(destination),
      verifyCode: (code) => store.verifyCode(code),
      signOutEverywhere: () => store.signOutEverywhere(),
      checkHandle: (handle) => store.checkHandle(handle),
      join: (input) => store.join(input),
      publish: (input) => store.publish(input),
      react: (postId, kind) => store.react(postId, kind),
      sponsor: (handle) => store.sponsor(handle),
      revokeSponsorship: (id) => store.revokeSponsorship(id),
      requestAttestation: () => store.requestAttestation(),
      setConsent: (purpose, granted) => store.setConsent(purpose, granted),
      updateFacet: (input) => store.updateFacet(input),
      setDirectoryVisibility: (level) => store.setDirectoryVisibility(level),
      exportMyData: () => store.exportMyData(),
      deleteMyAccount: () => store.deleteMyAccount(),
    },

    demo: {
      useAccounts() {
        const version = useVersion()
        return useMemo<Loadable<readonly DemoAccountView[]>>(
          () => (version < 0 ? LOADING : ready(demoAccountsView(store.getState()))),
          [version],
        )
      },
      switchTo: (personId) => store.switchTo(personId),
      reset: () => store.reset(),
    },
  }
}
