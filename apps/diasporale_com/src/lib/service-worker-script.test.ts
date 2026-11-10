// Dupliqué de ANTSIA/apps/antsia_ga/src/lib/notification-worker.test.ts @ 8e2485a — adaptations : configuration de diasporale.com (titre DIASPORALE, porte d'ouverture absente puis posée) ; cas de la réserve hors-ligne (installation, navigations, requêtes non interceptées, repli hors réseau, reconstitution après purge, activation), du script de retrait et de la version.
// @vitest-environment node
import { runInNewContext } from "node:vm"

import { describe, expect, it, vi } from "vitest"

import { routes } from "./routes"
import { OFFLINE_CACHE_PREFIX, offlineCacheName } from "./service-worker"
import { serviceWorkerConfiguration } from "./service-worker-configuration"
import { retiredServiceWorkerScript, serviceWorkerScript, type ServiceWorkerConfiguration } from "./service-worker-script"

/** MO-05 : le script de fond unique, joué dans un contexte isolé avec un faux stockage. */

interface FakeResponse {
  readonly ok: boolean
  readonly type: string
  readonly body: string
}

const page = (body: string): FakeResponse => ({ ok: true, type: "basic", body })
const BROWSER_ERROR = { browserError: true }

class FakeCache {
  readonly entries = new Map<string, FakeResponse>()
  async put(url: string, response: FakeResponse) {
    this.entries.set(url, response)
  }
  async match(url: string) {
    return this.entries.get(url)
  }
}

class FakeCacheStorage {
  readonly stores = new Map<string, FakeCache>()
  async open(name: string) {
    const existing = this.stores.get(name)
    if (existing) return existing
    const created = new FakeCache()
    this.stores.set(name, created)
    return created
  }
  async keys() {
    return [...this.stores.keys()]
  }
  async delete(name: string) {
    return this.stores.delete(name)
  }
  async match(url: string, options?: { cacheName?: string }) {
    return options?.cacheName === undefined ? undefined : this.stores.get(options.cacheName)?.entries.get(url)
  }
  /** Toutes les adresses en réserve, toutes réserves confondues. */
  reserved(): string[] {
    return [...this.stores.values()].flatMap((store) => [...store.entries.keys()])
  }
}

type WorkerEvent = Record<string, unknown>
type WindowClient = { url: string; navigate: (href: string) => Promise<{ focus: () => Promise<unknown> } | null> }

const SCOPE = "https://diasporale.example/"
const OFFLINE = new URL(routes.offline(), SCOPE).href
const CONFIG = serviceWorkerConfiguration()

function worker(script: string, options: { windows?: WindowClient[]; caches?: FakeCacheStorage } = {}) {
  const handlers = new Map<string, (event: WorkerEvent) => void>()
  const caches = options.caches ?? new FakeCacheStorage()
  let network: (url: string) => Promise<FakeResponse> = async (url) => page(url === OFFLINE ? "hors-ligne" : url)
  const fetch = vi.fn(async (request: { url: string }) => network(request.url))
  const showNotification = vi.fn(async (_title: string, _options: unknown) => undefined)
  const openWindow = vi.fn(async (_href: string) => undefined)
  const claim = vi.fn(async () => undefined)
  const skipWaiting = vi.fn(async () => undefined)
  const enablePreload = vi.fn(async () => undefined)
  const unregister = vi.fn(async () => true)
  class Request {
    constructor(readonly url: string, readonly init: Record<string, unknown> = {}) {}
  }
  runInNewContext(script, {
    URL,
    caches,
    fetch,
    Request,
    Response: { error: () => BROWSER_ERROR },
    self: {
      addEventListener: (kind: string, handler: (event: WorkerEvent) => void) => handlers.set(kind, handler),
      registration: { scope: SCOPE, showNotification, navigationPreload: { enable: enablePreload }, unregister },
      clients: { matchAll: async () => options.windows ?? [], openWindow, claim },
      skipWaiting,
    },
  })
  const fire = async (kind: string, event: WorkerEvent = {}) => {
    const handler = handlers.get(kind)
    if (!handler) throw new Error(`Gestionnaire « ${kind} » absent`)
    const pending: Promise<unknown>[] = []
    let responded: Promise<unknown> | undefined
    handler({ ...event, waitUntil: (promise: Promise<unknown>) => pending.push(promise), respondWith: (promise: Promise<unknown>) => { responded = promise } })
    const response = responded === undefined ? undefined : await responded
    await Promise.all(pending)
    return { intercepted: responded !== undefined, response }
  }
  const navigate = (path: string, preloadResponse: Promise<FakeResponse | undefined> = Promise.resolve(undefined)) =>
    fire("fetch", { request: { url: new URL(path, SCOPE).href, mode: "navigate", method: "GET" }, preloadResponse })
  return {
    handlers, caches, fetch, fire, navigate, showNotification, openWindow, claim, skipWaiting, enablePreload, unregister,
    offline: () => { network = async () => { throw new TypeError("Failed to fetch") } },
  }
}

