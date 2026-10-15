import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { PostScreen } from "@/screens/post-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("postScreen.title") }
}

export default async function PostPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return <PostScreen postId={id} />
}
