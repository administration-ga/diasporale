import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { CodeScreen } from "@/screens/enter-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("code.title") }
}

export default function CodePage() {
  return <CodeScreen />
}
