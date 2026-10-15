"use client"

import { EmptyState, PostCard, Skeleton } from "@diasporale/features"
import { useActions, usePost, type MembershipView } from "@diasporale/features/data"
import { useDiasporaleT } from "@diasporale/features/i18n/client"
import { NewspaperIcon } from "lucide-react"
import NextLink from "next/link"
import { useState } from "react"
import { toast } from "sonner"

import { AppShell } from "@/components/app-shell"
import { Gate } from "@/components/gate"
import { routes } from "@/lib/routes"

/** `/publication/[id]` — une publication seule : depuis la cloche, un signet ou son horodatage. */
export function PostScreen(props: { postId: string }) {
  return (
    <Gate require="member">
      {(session) =>
        session.membership ? (
          <AppShell membership={session.membership}>
            <PostDetail postId={props.postId} membership={session.membership} />
          </AppShell>
        ) : null
      }
    </Gate>
  )
}

function PostDetail(props: { postId: string; membership: MembershipView }) {
  const { t } = useDiasporaleT()
  const post = usePost(props.postId)
  const actions = useActions()
  const [now] = useState(() => Date.now())

  if (post.status === "loading") return <Skeleton className="h-48 w-full rounded-xl" />
  if (post.status === "error") {
    return (
      <p role="alert" className="rounded-xl bg-card p-4 text-[15px] shadow-card">
        {t(`errors.${post.code}`)}
      </p>
    )
  }
  if (post.data === null) {
    // Introuvable, illisible ou écartée : la même réponse, sans rien dire de plus.
    return (
      <EmptyState
        icon={<NewspaperIcon />}
        title={t("postScreen.notFoundTitle")}
        description={t("postScreen.notFoundBody")}
        action={
          <NextLink href={routes.feed()} className="font-semibold text-[var(--esp-accent-deep)] hover:underline focus-visible:shadow-focus">
            {t("postScreen.back")}
          </NextLink>
        }
      />
    )
  }
  return (
    <>
      <h1 className="sr-only">{t("postScreen.title")}</h1>
      <PostCard
        post={post.data}
        now={now}
        canReact={props.membership.canPublish}
        onReact={async (kind) => {
          const result = await actions.react(post.data?.id ?? props.postId, kind)
          if (!result.ok) toast.error(t(`errors.${result.code}`))
        }}
      />
    </>
  )
}
