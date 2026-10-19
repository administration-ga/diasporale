import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { ProfileImagesActions, ProfileImageUsage } from "@diasporale/features/data"
import type { ConvexReactClient } from "convex/react"

import { engineActionErrorCode } from "./engine-errors"

/** Adaptateur des seuls gestes d'images, sur la personne authentifiée du moteur. */
export function createEngineProfileImagesActions(deps: {
  convex: Pick<ConvexReactClient, "mutation">
  fetch?: typeof fetch
}): ProfileImagesActions {
  const post = deps.fetch ?? globalThis.fetch.bind(globalThis)
  const attach = async (usage: ProfileImageUsage, storageId: Id<"_storage"> | null, mimeType?: string) => {
    const args = { storageId, ...(mimeType === undefined ? {} : { mimeType }) }
    const image = usage === "avatar"
      ? await deps.convex.mutation(api.modules.people.profile.setMyAvatar, args)
      : await deps.convex.mutation(api.modules.people.profile.setMyCover, args)
    // Une retenue gagne même si un fournisseur incohérent rend aussi une URL.
    return { url: image.withheld === null ? image.url : null, withheld: image.withheld }
  }

  return {
    async set(usage, file) {
      try {
        const uploadUrl = await deps.convex.mutation(api.modules.people.profile.generateProfileUploadUrl, { usage })
        const response = await post(uploadUrl, { method: "POST", headers: { "Content-Type": file.type }, body: file })
        if (!response.ok) return { ok: false, code: "media_upload_failed" }
        const uploaded: unknown = await response.json()
        if (uploaded === null || typeof uploaded !== "object" || !("storageId" in uploaded) || typeof uploaded.storageId !== "string") {
          return { ok: false, code: "media_upload_failed" }
        }
        return { ok: true, value: await attach(usage, uploaded.storageId as Id<"_storage">, file.type) }
      } catch (error) {
        return { ok: false, code: engineActionErrorCode(error) }
      }
    },
    async clear(usage) {
      try {
        return { ok: true, value: await attach(usage, null) }
      } catch (error) {
        return { ok: false, code: engineActionErrorCode(error) }
      }
    },
  }
}
