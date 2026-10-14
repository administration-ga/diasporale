import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { CharteScreen } from "@/screens/charte-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("charte.title") }
}

export default function ChartePage() {
  return <CharteScreen />
}
