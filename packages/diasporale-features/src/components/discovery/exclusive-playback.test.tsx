import { DEFAULT_FACET_VISIBILITY } from "@diasporale/domain"
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DataSourceProvider } from "../../data/context"
import type { DiasporaleDataSource } from "../../data/port"
import type { Loadable, MembershipView, PostMediaView, SessionView } from "../../data/types"
import { getFixedT } from "../../i18n"
import { I18nProvider } from "../../i18n/client"
import {
  MEDIA_PLAYBACK_STOP_EVENT,
  claimMediaViewer,
  isMediaViewerOpen,
  registeredMediaPlayerCount,
  releaseMediaViewer,
  stopAllMediaPlayback,
  subscribeMediaPlayback,
  suspendMediaPlayback,
} from "../../lib/media-viewer-lease"
import { PostMediaGrid } from "../post-media"

/**
 * Le lecteur unique hors de la découverte : les médias d'une publication, dans
 * la liste comme ailleurs, ne jouent jamais à deux ; la visionneuse, un appel ou
 * l'événement d'arrêt coupent la lecture (point d'arrêt du chantier appels).
 */
const t = getFixedT("fr")
const member: MembershipView = {
  personId: "person-lecteur", handle: "lecteur", displayName: "Lecteur de recette", status: "declaree", badges: [],
  facet: { countryOfResidence: "FR", associationIds: [], helpAvailable: false, visibility: DEFAULT_FACET_VISIBILITY },
  joinedAt: 1, verifiedSince: null, sponsoredBy: null, attestation: { outcome: "none", postSlug: null, requestedAt: null },
  root: { network: "antsia", status: "declaree", derivedFrom: "diasporale" }, canPublish: true, rateTier: "reinforced", directoryVisibility: "hidden",
}
const session: Loadable<SessionView> = { status: "ready", data: { status: "signed_in", account: { id: member.personId, idn: null, local: null, nameHints: {} }, membership: member } }
const source = { kind: "engine", useSession: () => session } as DiasporaleDataSource
const clip = (name: string): PostMediaView => ({ kind: "video", url: `/recette-${name}.mp4`, withheld: null, altText: `Vidéo ${name}`, width: 640, height: 360 })

const playing = new Set<HTMLMediaElement>()
function mockMedia() {
  vi.spyOn(HTMLMediaElement.prototype, "paused", "get").mockImplementation(function (this: HTMLMediaElement) { return !playing.has(this) })
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    playing.add(this)
    this.dispatchEvent(new Event("play"))
    return Promise.resolve()
  })
  return vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    if (playing.delete(this)) this.dispatchEvent(new Event("pause"))
  })
}

function tree() {
  return (
    <I18nProvider locale="fr">
      <DataSourceProvider source={source}>
        <PostMediaGrid media={[clip("a")]} />
        <PostMediaGrid media={[clip("b")]} />
      </DataSourceProvider>
    </I18nProvider>
  )
}

const videoOf = (name: string) => screen.getByLabelText(`Vidéo ${name}`) as HTMLVideoElement

beforeEach(() => { playing.clear() })
afterEach(() => { vi.restoreAllMocks() })

describe("lecteur unique — médias des publications", () => {
  it("jouer une vidéo met l'autre en pause ; le registre se vide au démontage", () => {
    mockMedia()
    const view = render(tree())
    expect(registeredMediaPlayerCount()).toBe(2)
    act(() => { void videoOf("a").play() })
    expect([...playing]).toEqual([videoOf("a")])
    act(() => { void videoOf("b").play() })
    expect([...playing]).toEqual([videoOf("b")])
    view.unmount()
    expect(registeredMediaPlayerCount()).toBe(0)
  })

  it("ouvrir la visionneuse arrête toute lecture, et le bail s'annonce à ses abonnés", async () => {
    mockMedia()
    const listener = vi.fn()
    const unsubscribe = subscribeMediaPlayback(listener)
    render(tree())
    act(() => { void videoOf("a").play() })
    fireEvent.click(screen.getAllByRole("button", { name: t("post.media.expandVideo") })[1]!)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    expect(playing.size).toBe(0)
    expect(isMediaViewerOpen()).toBe(true)
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it("pendant un appel, tout s'arrête et même un geste est refusé ; la fin de l'appel rend la main", () => {
    mockMedia()
    render(tree())
    act(() => { void videoOf("a").play() })
    let release: () => void = () => undefined
    act(() => { release = suspendMediaPlayback("call") })
    expect(playing.size).toBe(0)
    act(() => { void videoOf("b").play() })
    expect(playing.size).toBe(0)
    act(() => release())
    act(() => { void videoOf("b").play() })
    expect([...playing]).toEqual([videoOf("b")])
  })

  it("l'événement d'arrêt et l'arrêt direct coupent la lecture sans rien interdire ensuite", () => {
    mockMedia()
    render(tree())
    act(() => { void videoOf("a").play() })
    act(() => { window.dispatchEvent(new Event(MEDIA_PLAYBACK_STOP_EVENT)) })
    expect(playing.size).toBe(0)
    act(() => { void videoOf("a").play() })
    act(() => stopAllMediaPlayback())
    expect(playing.size).toBe(0)
    act(() => { void videoOf("b").play() })
    expect([...playing]).toEqual([videoOf("b")])
  })

  it("le bail de visionneuse reste exclusif et rend ses mêmes réponses", () => {
    const first = Symbol("premier")
    const second = Symbol("second")
    expect(claimMediaViewer(first)).toBe(true)
    expect(claimMediaViewer(second)).toBe(false)
    expect(claimMediaViewer(first)).toBe(true)
    releaseMediaViewer(second)
    expect(isMediaViewerOpen()).toBe(true)
    releaseMediaViewer(first)
    expect(isMediaViewerOpen()).toBe(false)
  })
})
