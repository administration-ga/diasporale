// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

import { routes } from "./routes"
import {
  OFFLINE_CACHE_PREFIX,
  SERVICE_WORKER_RETIRED,
  clearOfflineReserves,
  offlineCacheName,
  offlineReservesSupported,
  syncServiceWorker,
  type ReserveStorage,
  type WorkerContainer,
} from "./service-worker"

/** MO-05, côté pages : inscription, retrait propre et purge des réserves du script de fond. */

function storage(names: string[]) {
  const kept = [...names]
  const remove = vi.fn(async (name: string) => {
    const index = kept.indexOf(name)
    if (index >= 0) kept.splice(index, 1)
    return index >= 0
  })
  return { kept, remove, value: { keys: async () => [...kept], delete: remove } as unknown as ReserveStorage }
}

function registration(scriptPath: string | null) {
  const unregister = vi.fn(async () => true)
  const active = scriptPath === null ? null : { scriptURL: new URL(scriptPath, "https://diasporale.example").href }
  return { unregister, value: { active, waiting: null, installing: null, unregister } as unknown as ServiceWorkerRegistration }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("réserves du script de fond — purge", () => {
  it("efface ses seules réserves, toutes versions, et laisse le reste de l'origine", async () => {
    const reserves = storage([offlineCacheName(), `${OFFLINE_CACHE_PREFIX}0`, "autre-reserve"])
    expect(await clearOfflineReserves(reserves.value)).toBe(true)
    expect(reserves.kept).toEqual(["autre-reserve"])
  })

  it("sans stockage de script de fond, rien à purger", async () => {
    vi.stubGlobal("caches", undefined)
    expect(offlineReservesSupported()).toBe(false)
    expect(await clearOfflineReserves()).toBe(true)
  })

  it("un échec ne lève pas : la sortie n'est jamais bloquée", async () => {
    const failing = { keys: async () => { throw new Error("stockage indisponible") }, delete: async () => false } as unknown as ReserveStorage
    expect(await clearOfflineReserves(failing)).toBe(false)
  })

  it("une purge qui traîne est abandonnée au bout du délai", async () => {
    vi.useFakeTimers()
    const stuck = { keys: () => new Promise<string[]>(() => {}), delete: async () => false } as unknown as ReserveStorage
    const pending = clearOfflineReserves(stuck, 2_000)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(await pending).toBe(false)
  })
})

describe("script de fond — inscription et retrait propre", () => {
  it("n'est pas retiré dans cette version", () => {
    expect(SERVICE_WORKER_RETIRED).toBe(false)
  })

  it("s'inscrit à son adresse unique, pour tout le site, relu à chaque visite", async () => {
    const register = vi.fn(async () => ({}) as ServiceWorkerRegistration)
    const container = { register, getRegistrations: vi.fn(async () => []) } as unknown as WorkerContainer
    expect(await syncServiceWorker({ container, retired: false })).toBe("registered")
    expect(register).toHaveBeenCalledExactlyOnceWith(routes.serviceWorker(), { scope: routes.home(), updateViaCache: "none" })
  })

  it("retiré, désinscrit le seul script du site et efface ses réserves, sans rien inscrire", async () => {
    const own = registration(routes.serviceWorker())
    const other = registration("/autre-script.js")
    const register = vi.fn()
    const container = { register, getRegistrations: vi.fn(async () => [own.value, other.value]) } as unknown as WorkerContainer
    const reserves = storage([offlineCacheName(), "autre-reserve"])
    expect(await syncServiceWorker({ container, retired: true, storage: reserves.value })).toBe("retired")
    expect(own.unregister).toHaveBeenCalledOnce()
    expect(other.unregister).not.toHaveBeenCalled()
    expect(register).not.toHaveBeenCalled()
    expect(reserves.kept).toEqual(["autre-reserve"])
  })

  it("sans script de fond possible, le site marche comme avant ; un refus ne lève pas", async () => {
    expect(await syncServiceWorker({ container: undefined })).toBe("unsupported")
    const container = { register: vi.fn(async () => { throw new DOMException("insecure", "SecurityError") }), getRegistrations: vi.fn() } as unknown as WorkerContainer
    expect(await syncServiceWorker({ container, retired: false })).toBe("failed")
  })
})
