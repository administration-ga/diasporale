import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { IdnScreen } from "@/screens/enter-screens"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("idn.title") }
}

export default function IdnPage() {
  return <IdnScreen />
}