describe("script de fond — seule la page hors-ligne est mise en réserve", () => {
  it("à l'installation, réserve la page hors-ligne et rien d'autre, sans cookie d'un autre site ni redirection", async () => {
    const subject = worker(serviceWorkerScript(CONFIG))
    await subject.fire("install")
    expect(subject.fetch).toHaveBeenCalledOnce()
    expect(subject.fetch.mock.calls[0]?.[0]).toMatchObject({ url: OFFLINE, init: { cache: "no-store", credentials: "same-origin", redirect: "error" } })
    expect([...subject.caches.stores.keys()]).toEqual([offlineCacheName()])
    expect(subject.caches.reserved()).toEqual([OFFLINE])
    expect(subject.skipWaiting).toHaveBeenCalledOnce()
  })

  it("une navigation en ligne passe au réseau et n'entre jamais en réserve ; les autres requêtes ne sont pas interceptées", async () => {
    const subject = worker(serviceWorkerScript(CONFIG))
    await subject.fire("install")
    const feed = await subject.navigate(routes.feed())
    expect(feed).toEqual({ intercepted: true, response: page(new URL(routes.feed(), SCOPE).href) })
    for (const request of [
      { url: "https://moteur.example/api/query", mode: "cors", method: "POST" },
      { url: new URL("/_next/image?avatar=1", SCOPE).href, mode: "no-cors", method: "GET" },
      { url: new URL(routes.feed(), SCOPE).href, mode: "navigate", method: "POST" },
      { url: "https://autre.example/", mode: "navigate", method: "GET" },
    ]) {
      expect(await subject.fire("fetch", { request, preloadResponse: Promise.resolve(undefined) })).toEqual({ intercepted: false, response: undefined })
    }
    expect(subject.caches.reserved()).toEqual([OFFLINE])
  })

  it("garde la réponse préchargée par le navigateur quand il y en a une", async () => {
    const subject = worker(serviceWorkerScript(CONFIG))
    await subject.fire("install")
    subject.fetch.mockClear()
    const result = await subject.navigate(routes.messages(), Promise.resolve(page("préchargée")))
    expect(result.response).toEqual(page("préchargée"))
    expect(subject.fetch).not.toHaveBeenCalled()
    expect(subject.caches.reserved()).toEqual([OFFLINE])
  })

  it("sans réseau, une navigation reçoit la page hors-ligne au lieu de l'erreur du navigateur", async () => {
    const subject = worker(serviceWorkerScript(CONFIG))
    await subject.fire("install")
    subject.offline()
    expect((await subject.navigate(routes.services())).response).toEqual(page("hors-ligne"))
  })

  it("sans réseau ni réserve, l'erreur du navigateur : rien n'est inventé", async () => {
    const subject = worker(serviceWorkerScript(CONFIG))
    subject.offline()
    expect((await subject.navigate(routes.feed())).response).toBe(BROWSER_ERROR)
  })

  it("après une purge (sortie partout), la réserve se reconstitue à la navigation suivante, toujours seule", async () => {
    const subject = worker(serviceWorkerScript(CONFIG))
    await subject.fire("install")
    subject.caches.stores.clear()
    await subject.navigate(routes.enter())
    expect(subject.caches.reserved()).toEqual([OFFLINE])
  })

  it("à l'activation, efface ses anciennes réserves, laisse celles des autres et prend la main sans recharger aucune page", async () => {
    const caches = new FakeCacheStorage()
    for (const name of [`${OFFLINE_CACHE_PREFIX}0`, offlineCacheName(), "autre-reserve"]) await caches.open(name)
    const navigate = vi.fn(async () => null)
    const subject = worker(serviceWorkerScript(CONFIG), { caches, windows: [{ url: SCOPE, navigate }] })
    await subject.fire("activate")
    expect(await caches.keys()).toEqual([offlineCacheName(), "autre-reserve"])
    expect(subject.enablePreload).toHaveBeenCalledOnce()
    expect(subject.claim).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("une nouvelle version change le script et sa réserve", async () => {
    const next: ServiceWorkerConfiguration = { ...CONFIG, version: CONFIG.version + 1 }
    expect(serviceWorkerScript(next)).not.toBe(serviceWorkerScript(CONFIG))
    const subject = worker(serviceWorkerScript(next))
    await subject.fire("install")
    expect([...subject.caches.stores.keys()]).toEqual([offlineCacheName(next.version)])
  })
})

const payload = { version: 1, networkId: "network-current", reference: "delivery_opaque", count: 1, locale: "fr", url: "https://external.example/ignored" }

describe("script de fond — notifications : référence opaque et origine fermée", () => {
  it("affiche le titre DIASPORALE et un texte neutre, et ne garde que la référence pour le clic", async () => {
    const subject = worker(serviceWorkerScript(CONFIG))
    await subject.fire("push", { data: { json: () => payload } })
    expect(CONFIG.title).toBe("DIASPORALE")
    expect(subject.showNotification).toHaveBeenCalledWith("DIASPORALE", { body: CONFIG.messages.fr, tag: "diasporale-notification-delivery_opaque", data: { reference: payload.reference } })
    expect(subject.openWindow).not.toHaveBeenCalled()
  })

  it.each([
    { ...payload, preview: "Un texte privé" },
    { ...payload, title: "Un titre venu d'ailleurs" },
    { ...payload, reference: "https://external.example/" },
    { ...payload, reference: "delivery\n" },
    { ...payload, reference: "x".repeat(65) },
    { ...payload, count: 0 },
    { ...payload, locale: "unknown" },
  ])("refuse une charge utile hors contrat (champ en trop compris)", async (value) => {
    const subject = worker(serviceWorkerScript(CONFIG))
    await subject.fire("push", { data: { json: () => value } })
    expect(subject.showNotification).not.toHaveBeenCalled()
  })

  it("sans porte d'ouverture (avant DS-14), le clic ouvre le fil, sans référence ni destination venue de la notification", async () => {
    const subject = worker(serviceWorkerScript(CONFIG))
    const close = vi.fn()
    await subject.fire("notificationclick", { notification: { data: { reference: payload.reference, path: payload.url }, close } })
    expect(close).toHaveBeenCalledOnce()
    expect(subject.openWindow).toHaveBeenCalledWith(new URL(routes.feed(), SCOPE).href)
  })

  it("avec une porte d'ouverture posée (DS-14, MO-06), le clic y mène avec la seule référence", async () => {
    const subject = worker(serviceWorkerScript({ ...CONFIG, openPath: routes.feed() }))
    await subject.fire("notificationclick", { notification: { data: { reference: payload.reference, path: payload.url }, close: vi.fn() } })
    const opened = new URL(String(subject.openWindow.mock.calls[0]?.[0]))
    expect(opened.origin).toBe(new URL(SCOPE).origin)
    expect(opened.searchParams.get(CONFIG.referenceParam)).toBe(payload.reference)
  })

  it("réutilise une fenêtre de la même origine et laisse les autres fenêtres intactes", async () => {
    const focus = vi.fn(async () => undefined)
    const foreign = { url: "https://external.example/", navigate: vi.fn(async () => ({ focus })) }
    const current = { url: new URL(routes.feed(), SCOPE).href, navigate: vi.fn(async () => ({ focus })) }
    const subject = worker(serviceWorkerScript(CONFIG), { windows: [foreign, current] })
    await subject.fire("notificationclick", { notification: { data: { reference: payload.reference }, close: vi.fn() } })
    expect(foreign.navigate).not.toHaveBeenCalled()
    expect(current.navigate).toHaveBeenCalledWith(new URL(routes.feed(), SCOPE).href)
    expect(focus).toHaveBeenCalledOnce()
    expect(subject.openWindow).not.toHaveBeenCalled()
  })
})

describe("script de retrait — le script disparaît proprement", () => {
  it("efface toutes ses réserves, laisse celles des autres, se désinscrit et n'intercepte plus rien", async () => {
    const caches = new FakeCacheStorage()
    for (const name of [`${OFFLINE_CACHE_PREFIX}0`, offlineCacheName(), "autre-reserve"]) await caches.open(name)
    const subject = worker(retiredServiceWorkerScript({ cachePrefix: OFFLINE_CACHE_PREFIX }), { caches })
    await subject.fire("install")
    expect(subject.skipWaiting).toHaveBeenCalledOnce()
    await subject.fire("activate")
    expect(await caches.keys()).toEqual(["autre-reserve"])
    expect(subject.unregister).toHaveBeenCalledOnce()
    expect([...subject.handlers.keys()].sort()).toEqual(["activate", "install"])
  })
})
