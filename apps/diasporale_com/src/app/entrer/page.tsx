import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { EnterScreen } from "@/screens/enter-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("entry.title") }
}

export default async function EnterPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await props.searchParams
  return <EnterScreen signOutIncomplete={params.deconnexion === "incomplete"} signUp={params.inscription === "1"} />
}
