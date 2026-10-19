"use client"

/**
 * Le lecteur unique de la découverte (DG-017) : seule la diapositive active
 * peut jouer, son coupé au départ ; la lecture s'arrête au changement
 * d'élément, quand la fenêtre de lecture quitte l'écran, à l'ouverture d'une
 * visionneuse, pendant un appel (`suspendMediaPlayback`), quand l'onglet est
 * masqué et à la sortie du mode.
 * Une pause choisie par la personne n'est jamais annulée tant que l'élément
 * reste actif ; aucune lecture automatique sous mouvement réduit ou économie de
 * données. L'exclusivité entre lecteurs est tenue par le registre du bail
 * (`claimMediaPlayback`), où s'inscrit chaque vidéo des médias de publication.
 */
import { useEffect, useRef, useState, type RefObject } from "react"

import { isMediaPlaybackSuspended, isMediaViewerOpen } from "../../lib/media-viewer-lease"
import { usePlaybackEnvironment } from "./playback-environment"

/** L'attribut qui porte, sur chaque diapositive montée, l'identifiant de sa publication. */
export const DISCOVERY_SLIDE_ATTRIBUTE = "data-discovery-slide"

interface ActiveVideo {
  readonly video: HTMLVideoElement
  /** Ce que la découverte a demandé en dernier : tout écart vient d'un geste ou du système. */
  expected: "paused" | "playing"
  expectedMuted: boolean
  manualPause: boolean
}

export function findSlide(root: HTMLElement, key: string): HTMLElement | null {
  for (const node of root.querySelectorAll<HTMLElement>(`[${DISCOVERY_SLIDE_ATTRIBUTE}]`)) {
    if (node.getAttribute(DISCOVERY_SLIDE_ATTRIBUTE) === key) return node
  }
  return null
}

function quietPause(control: ActiveVideo): void {
  control.expected = "paused"
  if (!control.video.paused) control.video.pause()
}

/** `play()` rend une promesse dans les navigateurs, parfois rien ailleurs : les deux sont tenus. */
function attempt(play: () => Promise<void> | undefined, onRefused: (error: unknown) => void): void {
  try {
    const result = play()
    if (result !== undefined && typeof result.catch === "function") result.catch(onRefused)
  } catch (error) {
    onRefused(error)
  }
}

function start(control: ActiveVideo, sound: boolean): void {
  const { video } = control
  control.expected = "playing"
  control.expectedMuted = !sound
  video.muted = !sound
  attempt(() => video.play(), (error) => {
    // Le son exige un geste que le navigateur n'a pas vu : on retente en silence, sinon on attend la personne.
    if (!video.muted && error instanceof DOMException && error.name === "NotAllowedError") {
      control.expectedMuted = true
      video.muted = true
      attempt(() => video.play(), () => { control.expected = "paused" })
      return
    }
    control.expected = "paused"
  })
}

/**
 * La fenêtre de lecture est-elle au moins à moitié à l'écran ? Sortie de la vue
 * (page défilée, colonne masquée), rien ne joue. Sans observateur, on la suppose
 * visible : l'onglet masqué et le changement d'élément arrêtent déjà la lecture.
 */
function useMostlyInView(root: RefObject<HTMLElement | null>, mounted: boolean): boolean {
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const node = root.current
    if (node === null || typeof IntersectionObserver === "undefined") return
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[entries.length - 1]
      if (entry !== undefined) setInView(entry.isIntersecting && entry.intersectionRatio >= 0.5)
    }, { threshold: [0, 0.5, 1] })
    observer.observe(node)
    return () => observer.disconnect()
  }, [root, mounted])
  return inView
}

export function useDiscoveryPlayback(args: {
  readonly root: RefObject<HTMLElement | null>
  /** Identifiant de la publication active ; `null` : diapositive d'état, rien ne joue. */
  readonly activeKey: string | null
  /** Aucun défilement en cours : une lecture automatique peut commencer. */
  readonly settled: boolean
  /** Signature des médias de l'active : un média délivré après coup relance la décision. */
  readonly revision: string
}): void {
  const environment = usePlaybackEnvironment()
  const { root, activeKey, revision } = args
  const inView = useMostlyInView(root, activeKey !== null)
  const autoplay = !environment.reducedMotion && !environment.saveData
  const blocked = !inView || !environment.visible || environment.viewerOpen || environment.suspended
  const mayStart = args.settled && !blocked
  // Préférence de son de la session de découverte : coupé au départ, puis le choix de la personne.
  const sound = useRef(false)
  const control = useRef<ActiveVideo | null>(null)
  const [probe, setProbe] = useState(0)

  // 1. Le lecteur de l'active et les gestes de la personne (pause, son).
  useEffect(() => {
    const container = root.current
    const slide = container !== null && activeKey !== null ? findSlide(container, activeKey) : null
    if (slide === null) {
      control.current = null
      return
    }
    const video = slide.querySelector("video")
    // Le lecteur peut apparaître ou être remplacé après coup (garde levée, session relue).
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
      if (slide.querySelector("video") !== video) setProbe((value) => value + 1)
    })
    observer?.observe(slide, { childList: true, subtree: true })
    if (video === null) {
      control.current = null
      return () => observer?.disconnect()
    }
    const current: ActiveVideo = { video, expected: video.paused ? "paused" : "playing", expectedMuted: video.muted, manualPause: false }
    const onPause = () => {
      if (current.expected === "paused") return
      current.expected = "paused"
      // Visionneuse, appel ou onglet masqué : une pause du système, pas un choix de la personne.
      const system = isMediaViewerOpen() || isMediaPlaybackSuspended() || document.visibilityState === "hidden"
      if (!system) current.manualPause = true
    }
    const onPlay = () => {
      if (current.expected === "playing") return
      current.expected = "playing"
      current.manualPause = false
    }
    const onVolume = () => {
      if (video.muted === current.expectedMuted) return
      current.expectedMuted = video.muted
      sound.current = !video.muted
    }
    video.addEventListener("pause", onPause)
    video.addEventListener("play", onPlay)
    video.addEventListener("volumechange", onVolume)
    control.current = current
    return () => {
      observer?.disconnect()
      video.removeEventListener("pause", onPause)
      video.removeEventListener("play", onPlay)
      video.removeEventListener("volumechange", onVolume)
      if (control.current === current) control.current = null
      // L'élément quitte l'activité (autre élément, sortie du mode) : il se tait.
      quietPause(current)
    }
  }, [root, activeKey, revision, probe])

  // 2. La décision : seule l'active joue, et seulement si tout le permet.
  useEffect(() => {
    const container = root.current
    if (container === null) return
    const current = control.current
    for (const video of container.querySelectorAll("video")) {
      if (video !== current?.video && !video.paused) video.pause()
    }
    if (current === null) return
    if (blocked) {
      quietPause(current)
      return
    }
    if (mayStart && autoplay && !current.manualPause && current.video.paused) start(current, sound.current)
  }, [root, activeKey, revision, probe, blocked, mayStart, autoplay])
}
