import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { EnterScreen } from "@/screens/enter-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("entry.title") }
}

export default function EnterPage() {
  return <EnterScreen />
}
