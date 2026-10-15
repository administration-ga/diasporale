import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { MembersScreen } from "@/screens/members-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("members.title") }
}

export default function MembersPage() {
  return <MembersScreen />
}
