import type { Metadata } from "next"

import { getAppT } from "@/i18n/server"
import { DemoScreen } from "@/screens/demo-screen"

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getAppT()
  return { title: t("demo.title") }
}

export default function DemoPage() {
  return <DemoScreen />
}
