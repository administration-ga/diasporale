"use client"

/**
 * Ce que la lecture automatique doit savoir de l'environnement (DG-017), lu par
 * abonnement (`useSyncExternalStore`), jamais par sondage :
 *   · mouvement réduit (`prefers-reduced-motion`) et économie de données
 *     (`navigator.connection.saveData`, ou `prefers-reduced-data` quand le
 *     navigateur le connaît) : aucune lecture automatique ;
 *   · onglet masqué, visionneuse ouverte, lecture suspendue (appel) : rien ne joue.
 *
 * Rendu serveur et hydratation : les valeurs PRUDENTES (pas de lecture), le
 * client corrige au premier rendu.
 */
import { useSyncExternalStore } from "react"

import { isMediaPlaybackSuspended, isMediaViewerOpen, subscribeMediaPlayback } from "../../lib/media-viewer-lease"

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)"
const REDUCED_DATA = "(prefers-reduced-data: reduce)"

interface ConnectionLike extends EventTarget {
  readonly saveData?: boolean
}

const noop = () => {}

function media(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null
  return window.matchMedia(query)
}

function subscribeMedia(query: string) {
  return (listener: () => void) => {
    const list = media(query)
    if (list === null || typeof list.addEventListener !== "function") return noop
    list.addEventListener("change", listener)
    return () => list.removeEventListener("change", listener)
  }
}

const subscribeReducedMotion = subscribeMedia(REDUCED_MOTION)
const subscribeReducedData = subscribeMedia(REDUCED_DATA)

function connection(): ConnectionLike | undefined {
  if (typeof navigator === "undefined") return undefined
  return (navigator as Navigator & { readonly connection?: ConnectionLike }).connection
}

function subscribeSaveData(listener: () => void) {
  const current = connection()
  if (current === undefined || typeof current.addEventListener !== "function") return noop
  current.addEventListener("change", listener)
  return () => current.removeEventListener("change", listener)
}

function subscribeVisibility(listener: () => void) {
  if (typeof document === "undefined") return noop
  document.addEventListener("visibilitychange", listener)
  return () => document.removeEventListener("visibilitychange", listener)
}

const reducedMotionSnapshot = () => media(REDUCED_MOTION)?.matches === true
const reducedDataSnapshot = () => media(REDUCED_DATA)?.matches === true
const saveDataSnapshot = () => connection()?.saveData === true
const visibleSnapshot = () => typeof document === "undefined" || document.visibilityState !== "hidden"
const serverTrue = () => true
const serverFalse = () => false

export interface PlaybackEnvironment {
  readonly reducedMotion: boolean
  readonly saveData: boolean
  readonly visible: boolean
  readonly viewerOpen: boolean
  readonly suspended: boolean
}

export function usePlaybackEnvironment(): PlaybackEnvironment {
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, reducedMotionSnapshot, serverTrue)
  const reducedData = useSyncExternalStore(subscribeReducedData, reducedDataSnapshot, serverTrue)
  const saveData = useSyncExternalStore(subscribeSaveData, saveDataSnapshot, serverTrue)
  const visible = useSyncExternalStore(subscribeVisibility, visibleSnapshot, serverFalse)
  const viewerOpen = useSyncExternalStore(subscribeMediaPlayback, isMediaViewerOpen, serverFalse)
  const suspended = useSyncExternalStore(subscribeMediaPlayback, isMediaPlaybackSuspended, serverTrue)
  return { reducedMotion, saveData: saveData || reducedData, visible, viewerOpen, suspended }
}
