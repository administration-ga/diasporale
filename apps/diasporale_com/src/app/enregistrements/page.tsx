import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { BookmarksScreen } from "@/screens/bookmarks-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("bookmarks.title") }
}

export default function BookmarksPage() {
  return <BookmarksScreen />
}
