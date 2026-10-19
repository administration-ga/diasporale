"use client"

import type { CountryCode } from "@diasporale/domain"

import type { PostView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { countryName } from "../lib/countries"
import { Button } from "../primitives/button"
import { Sheet, SheetContent } from "../primitives/sheet"

/**
 * « Pourquoi cette publication ? » (DG-019, classement explicable). Les raisons se
 * déduisent de la seule publication : sa portée (un hub pays, ou toute la diaspora), son
 * audience, sa lecture aussi dans ANTSIA, et la règle du fil (par date, sans
 * personnalisation tirée du comportement : décision D-G05). Rien n'est demandé au serveur ;
 * aucune raison n'est inventée.
 */
export type PostReason =
  | { readonly key: "postWhy.reach.local"; readonly country: CountryCode }
  | { readonly key: "postWhy.reach.diaspora" }
  | { readonly key: "postWhy.reach.diasporaOrigin"; readonly country: CountryCode }
  | { readonly key: "postWhy.audience.public" }
  | { readonly key: "postWhy.audience.connections" }
  | { readonly key: "postWhy.audience.group" }
  | { readonly key: "postWhy.audience.page" }
  | { readonly key: "postWhy.root" }
  | { readonly key: "postWhy.order" }

/** Les raisons d'une publication, dans l'ordre où elles se lisent. */
export function postReasons(post: Pick<PostView, "scope" | "audience" | "visibility">): readonly PostReason[] {
  const reasons: PostReason[] = []
  if (post.scope.reach === "local") reasons.push({ key: "postWhy.reach.local", country: post.scope.country })
  else if (post.scope.country !== undefined) reasons.push({ key: "postWhy.reach.diasporaOrigin", country: post.scope.country })
  else reasons.push({ key: "postWhy.reach.diaspora" })
  switch (post.audience) {
    case "public":
      reasons.push({ key: "postWhy.audience.public" })
      break
    case "connections":
      reasons.push({ key: "postWhy.audience.connections" })
      break
    case "group":
      reasons.push({ key: "postWhy.audience.group" })
      break
    case "page":
      reasons.push({ key: "postWhy.audience.page" })
      break
  }
  if (post.visibility === "root") reasons.push({ key: "postWhy.root" })
  reasons.push({ key: "postWhy.order" })
  return reasons
}

export function PostExplanationSheet(props: { post: PostView; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t, locale } = useDiasporaleT()
  const reasons = postReasons(props.post)
  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent title={t("postWhy.title")} description={t("postWhy.lead")} closeLabel={t("common.close")}>
        <ul className="flex flex-col gap-3 text-sm leading-relaxed">
          {reasons.map((reason) => (
            <li key={reason.key} className="rounded-lg bg-muted px-3 py-2">
              {"country" in reason ? t(reason.key, { country: countryName(reason.country, locale) }) : t(reason.key)}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] leading-snug text-muted-foreground">{t("postWhy.controls")}</p>
        <div className="mt-6 flex justify-end">
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>{t("common.close")}</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
