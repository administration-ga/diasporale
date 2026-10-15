"use client"

import type { CountryCode } from "@diasporale/domain"
import { GlobeIcon, HandHeartIcon, HeartIcon, LightbulbIcon, MessageCircleIcon, PartyPopperIcon, type LucideIcon } from "lucide-react"
import { DropdownMenu } from "radix-ui"
import { useState } from "react"

import type { PostView, ReactionKind } from "../../data/types"
import { useDiasporaleT } from "../../i18n/client"
import { cn } from "../../lib/cn"
import { formatDate, formatRelative } from "../../lib/format"
import { Avatar, Card } from "../../primitives/surface"
import { useRouting } from "../../routing"
import { PostCommentsSheet } from "../comments"
import { PostMenu } from "../post-menu"
import { RichText } from "../rich-text"
import { ContentScopeTag } from "../country-tag"
import { ModerationBanner } from "../moderation-banner"
import { TrustBadges } from "../trust-badge"

const REACTIONS: Record<ReactionKind, { icon: LucideIcon; key: string }> = {
  like: { icon: HeartIcon, key: "post.reaction.like" },
  bravo: { icon: PartyPopperIcon, key: "post.reaction.bravo" },
  soutien: { icon: HandHeartIcon, key: "post.reaction.soutien" },
  instructif: { icon: LightbulbIcon, key: "post.reaction.instructif" },
}

/**
 * Publication (C8 — héritée du PostCard de l'espace agent, simplifiée tant que
 * `social-features` n'est pas dupliqué) : auteur et badges P1, étiquette pays
 * ou portée, corps, réactions. L'auteur voit l'état de modération de sa
 * publication (carte flottante en tête, qu'il peut écarter) ; une publication
 * `root` dit qu'elle est aussi lue dans ANTIA.
 */
export function PostCard(props: {
  post: PostView
  now: number
  /** Hub courant : la pastille d'origine d'un contenu diaspora venu d'ailleurs. */
  hubCountry?: CountryCode
  canReact: boolean
  onReact?: (kind: ReactionKind | null) => void
  /** Commenter suit le même droit que réagir, sauf avis contraire. */
  canComment?: boolean
  className?: string
}) {
  const { t, locale } = useDiasporaleT()
  const { routes, Link } = useRouting()
  const { post } = props
  const [commentsOpen, setCommentsOpen] = useState(false)
  const authorHref = post.author.kind === "page" ? routes.page(post.author.handle) : routes.profile(post.author.handle)
  const mine = post.myReaction
  const MineIcon = mine ? REACTIONS[mine].icon : HeartIcon

  return (
    <Card className={cn("animate-rise overflow-hidden", props.className)}>
      <article aria-labelledby={`post-${post.id}-auteur`}>
        {post.isMine && post.moderation !== "published" ? (
          <div className="px-3 pt-3">
            <ModerationBanner state={post.moderation} />
          </div>
        ) : null}
        <header className="flex items-start gap-3 px-4 pt-4">
          <Avatar id={post.author.id} name={post.author.displayName} shape={post.author.kind === "page" ? "square" : "round"} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                href={authorHref}
                id={`post-${post.id}-auteur`}
                className="truncate font-semibold text-foreground hover:underline focus-visible:shadow-focus"
              >
                {post.author.displayName}
              </Link>
              <TrustBadges badges={post.author.badges} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              <Link href={routes.post(post.id)} className="rounded-sm hover:underline focus-visible:shadow-focus">
                <time dateTime={new Date(post.createdAt).toISOString()} title={formatDate(post.createdAt, locale)}>
                  {formatRelative(post.createdAt, props.now, locale)}
                </time>
              </Link>
              {post.edited ? <span>· {t("post.edited")}</span> : null}
              <ContentScopeTag scope={post.scope} {...(props.hubCountry ? { hubCountry: props.hubCountry } : {})} />
            </div>
          </div>
          <PostMenu post={post} />
        </header>
        <p className="whitespace-pre-line break-words px-4 pt-3 text-[15px] leading-relaxed text-foreground">
          <RichText text={post.body} />
        </p>
        <footer className="mt-3 flex flex-wrap items-center gap-2 border-t border-border px-2 py-1.5">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger
              disabled={!props.canReact}
              className={cn(
                "inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-55",
                mine ? "text-primary" : "text-muted-foreground",
              )}
              aria-label={mine ? t("post.reactedAs", { reaction: t(REACTIONS[mine].key) }) : t("post.react")}
              title={props.canReact ? undefined : t("post.reactDisabled")}
            >
              <MineIcon className="size-4" aria-hidden fill={mine ? "currentColor" : "none"} />
              <span>{post.reactionCount > 0 ? post.reactionCount : t("post.react")}</span>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={6}
                align="start"
                className="z-60 flex gap-1 rounded-xl bg-popover p-1.5 text-popover-foreground shadow-float"
              >
                {(Object.keys(REACTIONS) as ReactionKind[]).map((kind) => {
                  const Icon = REACTIONS[kind].icon
                  const active = mine === kind
                  return (
                    <DropdownMenu.Item
                      key={kind}
                      onSelect={() => props.onReact?.(active ? null : kind)}
                      className={cn(
                        "flex min-h-11 min-w-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[11px] font-medium outline-none data-[highlighted]:bg-muted",
                        active && "text-primary",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                      {t(REACTIONS[kind].key)}
                    </DropdownMenu.Item>
                  )
                })}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={commentsOpen}
            onClick={() => setCommentsOpen(true)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-focus"
          >
            <MessageCircleIcon className="size-4" aria-hidden />
            {t("post.comments", { count: post.commentCount })}
          </button>
          {post.visibility === "root" ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-[var(--radius-xs)] bg-tag-diaspora px-2 py-1 text-[11px] font-semibold text-tag-diaspora-foreground">
              <GlobeIcon className="size-3.5" aria-hidden />
              {t("post.alsoOnRoot")}
            </span>
          ) : null}
        </footer>
      </article>
      <PostCommentsSheet
        postId={post.id}
        postIsMine={post.isMine}
        canComment={props.canComment ?? props.canReact}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
      />
    </Card>
  )
}
