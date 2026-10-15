"use client"

import { createContext, useContext } from "react"

import type { PostView, SharedPostView } from "../data/types"
import { useDiasporaleT } from "../i18n/client"
import { cn } from "../lib/cn"
import { formatDate, formatRelative } from "../lib/format"
import { useRouting } from "../routing"
import { PostMediaGrid } from "./post-media"
import { RichText } from "./rich-text"

/**
 * Le pont vers le composeur de partage : la coque de l'application le fournit
 * quand la personne peut publier. Sans lui, aucune carte n'offre de partager.
 */
const PostShareContext = createContext<((post: PostView) => void) | null>(null)

export const PostShareProvider = PostShareContext.Provider

/** Ouvrir le partage d'une publication ; `null` : partager n'est pas possible ici. */
export function usePostShare(): ((post: PostView) => void) | null {
  return useContext(PostShareContext)
}

/**
 * Une publication se partage si elle est lisible par tous les membres et publiée
 * (règle du moteur) ; un partage dont l'original n'est plus lisible ne se
 * repartage pas (partager un partage cite l'original).
 */
export function isShareable(post: PostView): boolean {
  return post.audience === "public" && post.moderation === "published" && (post.share === null || post.share.available)
}

/** Ce que l'on cite en partageant : l'original d'un partage, sinon la publication elle-même. */
export function sharedPreviewOf(post: PostView): SharedPostView {
  if (post.share?.available) return post.share
  return {
    available: true,
    postId: post.id,
    author: { kind: post.author.kind, handle: post.author.handle || null, displayName: post.author.displayName || null },
    body: post.body,
    media: post.media,
    publishedAt: post.createdAt,
  }
}

/**
 * L'original d'un partage cité, dans la carte qui le cite : son auteur, son
 * texte, ses médias. Retiré ou hors de portée du lecteur, il le dit et ne dit
 * que cela.
 */
export function SharedPostEmbed(props: { share: SharedPostView; now: number; className?: string }) {
  const { t, locale } = useDiasporaleT()
  const { routes, Link } = useRouting()
  const { share } = props
  if (!share.available) {
    return (
      <p className={cn("rounded-md border border-border bg-muted px-3 py-2.5 text-[13px] text-muted-foreground", props.className)}>
        {t("post.sharedUnavailable")}
      </p>
    )
  }
  const author = share.author
  const authorHref = author.handle ? (author.kind === "page" ? routes.page(author.handle) : routes.profile(author.handle)) : null
  return (
    <section aria-label={t("post.sharedLabel")} className={cn("rounded-md border border-border px-3 py-2.5", props.className)}>
      <p className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
        {authorHref ? (
          <Link href={authorHref} className="font-semibold text-foreground hover:underline focus-visible:shadow-focus">
            {author.displayName ?? t("bell.someone")}
          </Link>
        ) : (
          <span className="font-semibold text-foreground">{author.displayName ?? t("bell.someone")}</span>
        )}
        <Link href={routes.post(share.postId)} className="rounded-sm hover:underline focus-visible:shadow-focus">
          <time dateTime={new Date(share.publishedAt).toISOString()} title={formatDate(share.publishedAt, locale)}>
            {formatRelative(share.publishedAt, props.now, locale)}
          </time>
        </Link>
      </p>
      {share.body.length > 0 ? (
        <p className="mt-1 line-clamp-6 whitespace-pre-line break-words text-[14px] leading-relaxed text-foreground">
          <RichText text={share.body} />
        </p>
      ) : null}
      <PostMediaGrid media={share.media} className="mt-2" />
    </section>
  )
}
